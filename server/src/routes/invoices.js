const express = require('express');
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const {
  validateInvoice,
  submitInvoice,
  formatSafeFbrError,
} = require('../services/fbrService');
const {
  STATUS,
  EDITABLE_STATUSES,
  pickInvoiceFields,
  normalizeInvoiceFields,
  computeTotals,
  validateInvoiceData,
} = require('../utils/invoicePayload');

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function applyFields(invoice, fields) {
  const normalized = normalizeInvoiceFields(fields);
  Object.assign(invoice, normalized);
  if (normalized.items) {
    invoice.totals = computeTotals(normalized.items);
  } else if (invoice.items) {
    invoice.totals = computeTotals(invoice.items);
  }
}

function saveDraftBody(req) {
  return normalizeInvoiceFields(pickInvoiceFields(req.body));
}

function rejectIfNotEditable(invoice, res) {
  if (!EDITABLE_STATUSES.has(invoice.status)) {
    res.status(409).json({
      message: `Cannot modify invoice in status "${invoice.status}".`,
      invoice,
    });
    return true;
  }
  return false;
}

/**
 * GET /api/invoices/dashboard
 * Stats + list of invoices submitted to FBR (and submission_unknown for visibility).
 * Must be registered before /:id routes.
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const [statusCounts, submitted, unknown] = await Promise.all([
      Invoice.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Invoice.find({ status: STATUS.SUBMITTED })
        .sort({ submittedAt: -1, updatedAt: -1 })
        .select(
          [
            'invoiceType',
            'invoiceDate',
            'scenarioId',
            'invoiceRefNo',
            'sellerNTNCNIC',
            'sellerBusinessName',
            'buyerNTNCNIC',
            'buyerBusinessName',
            'buyerRegistrationType',
            'items',
            'totals',
            'status',
            'fbrInvoiceNumber',
            'submittedAt',
            'validatedAt',
            'submissionHttpStatus',
            'createdAt',
            'updatedAt',
          ].join(' ')
        )
        .lean(),
      Invoice.find({ status: STATUS.SUBMISSION_UNKNOWN })
        .sort({ submissionAttemptAt: -1, updatedAt: -1 })
        .select(
          'invoiceDate scenarioId buyerBusinessName buyerNTNCNIC totals status fbrInvoiceNumber submittedAt submissionAttemptAt createdAt'
        )
        .lean(),
    ]);

    const byStatus = Object.values(STATUS).reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});
    for (const row of statusCounts) {
      if (row._id) byStatus[row._id] = row.count;
    }

    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const sumField = (list, path) =>
      list.reduce((sum, inv) => {
        const v = path.split('.').reduce((o, k) => (o == null ? 0 : o[k]), inv);
        return sum + (Number(v) || 0);
      }, 0);

    const stats = {
      totalInvoices: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      submittedCount: submitted.length,
      submissionUnknownCount: unknown.length,
      totalSalesExcludingST: round2(
        sumField(submitted, 'totals.valueSalesExcludingST')
      ),
      totalSalesTax: round2(sumField(submitted, 'totals.salesTaxApplicable')),
      totalInvoiceValue: round2(sumField(submitted, 'totals.totalValues')),
      totalFurtherTax: round2(sumField(submitted, 'totals.furtherTax')),
      totalDiscount: round2(sumField(submitted, 'totals.discount')),
    };

    const invoices = submitted.map((inv) => ({
      ...inv,
      itemCount: Array.isArray(inv.items) ? inv.items.length : 0,
      // Avoid sending full item rows in the table list
      items: undefined,
    }));

    res.json({
      stats,
      invoices,
      unknownSubmissions: unknown,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/invoices/:id — fetch one invoice (for detail / recovery) */
router.get('/:id', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid invoice id' });
    }
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

/** POST /api/invoices — create draft */
router.post('/', async (req, res, next) => {
  try {
    console.log('[invoice] save:create', { at: new Date().toISOString() });

    // Support legacy clients that POST with id for update
    const legacyId = req.body.id || req.body._id;
    if (legacyId) {
      if (!isValidObjectId(legacyId)) {
        return res.status(400).json({ message: 'Invalid invoice id' });
      }
      const existing = await Invoice.findById(legacyId);
      if (!existing) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      if (rejectIfNotEditable(existing, res)) return;

      const fields = saveDraftBody(req);
      const errors = validateInvoiceData({ ...existing.toObject(), ...fields });
      if (errors.length) {
        return res.status(400).json({ message: 'Validation failed', errors });
      }

      applyFields(existing, fields);
      existing.status = STATUS.DRAFT;
      existing.lastError = null;
      await existing.save();

      console.log('[invoice] save:update', {
        invoiceId: String(existing._id),
        status: existing.status,
      });

      return res.json({ message: 'Draft saved', invoice: existing });
    }

    const fields = saveDraftBody(req);
    const errors = validateInvoiceData(fields);
    if (errors.length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const invoice = new Invoice({
      ...fields,
      totals: computeTotals(fields.items || []),
      status: STATUS.DRAFT,
    });
    await invoice.save();

    console.log('[invoice] save:created', {
      invoiceId: String(invoice._id),
      status: invoice.status,
    });

    res.status(201).json({ message: 'Draft saved', invoice });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/invoices/:id — update draft */
router.put('/:id', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid invoice id' });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    if (rejectIfNotEditable(invoice, res)) return;

    const fields = saveDraftBody(req);
    const merged = { ...invoice.toObject(), ...fields };
    const errors = validateInvoiceData(merged);
    if (errors.length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    applyFields(invoice, fields);
    // Editing after validate resets to draft — must re-validate before submit
    invoice.status = STATUS.DRAFT;
    invoice.lastError = null;
    await invoice.save();

    console.log('[invoice] save:put', {
      invoiceId: String(invoice._id),
      status: invoice.status,
    });

    res.json({ message: 'Draft updated', invoice });
  } catch (err) {
    next(err);
  }
});

/** POST /api/invoices/:id/validate */
router.post('/:id/validate', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid invoice id' });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res
        .status(404)
        .json({ message: 'Invoice not found. Save a draft first.' });
    }

    if (
      invoice.status === STATUS.SUBMITTED ||
      invoice.status === STATUS.SUBMISSION_PENDING ||
      invoice.status === STATUS.SUBMISSION_UNKNOWN
    ) {
      return res.status(409).json({
        message: `Cannot validate invoice in status "${invoice.status}".`,
        invoice,
      });
    }

    const fields = pickInvoiceFields(req.body);
    if (Object.keys(fields).length) {
      applyFields(invoice, fields);
      const errors = validateInvoiceData(invoice.toObject());
      if (errors.length) {
        return res.status(400).json({ message: 'Validation failed', errors });
      }
      await invoice.save();
    }

    try {
      const result = await validateInvoice(invoice);

      invoice.validationResponse = result.data;
      invoice.validationHttpStatus = result.httpStatus;
      invoice.validatedAt = new Date();
      invoice.lastFbrExchange = {
        httpStatus: result.httpStatus,
        body: result.data,
        at: invoice.validatedAt,
        durationMs: result.durationMs,
        endpoint: result.endpoint,
      };
      invoice.lastError = null;

      const { interpretation } = result;

      // HTTP 200 is not enough — use FBR validationResponse
      if (interpretation.outcome === 'valid') {
        invoice.status = STATUS.VALIDATED;
        if (interpretation.fbrInvoiceNumber) {
          // Validate may return a provisional number in some samples; store if present
          invoice.fbrInvoiceNumber = interpretation.fbrInvoiceNumber;
        }
        if (interpretation.qrCodeData != null) {
          invoice.qrCodeData = interpretation.qrCodeData;
        }
      } else if (interpretation.outcome === 'invalid') {
        invoice.status = STATUS.VALIDATION_FAILED;
      } else {
        invoice.status = STATUS.VALIDATION_FAILED;
        invoice.lastError = {
          message: 'Unexpected FBR validation response shape',
          code: 'FBR_UNEXPECTED_RESPONSE',
          httpStatus: result.httpStatus,
        };
      }

      await invoice.save();

      const success = interpretation.outcome === 'valid';
      return res.status(success ? 200 : 422).json({
        message: success
          ? 'FBR validation succeeded (sandbox)'
          : 'FBR validation failed — see fbrResponse for details',
        invoice,
        fbrHttpStatus: result.httpStatus,
        fbrResponse: result.data,
        interpretation,
      });
    } catch (error) {
      const formatted = formatSafeFbrError(error);
      invoice.status = STATUS.VALIDATION_FAILED;
      invoice.lastError = formatted;
      invoice.validationResponse = error.fbrBody ?? {
        error: error.message,
        code: error.code,
      };
      invoice.validationHttpStatus = error.httpStatus ?? null;
      invoice.validatedAt = new Date();
      invoice.lastFbrExchange = {
        httpStatus: error.httpStatus ?? null,
        body: error.fbrBody,
        at: invoice.validatedAt,
        durationMs: error.durationMs ?? null,
        endpoint: error.endpoint || 'validateinvoicedata_sb',
      };
      await invoice.save();

      return res
        .status(error.status && error.status >= 400 ? error.status : 502)
        .json({
          message: formatted.message,
          error: formatted,
          invoice,
          fbrHttpStatus: formatted.httpStatus,
          fbrResponse: error.fbrBody ?? null,
        });
    }
  } catch (err) {
    next(err);
  }
});

/** POST /api/invoices/:id/submit */
router.post('/:id/submit', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid invoice id' });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res
        .status(404)
        .json({ message: 'Invoice not found. Save a draft first.' });
    }

    if (invoice.status === STATUS.SUBMITTED) {
      return res.status(409).json({
        message:
          'Invoice already submitted successfully. Duplicate submission blocked.',
        invoice,
      });
    }

    if (invoice.status === STATUS.SUBMISSION_UNKNOWN) {
      return res.status(409).json({
        message:
          'Previous submission outcome is submission_unknown. Inspect saved FBR exchange and reconcile before retrying. Automatic retry is disabled.',
        invoice,
      });
    }

    if (
      invoice.status === STATUS.SUBMISSION_PENDING ||
      invoice.submissionLocked
    ) {
      return res.status(409).json({
        message: 'Submission already in progress. Duplicate submission blocked.',
        invoice,
      });
    }

    if (invoice.status !== STATUS.VALIDATED) {
      return res.status(409).json({
        message:
          'Invoice must pass FBR validation (status: validated) before submit. Save, validate, then submit.',
        invoice,
      });
    }

    // Optional late field refresh — if body sent, re-normalize but require re-validation
    const fields = pickInvoiceFields(req.body);
    if (Object.keys(fields).length) {
      applyFields(invoice, fields);
      invoice.status = STATUS.DRAFT;
      await invoice.save();
      return res.status(409).json({
        message:
          'Invoice fields were updated. Status reset to draft — validate with FBR again before submit.',
        invoice,
      });
    }

    // Record attempt BEFORE external call
    invoice.status = STATUS.SUBMISSION_PENDING;
    invoice.submissionLocked = true;
    invoice.submissionAttemptAt = new Date();
    invoice.lastError = null;
    await invoice.save();

    console.log('[invoice] submit:attempt', {
      invoiceId: String(invoice._id),
      at: invoice.submissionAttemptAt.toISOString(),
    });

    try {
      const result = await submitInvoice(invoice);

      invoice.submissionResponse = result.data;
      invoice.submissionHttpStatus = result.httpStatus;
      invoice.submittedAt = new Date();
      invoice.lastFbrExchange = {
        httpStatus: result.httpStatus,
        body: result.data,
        at: invoice.submittedAt,
        durationMs: result.durationMs,
        endpoint: result.endpoint,
      };

      const { interpretation } = result;

      // Only mark submitted when FBR confirms success
      const confirmed =
        interpretation.outcome === 'valid' ||
        (interpretation.fbrInvoiceNumber &&
          interpretation.outcome !== 'invalid');

      if (confirmed) {
        invoice.status = STATUS.SUBMITTED;
        invoice.submissionLocked = false;
        if (interpretation.fbrInvoiceNumber) {
          invoice.fbrInvoiceNumber = interpretation.fbrInvoiceNumber;
        }
        if (interpretation.qrCodeData != null) {
          invoice.qrCodeData = interpretation.qrCodeData;
        }
        if (interpretation.validationResponse) {
          invoice.validationResponse = interpretation.validationResponse;
        }

        await invoice.save();

        return res.json({
          message: 'Invoice submitted successfully to FBR sandbox',
          invoice,
          fbrHttpStatus: result.httpStatus,
          fbrResponse: result.data,
          interpretation,
        });
      }

      // Explicit rejection from FBR
      invoice.status = STATUS.VALIDATION_FAILED;
      invoice.submissionLocked = false;
      invoice.lastError = {
        message: 'FBR rejected the submission',
        code: 'FBR_SUBMISSION_REJECTED',
        summary: interpretation.summary,
      };
      await invoice.save();

      return res.status(422).json({
        message:
          'FBR rejected the submission — invoice was NOT marked as submitted',
        invoice,
        fbrHttpStatus: result.httpStatus,
        fbrResponse: result.data,
        interpretation,
      });
    } catch (error) {
      const formatted = formatSafeFbrError(error);

      if (error.uncertain) {
        invoice.status = STATUS.SUBMISSION_UNKNOWN;
        invoice.submissionLocked = true;
      } else {
        invoice.status = STATUS.VALIDATION_FAILED;
        invoice.submissionLocked = false;
      }

      invoice.lastError = formatted;
      invoice.submissionResponse = error.fbrBody ?? {
        error: error.message,
        code: error.code,
      };
      invoice.submissionHttpStatus = error.httpStatus ?? null;
      invoice.submittedAt = new Date();
      invoice.lastFbrExchange = {
        httpStatus: error.httpStatus ?? null,
        body: error.fbrBody,
        at: invoice.submittedAt,
        durationMs: error.durationMs ?? null,
        endpoint: error.endpoint || 'postinvoicedata_sb',
      };
      await invoice.save();

      return res
        .status(error.status && error.status >= 400 ? error.status : 502)
        .json({
          message: formatted.message,
          error: formatted,
          invoice,
          fbrHttpStatus: formatted.httpStatus,
          fbrResponse: error.fbrBody ?? null,
        });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
