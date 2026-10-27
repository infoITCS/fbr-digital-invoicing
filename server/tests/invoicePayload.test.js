const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildFbrPayload,
  interpretFbrValidation,
  validateInvoiceData,
  computeTotals,
  normalizeItem,
  STATUS,
} = require('../src/utils/invoicePayload');

describe('invoicePayload', () => {
  it('builds FBR payload with official field names and preserves empty extraTax string', () => {
    const invoice = {
      invoiceType: 'Sale Invoice',
      invoiceDate: '2025-06-30',
      sellerNTNCNIC: '3670038',
      sellerBusinessName: 'ITCS (IT CONSULTING AND SERVICES)',
      sellerProvince: 'CAPITAL TERRITORY',
      sellerAddress: 'Islamabad, Pakistan',
      buyerNTNCNIC: '1000000000000',
      buyerBusinessName: 'Buyer Co',
      buyerProvince: 'Sindh',
      buyerAddress: 'Karachi',
      buyerRegistrationType: 'Unregistered',
      invoiceRefNo: '',
      scenarioId: 'SN005',
      items: [
        normalizeItem({
          hsCode: '0102.2930',
          productDescription: 'Test',
          rate: '1%',
          uoM: 'Numbers, pieces, units',
          quantity: 1,
          totalValues: 0,
          valueSalesExcludingST: 1000,
          fixedNotifiedValueOrRetailPrice: 0,
          salesTaxApplicable: 10,
          salesTaxWithheldAtSource: 0,
          extraTax: '',
          furtherTax: 120,
          sroScheduleNo: 'EIGHTH SCHEDULE Table 1',
          fedPayable: 0,
          discount: 0,
          saleType: 'Goods at Reduced Rate',
          sroItemSerialNo: '82',
        }),
      ],
    };

    const payload = buildFbrPayload(invoice);
    assert.equal(payload.scenarioId, 'SN005');
    assert.equal(payload.items[0].extraTax, '');
    assert.equal(payload.items[0].valueSalesExcludingST, 1000);
    assert.equal(payload.items[0].saleType, 'Goods at Reduced Rate');
  });

  it('does not treat HTTP-shaped body alone — requires Valid + statusCode 00', () => {
    const invalid = interpretFbrValidation({
      dated: '2025-05-13 13:09:05',
      validationResponse: {
        statusCode: '01',
        status: 'Invalid',
        errorCode: '0091',
        error: 'extra tax must be empty',
        invoiceStatuses: null,
      },
    });
    assert.equal(invalid.outcome, 'invalid');

    const valid = interpretFbrValidation({
      invoiceNumber: '7000007DI1747119701593',
      dated: '2025-05-13 12:01:41',
      validationResponse: {
        statusCode: '00',
        status: 'Valid',
        error: '',
        invoiceStatuses: [
          {
            itemSNo: '1',
            statusCode: '00',
            status: 'Valid',
            invoiceNo: '7000007DI1747119701593-1',
            errorCode: '',
            error: '',
          },
        ],
      },
    });
    assert.equal(valid.outcome, 'valid');
    assert.equal(valid.fbrInvoiceNumber, '7000007DI1747119701593');
  });

  it('marks invalid when any item status is Invalid even if header looks ok', () => {
    const result = interpretFbrValidation({
      validationResponse: {
        statusCode: '00',
        status: 'invalid',
        error: '',
        invoiceStatuses: [
          {
            itemSNo: '1',
            statusCode: '01',
            status: 'Invalid',
            errorCode: '0300',
            error: 'Provide ExtraTax',
          },
        ],
      },
    });
    assert.equal(result.outcome, 'invalid');
  });

  it('validates required fields server-side', () => {
    const errors = validateInvoiceData({
      invoiceType: 'Sale Invoice',
      invoiceDate: '2025-01-01',
      scenarioId: 'SN005',
      sellerNTNCNIC: '3670038',
      sellerBusinessName: 'ITCS',
      sellerProvince: 'CAPITAL TERRITORY',
      sellerAddress: 'Islamabad',
      buyerBusinessName: 'Buyer',
      buyerProvince: 'PUNJAB',
      buyerAddress: 'Lahore',
      buyerRegistrationType: 'Registered',
      buyerNTNCNIC: '',
      items: [],
    });
    assert.ok(errors.some((e) => e.field === 'buyerNTNCNIC'));
    assert.ok(errors.some((e) => e.field === 'items'));
  });

  it('computes totals on the server', () => {
    const totals = computeTotals([
      {
        valueSalesExcludingST: 1000,
        salesTaxApplicable: 180,
        furtherTax: 0,
        extraTax: '',
        fedPayable: 0,
        discount: 50,
        salesTaxWithheldAtSource: 0,
        totalValues: 1130,
      },
    ]);
    assert.equal(totals.valueSalesExcludingST, 1000);
    assert.equal(totals.salesTaxApplicable, 180);
    assert.equal(totals.discount, 50);
    assert.equal(totals.extraTax, 0);
  });

  it('exposes expected status constants', () => {
    assert.equal(STATUS.DRAFT, 'draft');
    assert.equal(STATUS.SUBMISSION_UNKNOWN, 'submission_unknown');
    assert.equal(STATUS.SUBMITTED, 'submitted');
  });
});
