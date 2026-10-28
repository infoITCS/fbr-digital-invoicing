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
const {
  toPublicInvoiceDetail,
  toPublicInvoiceListItem,
} = require('../utils/invoicePublic');
const { env } = require('../config/env');

const router = express.Router();

function assignFbrInvoiceNumber(invoice, interpretation) {
  // Only from official FBR response field invoiceNumber (via interpretFbrValidation)
  const num = interpretation?.fbrInvoiceNumber;
  if (num == null || String(num).trim() === '') return;
  const value = String(num).trim();
  // Never confuse with local id or our invoiceRefNo
  if (value === String(invoice._id)) return;
  if (invoice.invoiceRefNo && value === String(invoice.invoiceRefNo)) return;
  invoice.fbrInvoiceNumber = value;
}

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
      message:
        invoice.status === STATUS.SUBMITTED
          ? 'This invoice was already submitted to FBR and cannot be changed. Start a new invoice instead.'
          : invoice.status === STATUS.SUBMISSION_UNKNOWN
            ? 'This invoice has an unclear submit result and is locked. Confirm with FBR before any retry — do not edit or resubmit yet.'
            : invoice.status === STATUS.SUBMISSION_PENDING
              ? 'A submit is already in progress. Please wait — do not change or resubmit this invoice yet.'
              : `This invoice cannot be edited right now (status: ${invoice.status}).`,
      invoice,
    });
    return true;
  }
  return false;
}

/**
 * GET /api/invoices/dashboard
 * Stats + filterable/paginated invoice list.
 * Query: q, status, dateFrom, dateTo, page, limit, list=submitted|all
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    const listMode = String(req.query.list || 'submitted').toLowerCase();

    const listFilter = {};
    if (listMode === 'all') {
      // no status lock
    } else if (statusFilter && Object.values(STATUS).includes(statusFilter)) {
      listFilter.status = statusFilter;
    } else {
      listFilter.status = STATUS.SUBMITTED;
    }

    if (statusFilter && listMode === 'all' && Object.values(STATUS).includes(statusFilter)) {
      listFilter.status = statusFilter;
    }

    if (dateFrom || dateTo) {
      listFilter.invoiceDate = {};
      if (dateFrom) listFilter.invoiceDate.$gte = dateFrom;
      if (dateTo) listFilter.invoiceDate.$lte = dateTo;
    }

    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      listFilter.$or = [
        { fbrInvoiceNumber: rx },
        { invoiceRefNo: rx },
        { buyerBusinessName: rx },
        { buyerNTNCNIC: rx },
        { scenarioId: rx },
        { sellerBusinessName: rx },
      ];
      if (mongoose.Types.ObjectId.isValid(q)) {
        listFilter.$or.push({ _id: q });
      }
    }

    const [statusCounts, submittedAll, unknown, totalFiltered, pageDocs] =
      await Promise.all([
        Invoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Invoice.find({ status: STATUS.SUBMITTED }).select('totals status').lean(),
        Invoice.find({ status: STATUS.SUBMISSION_UNKNOWN })
          .sort({ submissionAttemptAt: -1, updatedAt: -1 })
          .limit(50)
          .lean(),
        Invoice.countDocuments(listFilter),
        Invoice.find(listFilter)
          .sort({ submittedAt: -1, updatedAt: -1 })
          .skip(skip)
          .limit(limit)
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
      submittedCount: byStatus[STATUS.SUBMITTED] || submittedAll.length,
      submissionUnknownCount: byStatus[STATUS.SUBMISSION_UNKNOWN] || 0,
      totalSalesExcludingST: round2(
        sumField(submittedAll, 'totals.valueSalesExcludingST')
      ),
      totalSalesTax: round2(sumField(submittedAll, 'totals.salesTaxApplicable')),
      totalInvoiceValue: round2(sumField(submittedAll, 'totals.totalValues')),
      totalFurtherTax: round2(sumField(submittedAll, 'totals.furtherTax')),
      totalExtraTax: round2(sumField(submittedAll, 'totals.extraTax')),
      totalDiscount: round2(sumField(submittedAll, 'totals.discount')),
      environment: env.fbrEnvironment,
    };

    res.json({
      stats,
      invoices: pageDocs.map(toPublicInvoiceListItem),
      unknownSubmissions: unknown.map(toPublicInvoiceListItem),
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages: Math.max(1, Math.ceil(totalFiltered / limit)),
      },
      filters: {
        q,
        status: statusFilter || (listMode === 'submitted' ? STATUS.SUBMITTED : ''),
        dateFrom,
        dateTo,
        list: listMode,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/invoices/:id — full detail (authorized fields, no secrets) */
router.get('/:id', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid invoice id' });
    }
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json({
      invoice: toPublicInvoiceDetail(invoice),
    });
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
        return res.status(400).json({
          message:
            'Some required invoice details are missing or incorrect. Check the form and try saving again.',
          errors,
        });
      }

      applyFields(existing, fields);
      existing.status = STATUS.DRAFT;
      existing.lastError = null;
      await existing.save();

      console.log('[invoice] save:update', {
        invoiceId: String(existing._id),
        status: existing.status,
      });

      return res.json({
        message: 'Draft saved. Next step: Validate with FBR.',
        invoice: existing,
      });
    }

    const fields = saveDraftBody(req);
    const errors = validateInvoiceData(fields);
    if (errors.length) {
      return res.status(400).json({
        message:
          'Some required invoice details are missing or incorrect. Check the form and try saving again.',
        errors,
      });
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

    res.status(201).json({
      message: 'Draft saved. Next step: Validate with FBR.',
      invoice,
    });
  } catch (err) {
    next(err);
  }
});

/** PUT /api/invoices/:id — update draft */
router.put('/:id', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message:
          'That invoice link is invalid. Save a new draft from the form.',
      });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        message:
          'Invoice not found. Click “Save Draft” to create a new draft, then continue.',
      });
    }
    if (rejectIfNotEditable(invoice, res)) return;

    const fields = saveDraftBody(req);
    const merged = { ...invoice.toObject(), ...fields };
    const errors = validateInvoiceData(merged);
    if (errors.length) {
      return res.status(400).json({
        message:
          'Some required invoice details are missing or incorrect. Check the form and try saving again.',
        errors,
      });
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

    res.json({
      message: 'Draft saved. Next step: Validate with FBR.',
      invoice,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/invoices/:id/validate */
router.post('/:id/validate', async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message:
          'That invoice link is invalid. Save a draft first, then validate.',
      });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        message:
          'Invoice not found. Click “Save Draft” first, then “Validate with FBR”.',
      });
    }

    if (
      invoice.status === STATUS.SUBMITTED ||
      invoice.status === STATUS.SUBMISSION_PENDING ||
      invoice.status === STATUS.SUBMISSION_UNKNOWN
    ) {
      return res.status(409).json({
        message:
          invoice.status === STATUS.SUBMITTED
            ? 'This invoice was already submitted to FBR. You cannot validate it again — start a new invoice instead.'
            : invoice.status === STATUS.SUBMISSION_UNKNOWN
              ? 'A previous submit did not get a clear answer from FBR. Do not validate or submit again until it is confirmed.'
              : 'A submit is already in progress. Please wait — do not validate again yet.',
        invoice,
      });
    }

    const fields = pickInvoiceFields(req.body);
    if (Object.keys(fields).length) {
      applyFields(invoice, fields);
      const errors = validateInvoiceData(invoice.toObject());
      if (errors.length) {
        return res.status(400).json({
          message:
            'Some required invoice details are missing or incorrect. Fix the form, then validate again.',
          errors,
        });
      }
      await invoice.save();
    }

    try {
      const result = await validateInvoice(invoice);

      invoice.fbrEnvironment = env.fbrEnvironment;
      invoice.validationRequestPayload = result.requestPayload || null;
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
        assignFbrInvoiceNumber(invoice, interpretation);
        if (interpretation.qrCodeData != null) {
          invoice.qrCodeData = interpretation.qrCodeData;
        }
      } else if (interpretation.outcome === 'invalid') {
        invoice.status = STATUS.VALIDATION_FAILED;
      } else {
        invoice.status = STATUS.VALIDATION_FAILED;
        invoice.lastError = {
          message:
            'FBR sent an unexpected reply, so we could not confirm this invoice. Try Validate again. If it keeps happening, contact your admin.',
          code: 'FBR_UNEXPECTED_RESPONSE',
          httpStatus: result.httpStatus,
        };
      }

      await invoice.save();

      const success = interpretation.outcome === 'valid';
      return res.status(success ? 200 : 422).json({
        message: success
          ? 'FBR accepted this invoice (sandbox check passed). Next step: Submit to FBR.'
          : 'FBR did not accept this invoice. Read the FBR messages, fix the form, then validate again.',
        invoice: toPublicInvoiceDetail(invoice),
        fbrHttpStatus: result.httpStatus,
        fbrResponse: result.data,
        interpretation,
      });
    } catch (error) {
      const formatted = formatSafeFbrError(error);
      invoice.status = STATUS.VALIDATION_FAILED;
      invoice.lastError = formatted;
      if (error.requestPayload) {
        invoice.validationRequestPayload = error.requestPayload;
      }
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
          invoice: toPublicInvoiceDetail(invoice),
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
      return res.status(400).json({
        message:
          'That invoice link is invalid. Save, validate, then submit again.',
      });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        message:
          'Invoice not found. Click “Save Draft”, then “Validate with FBR”, then “Submit to FBR”.',
      });
    }

    if (invoice.status === STATUS.SUBMITTED) {
      return res.status(409).json({
        message:
          'This invoice was already sent to FBR successfully. You do not need to submit it again. Open the Dashboard to view it, or start a new invoice.',
        invoice,
      });
    }

    if (invoice.status === STATUS.SUBMISSION_UNKNOWN) {
      return res.status(409).json({
        message:
          'The last submit did not get a clear answer from FBR. Do not submit again. Check the Dashboard and confirm with FBR before any retry.',
        invoice,
      });
    }

    if (
      invoice.status === STATUS.SUBMISSION_PENDING ||
      invoice.submissionLocked
    ) {
      return res.status(409).json({
        message:
          'A submit is already in progress for this invoice. Please wait — do not click Submit again.',
        invoice,
      });
    }

    if (invoice.status !== STATUS.VALIDATED) {
      return res.status(409).json({
        message:
          'This invoice must pass “Validate with FBR” first. Click Validate, wait for success, then click Submit.',
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
          'The invoice details changed, so it must be validated again. Click “Validate with FBR”, then Submit.',
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

      invoice.fbrEnvironment = env.fbrEnvironment;
      invoice.submissionRequestPayload = result.requestPayload || null;
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
        assignFbrInvoiceNumber(invoice, interpretation);
        if (interpretation.qrCodeData != null) {
          invoice.qrCodeData = interpretation.qrCodeData;
        }
        if (interpretation.validationResponse) {
          invoice.validationResponse = interpretation.validationResponse;
        }

        await invoice.save();

        return res.json({
          message: invoice.fbrInvoiceNumber
            ? `Invoice submitted successfully to FBR. FBR invoice number: ${invoice.fbrInvoiceNumber}.`
            : 'Invoice submitted successfully to FBR.',
          invoice: toPublicInvoiceDetail(invoice),
          fbrHttpStatus: result.httpStatus,
          fbrResponse: result.data,
          interpretation,
        });
      }

      // Explicit rejection from FBR
      invoice.status = STATUS.VALIDATION_FAILED;
      invoice.submissionLocked = false;
      invoice.lastError = {
        message:
          'FBR rejected this invoice. It was not submitted. Fix the issues shown, validate again, then submit.',
        code: 'FBR_SUBMISSION_REJECTED',
        summary: interpretation.summary,
      };
      await invoice.save();

      return res.status(422).json({
        message:
          'FBR rejected this invoice. It was not submitted. Read the FBR messages, fix the form, validate again, then submit.',
        invoice: toPublicInvoiceDetail(invoice),
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
      if (error.requestPayload) {
        invoice.submissionRequestPayload = error.requestPayload;
      }
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
          invoice: toPublicInvoiceDetail(invoice),
          fbrHttpStatus: formatted.httpStatus,
          fbrResponse: error.fbrBody ?? null,
        });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
