/**
 * Normalize FBR Bearer token from env without logging its value.
 *
 * Handles:
 * - leading/trailing whitespace
 * - wrapping single/double quotes from .env editors
 * - accidental "Bearer " prefix already stored in FBR_API_TOKEN
 */

function getNormalizedBearerToken(raw = process.env.FBR_API_TOKEN) {
  if (raw == null) return '';
  let token = String(raw).trim();
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }
  // If the env value already includes "Bearer ", strip it so we don't send "Bearer Bearer …"
  if (/^Bearer\s+/i.test(token)) {
    token = token.replace(/^Bearer\s+/i, '').trim();
  }
  return token;
}

function buildAuthorizationHeader() {
  const token = getNormalizedBearerToken();
  if (!token) {
    const err = new Error('FBR_API_TOKEN is not configured on the server');
    err.code = 'FBR_TOKEN_MISSING';
    err.status = 500;
    throw err;
  }
  return `Bearer ${token}`;
}

/** Safe metadata only — never includes the token */
function describeAuthHeader() {
  const token = getNormalizedBearerToken();
  const header = token ? `Bearer ${token}` : '';
  return {
    configured: Boolean(token),
    trimmedLength: token.length,
    scheme: token ? 'Bearer' : null,
    doubleBearer: false, // prevented by getNormalizedBearerToken
    headerLength: header.length,
    // Pattern check without revealing value
    looksLikeJwt: token.split('.').length === 3,
  };
}

function getTokenDiagnostics() {
  const raw = process.env.FBR_API_TOKEN;
  const normalized = getNormalizedBearerToken(raw);
  return {
    present: raw != null && String(raw).length > 0,
    rawLength: raw == null ? 0 : String(raw).length,
    trimmedLength: normalized.length,
    hadWhitespace:
      raw != null && String(raw).trim().length !== String(raw).length,
    hadQuotes:
      raw != null &&
      (/^["']/.test(String(raw).trim()) || /["']$/.test(String(raw).trim())),
    hadBearerPrefix:
      raw != null && /^Bearer\s+/i.test(String(raw).trim()),
    looksLikeJwt: normalized.split('.').length === 3,
  };
}

module.exports = {
  getNormalizedBearerToken,
  buildAuthorizationHeader,
  describeAuthHeader,
  getTokenDiagnostics,
};
