const mongoose = require('mongoose');
const { STATUS } = require('../utils/invoicePayload');

const invoiceItemSchema = new mongoose.Schema(
  {
    hsCode: { type: String, default: '' },
    productDescription: { type: String, default: '' },
    rate: { type: String, default: '' },
    uoM: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    totalValues: { type: Number, default: 0 },
    valueSalesExcludingST: { type: Number, default: 0 },
    fixedNotifiedValueOrRetailPrice: { type: Number, default: 0 },
    salesTaxApplicable: { type: Number, default: 0 },
    salesTaxWithheldAtSource: { type: Number, default: 0 },
    // Mixed: FBR sandbox SN005 sample uses "" ; numeric also allowed per form
    extraTax: { type: mongoose.Schema.Types.Mixed, default: '' },
    furtherTax: { type: Number, default: 0 },
    sroScheduleNo: { type: String, default: '' },
    fedPayable: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    saleType: { type: String, default: '' },
    sroItemSerialNo: { type: String, default: '' },
  },
  { _id: false }
);

const httpExchangeSchema = new mongoose.Schema(
  {
    httpStatus: { type: Number, default: null },
    body: { type: mongoose.Schema.Types.Mixed, default: null },
    at: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    endpoint: { type: String, default: null },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceType: { type: String, default: 'Sale Invoice' },
    invoiceDate: { type: String, default: '' },
    scenarioId: { type: String, default: '' },
    invoiceRefNo: { type: String, default: '' },

    sellerNTNCNIC: { type: String, default: '' },
    sellerBusinessName: { type: String, default: '' },
    sellerProvince: { type: String, default: '' },
    sellerAddress: { type: String, default: '' },

    buyerNTNCNIC: { type: String, default: '' },
    buyerBusinessName: { type: String, default: '' },
    buyerProvince: { type: String, default: '' },
    buyerAddress: { type: String, default: '' },
    buyerRegistrationType: { type: String, default: 'Registered' },

    items: { type: [invoiceItemSchema], default: [] },

    /** Server-computed totals — never trust client-only values for status decisions */
    totals: {
      valueSalesExcludingST: { type: Number, default: 0 },
      salesTaxApplicable: { type: Number, default: 0 },
      furtherTax: { type: Number, default: 0 },
      extraTax: { type: Number, default: 0 },
      fedPayable: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      salesTaxWithheldAtSource: { type: Number, default: 0 },
      totalValues: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.DRAFT,
    },

    /**
     * FBR-returned invoice number only (from response.invoiceNumber).
     * Never copy from invoiceRefNo or MongoDB _id.
     */
    fbrInvoiceNumber: { type: String, default: null },
    qrCodeData: { type: mongoose.Schema.Types.Mixed, default: null },

    /** Snapshot of FBR environment used for this invoice (sandbox | production) */
    fbrEnvironment: { type: String, default: 'sandbox' },

    /** Exact JSON body sent to FBR validate (no auth headers / tokens) */
    validationRequestPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    validationResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    validationHttpStatus: { type: Number, default: null },
    validatedAt: { type: Date, default: null },

    /** Exact JSON body sent to FBR submit (no auth headers / tokens) */
    submissionRequestPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    submissionResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    submissionHttpStatus: { type: Number, default: null },
    submittedAt: { type: Date, default: null },

    lastFbrExchange: { type: httpExchangeSchema, default: undefined },
    lastError: { type: mongoose.Schema.Types.Mixed, default: null },

    submissionLocked: { type: Boolean, default: false },
    submissionAttemptAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
