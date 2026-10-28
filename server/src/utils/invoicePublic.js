const { env } = require('../config/env');

/**
 * Strip anything that could leak credentials from diagnostic blobs.
 * Request payloads we store never include Authorization; this is defense-in-depth.
 */
function redactSecrets(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (
      lower.includes('authorization') ||
      lower.includes('bearertoken') ||
      lower === 'token' ||
      lower === 'apikey' ||
      lower === 'api_key' ||
      lower === 'password' ||
      lower === 'secret'
    ) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactSecrets(val);
    }
  }
  return out;
}

/**
 * Public invoice DTO for detail views.
 * Keeps invoiceRefNo, fbrInvoiceNumber, and localInvoiceId distinct.
 */
function toPublicInvoiceDetail(doc) {
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const localInvoiceId = String(raw._id);

  const fbrInvoiceNumber =
    raw.fbrInvoiceNumber != null && String(raw.fbrInvoiceNumber).trim() !== ''
      ? String(raw.fbrInvoiceNumber)
      : null;

  // Never treat invoiceRefNo or Mongo id as FBR number
  const safeFbrNumber =
    fbrInvoiceNumber &&
    fbrInvoiceNumber !== localInvoiceId &&
    fbrInvoiceNumber !== String(raw.invoiceRefNo || '')
      ? fbrInvoiceNumber
      : fbrInvoiceNumber && fbrInvoiceNumber === String(raw.invoiceRefNo || '')
        ? null
        : fbrInvoiceNumber;

  return {
    // Keep _id for existing form clients; localInvoiceId is the explicit label
    _id: localInvoiceId,
    localInvoiceId,
    invoiceRefNo: raw.invoiceRefNo || '',
    fbrInvoiceNumber: safeFbrNumber,
    fbrInvoiceNumberDisplay: safeFbrNumber || 'Not returned by FBR',
    environment: (raw.fbrEnvironment || env.fbrEnvironment || 'sandbox').toLowerCase(),
    status: raw.status,

    invoiceType: raw.invoiceType,
    invoiceDate: raw.invoiceDate,
    scenarioId: raw.scenarioId,

    sellerNTNCNIC: raw.sellerNTNCNIC,
    sellerBusinessName: raw.sellerBusinessName,
    sellerProvince: raw.sellerProvince,
    sellerAddress: raw.sellerAddress,

    buyerNTNCNIC: raw.buyerNTNCNIC,
    buyerBusinessName: raw.buyerBusinessName,
    buyerProvince: raw.buyerProvince,
    buyerAddress: raw.buyerAddress,
    buyerRegistrationType: raw.buyerRegistrationType,

    items: Array.isArray(raw.items) ? raw.items : [],
    totals: raw.totals || {},

    qrCodeData: raw.qrCodeData ?? null,

    validationRequestPayload: redactSecrets(raw.validationRequestPayload),
    validationResponse: redactSecrets(raw.validationResponse),
    validationHttpStatus: raw.validationHttpStatus ?? null,
    validatedAt: raw.validatedAt ?? null,

    submissionRequestPayload: redactSecrets(raw.submissionRequestPayload),
    submissionResponse: redactSecrets(raw.submissionResponse),
    submissionHttpStatus: raw.submissionHttpStatus ?? null,
    submittedAt: raw.submittedAt ?? null,

    lastFbrExchange: raw.lastFbrExchange
      ? {
          ...raw.lastFbrExchange,
          body: redactSecrets(raw.lastFbrExchange.body),
        }
      : null,
    lastError: redactSecrets(raw.lastError),

    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function toPublicInvoiceListItem(doc) {
  const detail = toPublicInvoiceDetail(doc);
  return {
    _id: detail.localInvoiceId,
    localInvoiceId: detail.localInvoiceId,
    invoiceRefNo: detail.invoiceRefNo,
    fbrInvoiceNumber: detail.fbrInvoiceNumber,
    fbrInvoiceNumberDisplay: detail.fbrInvoiceNumberDisplay,
    invoiceType: detail.invoiceType,
    invoiceDate: detail.invoiceDate,
    scenarioId: detail.scenarioId,
    buyerNTNCNIC: detail.buyerNTNCNIC,
    buyerBusinessName: detail.buyerBusinessName,
    status: detail.status,
    environment: detail.environment,
    totals: detail.totals,
    itemCount: detail.items.length,
    submittedAt: detail.submittedAt,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

module.exports = {
  redactSecrets,
  toPublicInvoiceDetail,
  toPublicInvoiceListItem,
};
