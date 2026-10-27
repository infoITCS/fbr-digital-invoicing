const axios = require('axios');
const { env } = require('../config/env');
const {
  buildAuthorizationHeader,
  describeAuthHeader,
  getTokenDiagnostics,
} = require('../config/token');
const {
  buildFbrPayload,
  interpretFbrValidation,
} = require('../utils/invoicePayload');

/** Injectable for tests — never use real FBR in automated tests */
let httpPost = (url, data, config) => axios.post(url, data, config);

function setHttpPost(fn) {
  httpPost = fn;
}

function resetHttpPost() {
  httpPost = (url, data, config) => axios.post(url, data, config);
}

function authHeaders() {
  return {
    Authorization: buildAuthorizationHeader(), // exactly: Bearer <normalized-token>
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function safeLog(operation, meta = {}) {
  // Never log Authorization, token, or full payload secrets
  const clean = { ...meta };
  delete clean.authorization;
  delete clean.token;
  delete clean.headers;
  console.log(`[FBR] ${operation}`, {
    ...clean,
    at: new Date().toISOString(),
  });
}

function normalizeAxiosError(error, operation) {
  if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
    const err = new Error(`FBR ${operation} request timed out`);
    err.code = 'FBR_TIMEOUT';
    err.status = 504;
    err.uncertain = operation === 'submit';
    err.httpStatus = null;
    err.fbrBody = null;
    err.raw = { message: error.message, code: error.code };
    return err;
  }

  if (error.response) {
    const httpStatus = error.response.status;
    const err = new Error(`FBR ${operation} failed with HTTP ${httpStatus}`);
    err.code =
      httpStatus === 401 || httpStatus === 403
        ? 'FBR_AUTH_ERROR'
        : 'FBR_HTTP_ERROR';
    err.status = httpStatus >= 400 && httpStatus < 600 ? httpStatus : 502;
    err.httpStatus = httpStatus;
    err.fbrBody = error.response.data;
    err.uncertain = false;
    err.raw = { status: httpStatus, data: error.response.data };
    return err;
  }

  if (error.request) {
    const err = new Error(`FBR ${operation} — no response received from FBR`);
    err.code = 'FBR_NO_RESPONSE';
    err.status = 502;
    err.uncertain = operation === 'submit';
    err.httpStatus = null;
    err.fbrBody = null;
    err.raw = { message: error.message };
    return err;
  }

  return error;
}

async function callFbr(operation, url, invoice) {
  const payload = buildFbrPayload(invoice);
  const endpointName =
    operation === 'validate' ? 'validateinvoicedata_sb' : 'postinvoicedata_sb';

  const tokenMeta = getTokenDiagnostics();
  const authMeta = describeAuthHeader();
  safeLog(`${operation}:request`, {
    invoiceId: String(invoice._id),
    endpoint: endpointName,
    url: url,
    scenarioId: payload.scenarioId,
    itemCount: payload.items.length,
    tokenConfigured: tokenMeta.present,
    tokenTrimmedLength: tokenMeta.trimmedLength,
    authScheme: authMeta.scheme,
    authHeaderLength: authMeta.headerLength,
  });

  const started = Date.now();
  try {
    const response = await httpPost(url, payload, {
      headers: authHeaders(),
      timeout: env.fbrTimeoutMs,
      validateStatus: () => true, // interpret body ourselves; still capture HTTP status
    });

    const durationMs = Date.now() - started;
    const httpStatus = response.status;
    const data = response.data;

    // Unexpected HTML/auth gateway bodies
    if (typeof data !== 'object' || data === null) {
      safeLog(`${operation}:response`, {
        invoiceId: String(invoice._id),
        endpoint: endpointName,
        httpStatus,
        durationMs,
        note: 'non-JSON or empty body',
      });
      return {
        httpStatus,
        data,
        durationMs,
        endpoint: endpointName,
        interpretation: interpretFbrValidation(
          typeof data === 'object' ? data : null
        ),
      };
    }

    const interpretation = interpretFbrValidation(data);

    safeLog(`${operation}:response`, {
      invoiceId: String(invoice._id),
      endpoint: endpointName,
      httpStatus,
      durationMs,
      fbrStatus: data?.validationResponse?.status ?? null,
      fbrStatusCode: data?.validationResponse?.statusCode ?? null,
      fbrErrorCode: data?.validationResponse?.errorCode ?? null,
      invoiceNumber: data?.invoiceNumber ?? null,
      outcome: interpretation.outcome,
    });

    return {
      httpStatus,
      data,
      durationMs,
      endpoint: endpointName,
      interpretation,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const normalized = normalizeAxiosError(error, operation);
    safeLog(`${operation}:error`, {
      invoiceId: String(invoice._id),
      endpoint: endpointName,
      durationMs,
      code: normalized.code,
      message: normalized.message,
      httpStatus: normalized.httpStatus ?? null,
      uncertain: Boolean(normalized.uncertain),
    });
    normalized.durationMs = durationMs;
    normalized.endpoint = endpointName;
    throw normalized;
  }
}

async function validateInvoice(invoice) {
  return callFbr('validate', env.fbrValidateUrl, invoice);
}

async function submitInvoice(invoice) {
  return callFbr('submit', env.fbrSubmitUrl, invoice);
}

function formatSafeFbrError(error) {
  return {
    message: error.message,
    code: error.code || 'FBR_ERROR',
    uncertain: Boolean(error.uncertain),
    httpStatus: error.httpStatus ?? null,
    endpoint: error.endpoint || null,
    // Preserve FBR body for UI — never includes our Bearer token
    fbrBody: error.fbrBody ?? null,
  };
}

module.exports = {
  buildFbrPayload,
  validateInvoice,
  submitInvoice,
  interpretFbrValidation,
  formatSafeFbrError,
  setHttpPost,
  resetHttpPost,
};
