const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateInvoice,
  submitInvoice,
  setHttpPost,
  resetHttpPost,
} = require('../src/services/fbrService');

const sampleInvoice = {
  _id: '507f1f77bcf86cd799439011',
  invoiceType: 'Sale Invoice',
  invoiceDate: '2025-06-30',
  sellerNTNCNIC: '3670038',
  sellerBusinessName: 'ITCS',
  sellerProvince: 'CAPITAL TERRITORY',
  sellerAddress: 'Islamabad',
  buyerNTNCNIC: '1000000000000',
  buyerBusinessName: 'Buyer',
  buyerProvince: 'Sindh',
  buyerAddress: 'Karachi',
  buyerRegistrationType: 'Unregistered',
  invoiceRefNo: '',
  scenarioId: 'SN005',
  items: [
    {
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
    },
  ],
};

describe('fbrService (mocked FBR — no real network)', () => {
  afterEach(() => {
    resetHttpPost();
  });

  it('validate interprets Valid response and records HTTP status', async () => {
    setHttpPost(async () => ({
      status: 200,
      data: {
        invoiceNumber: 'SBX-VALIDATE-1',
        validationResponse: {
          statusCode: '00',
          status: 'Valid',
          error: '',
          invoiceStatuses: [
            { itemSNo: '1', statusCode: '00', status: 'Valid', error: '' },
          ],
        },
      },
    }));

    const result = await validateInvoice(sampleInvoice);
    assert.equal(result.httpStatus, 200);
    assert.equal(result.interpretation.outcome, 'valid');
    assert.equal(result.interpretation.fbrInvoiceNumber, 'SBX-VALIDATE-1');
  });

  it('validate treats Invalid body as invalid even when HTTP 200', async () => {
    setHttpPost(async () => ({
      status: 200,
      data: {
        validationResponse: {
          statusCode: '01',
          status: 'Invalid',
          errorCode: '0091',
          error: 'extra tax must be empty',
        },
      },
    }));

    const result = await validateInvoice(sampleInvoice);
    assert.equal(result.httpStatus, 200);
    assert.equal(result.interpretation.outcome, 'invalid');
  });

  it('submit marks uncertain on timeout', async () => {
    setHttpPost(async () => {
      const err = new Error('timeout of 30000ms exceeded');
      err.code = 'ECONNABORTED';
      throw err;
    });

    await assert.rejects(
      () => submitInvoice(sampleInvoice),
      (err) => {
        assert.equal(err.code, 'FBR_TIMEOUT');
        assert.equal(err.uncertain, true);
        return true;
      }
    );
  });

  it('does not put bearer token into thrown error messages', async () => {
    process.env.FBR_API_TOKEN = process.env.FBR_API_TOKEN || 'secret-test-token-do-not-leak';

    setHttpPost(async (_url, _data, config) => {
      assert.ok(config.headers.Authorization.startsWith('Bearer '));
      assert.equal(
        config.headers.Authorization.includes('secret-test-token-do-not-leak') ||
          config.headers.Authorization.length > 7,
        true
      );
      return {
        status: 401,
        data: { message: 'Unauthorized' },
      };
    });

    // validateStatus accepts all — 401 body still returned as data
    const result = await validateInvoice(sampleInvoice);
    assert.equal(result.httpStatus, 401);
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('secret-test-token-do-not-leak'), false);
  });
});
