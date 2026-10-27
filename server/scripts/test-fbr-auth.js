/**
 * Live sandbox AUTH check only — validate endpoint, no submit.
 * Never logs the token.
 */
const axios = require('axios');
const { env } = require('../src/config/env');
const {
  buildAuthorizationHeader,
  getTokenDiagnostics,
} = require('../src/config/token');

async function main() {
  const diag = getTokenDiagnostics();
  console.log('[auth-test] tokenTrimmedLength:', diag.trimmedLength);
  console.log('[auth-test] validateUrl:', env.fbrValidateUrl);

  const auth = buildAuthorizationHeader();
  console.log('[auth-test] Authorization scheme: Bearer');
  console.log('[auth-test] Authorization header length:', auth.length);

  // Minimal SN001-shaped payload — purpose is gateway auth, not scenario pass
  const payload = {
    invoiceType: 'Sale Invoice',
    invoiceDate: '2025-04-21',
    sellerNTNCNIC: '3670038',
    sellerBusinessName: 'ITCS (IT CONSULTING AND SERVICES)',
    sellerProvince: 'CAPITAL TERRITORY',
    sellerAddress: 'Islamabad, Pakistan',
    buyerNTNCNIC: '0712837',
    buyerBusinessName: 'Pak Suzuki Motor Company Ltd.',
    buyerProvince: 'CAPITAL TERRITORY',
    buyerAddress: 'Karachi',
    buyerRegistrationType: 'Registered',
    invoiceRefNo: '',
    scenarioId: 'SN001',
    items: [
      {
        hsCode: '0101.2100',
        productDescription: 'auth probe',
        rate: '18%',
        uoM: 'Numbers, pieces, units',
        quantity: 1,
        totalValues: 0,
        valueSalesExcludingST: 1000,
        fixedNotifiedValueOrRetailPrice: 0,
        salesTaxApplicable: 180,
        salesTaxWithheldAtSource: 0,
        extraTax: '',
        furtherTax: 0,
        sroScheduleNo: '',
        fedPayable: 0,
        discount: 0,
        saleType: 'Goods at standard rate (default)',
        sroItemSerialNo: '',
      },
    ],
  };

  const res = await axios.post(env.fbrValidateUrl, payload, {
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: env.fbrTimeoutMs,
    validateStatus: () => true,
  });

  console.log('[auth-test] HTTP status:', res.status);
  const body = res.data;
  if (body && body.fault) {
    console.log('[auth-test] fault.code:', body.fault.code);
    console.log('[auth-test] fault.message:', body.fault.message);
    console.log('[auth-test] AUTH_RESULT: FAILED');
  } else if (body && body.validationResponse) {
    console.log(
      '[auth-test] validation status:',
      body.validationResponse.status,
      body.validationResponse.statusCode
    );
    console.log(
      '[auth-test] AUTH_RESULT: OK (gateway accepted token; business validation may still fail)'
    );
  } else {
    console.log(
      '[auth-test] response keys:',
      body && typeof body === 'object' ? Object.keys(body) : typeof body
    );
    console.log(
      '[auth-test] AUTH_RESULT:',
      res.status === 401 ? 'FAILED' : 'CHECK_BODY'
    );
  }
}

main().catch((err) => {
  console.error('[auth-test] error:', err.message);
  process.exit(1);
});
