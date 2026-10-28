const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  toPublicInvoiceDetail,
  redactSecrets,
} = require('../src/utils/invoicePublic');

describe('invoicePublic', () => {
  it('keeps localInvoiceId, invoiceRefNo, and fbrInvoiceNumber distinct', () => {
    const detail = toPublicInvoiceDetail({
      _id: '507f1f77bcf86cd799439011',
      invoiceRefNo: 'REF-100',
      fbrInvoiceNumber: '3670038DIR0FBBG296819',
      invoiceType: 'Sale Invoice',
      invoiceDate: '2026-10-27',
      scenarioId: 'SN001',
      status: 'submitted',
      fbrEnvironment: 'sandbox',
      sellerNTNCNIC: '3670038',
      sellerBusinessName: 'ITCS',
      sellerProvince: 'CAPITAL TERRITORY',
      sellerAddress: 'Islamabad',
      buyerNTNCNIC: '0712837',
      buyerBusinessName: 'Buyer',
      buyerProvince: 'Sindh',
      buyerAddress: 'Karachi',
      buyerRegistrationType: 'Registered',
      items: [
        {
          hsCode: '0101.2100',
          productDescription: 'A',
          rate: '18%',
          uoM: 'Numbers, pieces, units',
          quantity: 1,
          totalValues: 118,
          valueSalesExcludingST: 100,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxApplicable: 18,
          salesTaxWithheldAtSource: 0,
          extraTax: '',
          furtherTax: 0,
          sroScheduleNo: '',
          fedPayable: 0,
          discount: 0,
          saleType: 'Goods at standard rate (default)',
          sroItemSerialNo: '',
        },
        {
          hsCode: '0102.2930',
          productDescription: 'B',
          rate: '1%',
          uoM: 'Kilogram',
          quantity: 2,
          totalValues: 0,
          valueSalesExcludingST: 50,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxApplicable: 0.5,
          salesTaxWithheldAtSource: 0,
          extraTax: '',
          furtherTax: 0,
          sroScheduleNo: 'EIGHTH SCHEDULE Table 1',
          fedPayable: 0,
          discount: 0,
          saleType: 'Goods at Reduced Rate',
          sroItemSerialNo: '82',
        },
      ],
      totals: {
        valueSalesExcludingST: 150,
        salesTaxApplicable: 18.5,
        furtherTax: 0,
        extraTax: 0,
        discount: 0,
        totalValues: 168.5,
      },
      validationRequestPayload: { scenarioId: 'SN001' },
      submissionResponse: { invoiceNumber: '3670038DIR0FBBG296819' },
    });

    assert.equal(detail.localInvoiceId, '507f1f77bcf86cd799439011');
    assert.equal(detail.invoiceRefNo, 'REF-100');
    assert.equal(detail.fbrInvoiceNumber, '3670038DIR0FBBG296819');
    assert.notEqual(detail.fbrInvoiceNumber, detail.invoiceRefNo);
    assert.notEqual(detail.fbrInvoiceNumber, detail.localInvoiceId);
    assert.equal(detail.items.length, 2);
    assert.equal(detail.items[1].hsCode, '0102.2930');
    assert.equal(detail.environment, 'sandbox');
    assert.equal(detail.totals.valueSalesExcludingST, 150);
  });

  it('shows Not returned by FBR when invoice number is missing', () => {
    const detail = toPublicInvoiceDetail({
      _id: '507f1f77bcf86cd799439012',
      invoiceRefNo: 'REF-X',
      fbrInvoiceNumber: null,
      status: 'submitted',
      items: [],
      totals: {},
    });
    assert.equal(detail.fbrInvoiceNumber, null);
    assert.equal(detail.fbrInvoiceNumberDisplay, 'Not returned by FBR');
  });

  it('does not treat invoiceRefNo as fbrInvoiceNumber when wrongly equal', () => {
    const detail = toPublicInvoiceDetail({
      _id: '507f1f77bcf86cd799439013',
      invoiceRefNo: 'SAME',
      fbrInvoiceNumber: 'SAME',
      status: 'submitted',
      items: [],
      totals: {},
    });
    assert.equal(detail.fbrInvoiceNumber, null);
    assert.equal(detail.fbrInvoiceNumberDisplay, 'Not returned by FBR');
  });

  it('redacts authorization-like keys from diagnostic objects', () => {
    const cleaned = redactSecrets({
      Authorization: 'Bearer secret',
      nested: { apiKey: 'x', keep: 1 },
      invoiceNumber: 'OK',
    });
    assert.equal(cleaned.Authorization, '[REDACTED]');
    assert.equal(cleaned.nested.apiKey, '[REDACTED]');
    assert.equal(cleaned.nested.keep, 1);
    assert.equal(cleaned.invoiceNumber, 'OK');
  });
});
