/**
 * Invoice field picking, server-side validation, totals, and FBR payload mapping.
 * Field names follow PRAL DI API Technical Documentation (sandbox).
 *
 * SN005 / extraTax note:
 * Official sandbox SN005 sample uses extraTax: "" (empty string).
 * Live validator has also returned 0091 (must be empty) for 0 and 0300
 * (numeric required) when omitted — conflicting guidance. We preserve the
 * exact value the user/form saved (including "") and do not invent a workaround.
 * See docs/SN005-EXTRATAX.md.
 */

const ALLOWED_FIELDS = [
  'invoiceType',
  'invoiceDate',
  'scenarioId',
  'invoiceRefNo',
  'sellerNTNCNIC',
  'sellerBusinessName',
  'sellerProvince',
  'sellerAddress',
  'buyerNTNCNIC',
  'buyerBusinessName',
  'buyerProvince',
  'buyerAddress',
  'buyerRegistrationType',
  'items',
];

const EDITABLE_STATUSES = new Set([
  'draft',
  'validation_failed',
  'validated',
]);

const STATUS = {
  DRAFT: 'draft',
  VALIDATION_FAILED: 'validation_failed',
  VALIDATED: 'validated',
  SUBMISSION_PENDING: 'submission_pending',
  SUBMITTED: 'submitted',
  SUBMISSION_UNKNOWN: 'submission_unknown',
};

function pickInvoiceFields(body = {}) {
  const data = {};
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      data[key] = body[key];
    }
  }
  return data;
}

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeItem(raw = {}) {
  const item = {
    hsCode: String(raw.hsCode ?? '').trim(),
    productDescription: String(raw.productDescription ?? '').trim(),
    rate: String(raw.rate ?? '').trim(),
    uoM: String(raw.uoM ?? '').trim(),
    quantity: toNumber(raw.quantity, 0),
    totalValues: toNumber(raw.totalValues, 0),
    valueSalesExcludingST: toNumber(raw.valueSalesExcludingST, 0),
    fixedNotifiedValueOrRetailPrice: toNumber(
      raw.fixedNotifiedValueOrRetailPrice,
      0
    ),
    salesTaxApplicable: toNumber(raw.salesTaxApplicable, 0),
    salesTaxWithheldAtSource: toNumber(raw.salesTaxWithheldAtSource, 0),
    furtherTax: toNumber(raw.furtherTax, 0),
    sroScheduleNo: String(raw.sroScheduleNo ?? ''),
    fedPayable: toNumber(raw.fedPayable, 0),
    discount: toNumber(raw.discount, 0),
    saleType: String(raw.saleType ?? '').trim(),
    sroItemSerialNo: String(raw.sroItemSerialNo ?? ''),
  };

  // Preserve extraTax exactly as provided when empty string; otherwise number if numeric
  if (raw.extraTax === '' || raw.extraTax === undefined || raw.extraTax === null) {
    item.extraTax = raw.extraTax === undefined || raw.extraTax === null ? '' : '';
  } else if (typeof raw.extraTax === 'string' && raw.extraTax.trim() === '') {
    item.extraTax = '';
  } else if (
    typeof raw.extraTax === 'number' ||
    (typeof raw.extraTax === 'string' && raw.extraTax.trim() !== '' && !Number.isNaN(Number(raw.extraTax)))
  ) {
    item.extraTax = Number(raw.extraTax);
  } else {
    item.extraTax = raw.extraTax;
  }

  return item;
}

function normalizeInvoiceFields(fields) {
  const next = { ...fields };
  if (next.invoiceType != null) next.invoiceType = String(next.invoiceType).trim();
  if (next.invoiceDate != null) next.invoiceDate = String(next.invoiceDate).trim();
  if (next.scenarioId != null) next.scenarioId = String(next.scenarioId).trim();
  if (next.invoiceRefNo != null) next.invoiceRefNo = String(next.invoiceRefNo);
  if (next.sellerNTNCNIC != null)
    next.sellerNTNCNIC = String(next.sellerNTNCNIC).trim();
  if (next.sellerBusinessName != null)
    next.sellerBusinessName = String(next.sellerBusinessName).trim();
  if (next.sellerProvince != null)
    next.sellerProvince = String(next.sellerProvince).trim();
  if (next.sellerAddress != null)
    next.sellerAddress = String(next.sellerAddress).trim();
  if (next.buyerNTNCNIC != null)
    next.buyerNTNCNIC = String(next.buyerNTNCNIC).trim();
  if (next.buyerBusinessName != null)
    next.buyerBusinessName = String(next.buyerBusinessName).trim();
  if (next.buyerProvince != null)
    next.buyerProvince = String(next.buyerProvince).trim();
  if (next.buyerAddress != null)
    next.buyerAddress = String(next.buyerAddress).trim();
  if (next.buyerRegistrationType != null)
    next.buyerRegistrationType = String(next.buyerRegistrationType).trim();
  if (Array.isArray(next.items)) {
    next.items = next.items.map(normalizeItem);
  }
  return next;
}

function calcItemLineTotal(item) {
  const base = toNumber(item.valueSalesExcludingST);
  const st = toNumber(item.salesTaxApplicable);
  const further = toNumber(item.furtherTax);
  const extra =
    item.extraTax === '' || item.extraTax == null
      ? 0
      : toNumber(item.extraTax);
  const fed = toNumber(item.fedPayable);
  const discount = toNumber(item.discount);
  return Math.round((base + st + further + extra + fed - discount) * 100) / 100;
}

function computeTotals(items = []) {
  return items.reduce(
    (acc, item) => {
      acc.valueSalesExcludingST += toNumber(item.valueSalesExcludingST);
      acc.salesTaxApplicable += toNumber(item.salesTaxApplicable);
      acc.furtherTax += toNumber(item.furtherTax);
      acc.extraTax +=
        item.extraTax === '' || item.extraTax == null
          ? 0
          : toNumber(item.extraTax);
      acc.fedPayable += toNumber(item.fedPayable);
      acc.discount += toNumber(item.discount);
      acc.salesTaxWithheldAtSource += toNumber(item.salesTaxWithheldAtSource);
      acc.totalValues +=
        toNumber(item.totalValues) || calcItemLineTotal(item);
      return acc;
    },
    {
      valueSalesExcludingST: 0,
      salesTaxApplicable: 0,
      furtherTax: 0,
      extraTax: 0,
      fedPayable: 0,
      discount: 0,
      salesTaxWithheldAtSource: 0,
      totalValues: 0,
    }
  );
}

function validateInvoiceData(data) {
  const errors = [];

  if (!data.invoiceType) errors.push({ field: 'invoiceType', message: 'Required' });
  if (!data.invoiceDate) errors.push({ field: 'invoiceDate', message: 'Required' });
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.invoiceDate)) {
    errors.push({
      field: 'invoiceDate',
      message: 'Must be YYYY-MM-DD',
    });
  }
  if (!data.scenarioId) errors.push({ field: 'scenarioId', message: 'Required for sandbox' });
  if (!data.sellerNTNCNIC)
    errors.push({ field: 'sellerNTNCNIC', message: 'Required' });
  if (!data.sellerBusinessName)
    errors.push({ field: 'sellerBusinessName', message: 'Required' });
  if (!data.sellerProvince)
    errors.push({ field: 'sellerProvince', message: 'Required' });
  if (!data.sellerAddress)
    errors.push({ field: 'sellerAddress', message: 'Required' });
  if (!data.buyerBusinessName)
    errors.push({ field: 'buyerBusinessName', message: 'Required' });
  if (!data.buyerProvince)
    errors.push({ field: 'buyerProvince', message: 'Required' });
  if (!data.buyerAddress)
    errors.push({ field: 'buyerAddress', message: 'Required' });
  if (!data.buyerRegistrationType)
    errors.push({ field: 'buyerRegistrationType', message: 'Required' });
  if (
    data.buyerRegistrationType === 'Registered' &&
    !data.buyerNTNCNIC
  ) {
    errors.push({
      field: 'buyerNTNCNIC',
      message: 'Required for registered buyers',
    });
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push({ field: 'items', message: 'At least one item is required' });
  } else {
    data.items.forEach((item, index) => {
      if (!item.hsCode)
        errors.push({ field: `items[${index}].hsCode`, message: 'Required' });
      if (!item.productDescription)
        errors.push({
          field: `items[${index}].productDescription`,
          message: 'Required',
        });
      if (!item.rate)
        errors.push({ field: `items[${index}].rate`, message: 'Required' });
      if (!item.uoM)
        errors.push({ field: `items[${index}].uoM`, message: 'Required' });
      if (!item.saleType)
        errors.push({ field: `items[${index}].saleType`, message: 'Required' });
    });
  }

  return errors;
}

/**
 * Build FBR DI JSON body from stored invoice.
 * Does not invent tax rates or SRO serials.
 */
function buildFbrPayload(invoice) {
  return {
    invoiceType: invoice.invoiceType,
    invoiceDate: invoice.invoiceDate,
    sellerNTNCNIC: invoice.sellerNTNCNIC,
    sellerBusinessName: invoice.sellerBusinessName,
    sellerProvince: invoice.sellerProvince,
    sellerAddress: invoice.sellerAddress,
    buyerNTNCNIC: invoice.buyerNTNCNIC,
    buyerBusinessName: invoice.buyerBusinessName,
    buyerProvince: invoice.buyerProvince,
    buyerAddress: invoice.buyerAddress,
    buyerRegistrationType: invoice.buyerRegistrationType,
    invoiceRefNo: invoice.invoiceRefNo || '',
    scenarioId: invoice.scenarioId,
    items: (invoice.items || []).map((item) => ({
      hsCode: item.hsCode,
      productDescription: item.productDescription,
      rate: item.rate,
      uoM: item.uoM,
      quantity: item.quantity,
      totalValues: item.totalValues,
      valueSalesExcludingST: item.valueSalesExcludingST,
      fixedNotifiedValueOrRetailPrice: item.fixedNotifiedValueOrRetailPrice,
      salesTaxApplicable: item.salesTaxApplicable,
      salesTaxWithheldAtSource: item.salesTaxWithheldAtSource,
      extraTax: item.extraTax,
      furtherTax: item.furtherTax,
      sroScheduleNo: item.sroScheduleNo,
      fedPayable: item.fedPayable,
      discount: item.discount,
      saleType: item.saleType,
      sroItemSerialNo: item.sroItemSerialNo,
    })),
  };
}

/**
 * Interpret FBR validationResponse per official samples.
 * HTTP 200 alone is NOT success — check status / statusCode.
 */
function interpretFbrValidation(responseData) {
  if (!responseData || typeof responseData !== 'object') {
    return {
      outcome: 'unknown',
      fbrInvoiceNumber: null,
      qrCodeData: null,
      validationResponse: null,
      summary: 'Malformed or empty FBR response',
    };
  }

  const validationResponse = responseData.validationResponse ?? null;
  const fbrInvoiceNumber =
    responseData.invoiceNumber != null
      ? String(responseData.invoiceNumber)
      : null;

  let qrCodeData = null;
  if (responseData.qrCode != null) qrCodeData = responseData.qrCode;
  else if (responseData.qrCodeData != null) qrCodeData = responseData.qrCodeData;
  else if (responseData.QRCode != null) qrCodeData = responseData.QRCode;

  if (!validationResponse) {
    return {
      outcome: fbrInvoiceNumber ? 'valid' : 'unknown',
      fbrInvoiceNumber,
      qrCodeData,
      validationResponse: null,
      summary: fbrInvoiceNumber
        ? 'invoiceNumber present without validationResponse'
        : 'No validationResponse in FBR body',
    };
  }

  const status = String(validationResponse.status || '').toLowerCase();
  const code = String(validationResponse.statusCode || '');

  let outcome = 'unknown';
  if (status === 'valid' && (code === '00' || code === '')) outcome = 'valid';
  else if (status === 'invalid' || code === '01') outcome = 'invalid';

  // Item-level invalid can appear with header statusCode 00
  const itemStatuses = validationResponse.invoiceStatuses;
  if (Array.isArray(itemStatuses)) {
    const anyInvalid = itemStatuses.some(
      (i) =>
        String(i.status || '').toLowerCase() === 'invalid' ||
        String(i.statusCode || '') === '01'
    );
    if (anyInvalid) outcome = 'invalid';
  }

  return {
    outcome,
    fbrInvoiceNumber,
    qrCodeData,
    validationResponse,
    summary: `${validationResponse.status || 'n/a'} (${validationResponse.statusCode || 'n/a'})`,
  };
}

module.exports = {
  ALLOWED_FIELDS,
  EDITABLE_STATUSES,
  STATUS,
  pickInvoiceFields,
  normalizeInvoiceFields,
  normalizeItem,
  computeTotals,
  calcItemLineTotal,
  validateInvoiceData,
  buildFbrPayload,
  interpretFbrValidation,
};
