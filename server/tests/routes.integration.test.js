const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  setHttpPost,
  resetHttpPost,
} = require('../src/services/fbrService');

// Ensure sandbox env before app load
process.env.FBR_ENVIRONMENT = 'sandbox';
process.env.FBR_API_TOKEN = 'test-token-not-real';
process.env.FBR_VALIDATE_URL =
  'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb';
process.env.FBR_SUBMIT_URL =
  'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.AUTH_DISABLED = 'true';

let mongod;
let app;
let Invoice;
let createApp;

const sampleBody = {
  invoiceType: 'Sale Invoice',
  invoiceDate: '2025-06-30',
  scenarioId: 'SN005',
  invoiceRefNo: '',
  sellerNTNCNIC: '3670038',
  sellerBusinessName: 'ITCS (IT CONSULTING AND SERVICES)',
  sellerProvince: 'CAPITAL TERRITORY',
  sellerAddress: 'Islamabad, Pakistan',
  buyerNTNCNIC: '1000000000000',
  buyerBusinessName: 'Buyer Co',
  buyerProvince: 'Sindh',
  buyerAddress: 'Karachi',
  buyerRegistrationType: 'Unregistered',
  items: [
    {
      hsCode: '0102.2930',
      productDescription: 'product',
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

async function jsonRequest(method, path, body) {
  const http = require('http');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const result = await new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(payload
              ? { 'Content-Length': Buffer.byteLength(payload) }
              : {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            let parsed = null;
            try {
              parsed = data ? JSON.parse(data) : null;
            } catch {
              parsed = data;
            }
            resolve({ status: res.statusCode, body: parsed });
          });
        }
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
    return result;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('API integration (mocked FBR)', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    await mongoose.connect(process.env.MONGODB_URI);
    ({ createApp } = require('../src/app'));
    app = createApp();
    Invoice = require('../src/models/Invoice');
  });

  after(async () => {
    resetHttpPost();
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    resetHttpPost();
    await Invoice.deleteMany({});
  });

  it('GET /api/health reports sandbox readiness without secrets', async () => {
    const res = await jsonRequest('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.environment, 'SANDBOX');
    assert.equal(res.body.config.fbrTokenConfigured, true);
    assert.equal(res.body.config.validateEndpoint, 'validateinvoicedata_sb');
    const text = JSON.stringify(res.body);
    assert.equal(text.includes('test-token-not-real'), false);
    // Field names may mention Bearer (e.g. fbrTokenHadBearerPrefix); the secret must not appear
    assert.equal(text.includes('Authorization'), false);
  });

  it('POST /api/invoices saves draft and PUT updates it', async () => {
    const created = await jsonRequest('POST', '/api/invoices', sampleBody);
    assert.equal(created.status, 201);
    assert.equal(created.body.invoice.status, 'draft');
    assert.ok(created.body.invoice._id);
    assert.equal(created.body.invoice.totals.valueSalesExcludingST, 1000);

    const id = created.body.invoice._id;
    const updated = await jsonRequest('PUT', `/api/invoices/${id}`, {
      ...sampleBody,
      buyerBusinessName: 'Buyer Updated',
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.invoice.buyerBusinessName, 'Buyer Updated');
    assert.equal(updated.body.invoice.status, 'draft');
  });

  it('validate persists FBR response and sets validated / validation_failed', async () => {
    const created = await jsonRequest('POST', '/api/invoices', sampleBody);
    const id = created.body.invoice._id;

    setHttpPost(async () => ({
      status: 200,
      data: {
        invoiceNumber: null,
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

    const validated = await jsonRequest(
      'POST',
      `/api/invoices/${id}/validate`,
      {}
    );
    assert.equal(validated.status, 200);
    assert.equal(validated.body.invoice.status, 'validated');
    assert.ok(validated.body.fbrResponse);

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

    // reset to draft via put then fail validate
    await jsonRequest('PUT', `/api/invoices/${id}`, sampleBody);
    const failed = await jsonRequest(
      'POST',
      `/api/invoices/${id}/validate`,
      {}
    );
    assert.equal(failed.status, 422);
    assert.equal(failed.body.invoice.status, 'validation_failed');
    assert.equal(
      failed.body.fbrResponse.validationResponse.errorCode,
      '0091'
    );
  });

  it('submit requires validated status and blocks duplicates / unknown', async () => {
    const created = await jsonRequest('POST', '/api/invoices', sampleBody);
    const id = created.body.invoice._id;

    const blocked = await jsonRequest('POST', `/api/invoices/${id}/submit`, {});
    assert.equal(blocked.status, 409);

    setHttpPost(async () => ({
      status: 200,
      data: {
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
    await jsonRequest('POST', `/api/invoices/${id}/validate`, {});

    setHttpPost(async () => ({
      status: 200,
      data: {
        invoiceNumber: 'SBX-SUBMIT-99',
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
              invoiceNo: 'SBX-SUBMIT-99-1',
              error: '',
            },
          ],
        },
      },
    }));

    const submitted = await jsonRequest(
      'POST',
      `/api/invoices/${id}/submit`,
      {}
    );
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.invoice.status, 'submitted');
    assert.equal(submitted.body.invoice.fbrInvoiceNumber, 'SBX-SUBMIT-99');
    assert.match(submitted.body.message, /submitted successfully/i);

    const dup = await jsonRequest('POST', `/api/invoices/${id}/submit`, {});
    assert.equal(dup.status, 409);
  });

  it('timeout on submit sets submission_unknown and blocks retry', async () => {
    const created = await jsonRequest('POST', '/api/invoices', sampleBody);
    const id = created.body.invoice._id;

    setHttpPost(async () => ({
      status: 200,
      data: {
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
    await jsonRequest('POST', `/api/invoices/${id}/validate`, {});

    setHttpPost(async () => {
      const err = new Error('timeout');
      err.code = 'ECONNABORTED';
      throw err;
    });

    const timedOut = await jsonRequest(
      'POST',
      `/api/invoices/${id}/submit`,
      {}
    );
    assert.equal(timedOut.status, 504);
    assert.equal(timedOut.body.invoice.status, 'submission_unknown');
    assert.equal(timedOut.body.error.uncertain, true);

    const retry = await jsonRequest('POST', `/api/invoices/${id}/submit`, {});
    assert.equal(retry.status, 409);
  });
});
