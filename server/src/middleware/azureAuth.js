const { createRemoteJWKSet, jwtVerify } = require('jose');
const { env } = require('../config/env');

/** Cache JWKS fetchers */
const jwksByUrl = new Map();

function getJwks(tenantId, version) {
  const url =
    version === 'v1'
      ? `https://login.microsoftonline.com/${tenantId}/discovery/keys`
      : `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
  if (!jwksByUrl.has(url)) {
    jwksByUrl.set(url, createRemoteJWKSet(new URL(url)));
  }
  return jwksByUrl.get(url);
}

function expectedAudiences() {
  const audiences = new Set();
  if (env.azureAdAudience) audiences.add(env.azureAdAudience);
  if (env.azureAdClientId) {
    audiences.add(env.azureAdClientId);
    audiences.add(`api://${env.azureAdClientId}`);
  }
  return [...audiences];
}

/**
 * Verify Microsoft Entra ID access/ID token.
 * Enforces single-tenant: tid must match AZURE_AD_TENANT_ID.
 */
async function verifyMicrosoftToken(token) {
  if (!env.azureAdTenantId || !env.azureAdClientId) {
    const err = new Error('Microsoft Entra ID is not configured on the server');
    err.status = 500;
    err.code = 'AZURE_AD_NOT_CONFIGURED';
    throw err;
  }

  const tenantId = env.azureAdTenantId;
  const attempts = [
    {
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      jwks: getJwks(tenantId, 'v2'),
    },
    {
      issuer: `https://sts.windows.net/${tenantId}/`,
      jwks: getJwks(tenantId, 'v1'),
    },
  ];
  const audiences = expectedAudiences();
  let lastError;

  for (const attempt of attempts) {
    try {
      const { payload } = await jwtVerify(token, attempt.jwks, {
        issuer: attempt.issuer,
        audience: audiences,
        clockTolerance: 60,
      });

      const tid = payload.tid || payload.tenantId;
      if (tid !== env.azureAdTenantId) {
        const err = new Error(
          'Access denied: account is outside the allowed ITCS Microsoft tenant'
        );
        err.status = 403;
        err.code = 'TENANT_NOT_ALLOWED';
        throw err;
      }

      return {
        oid: payload.oid || payload.sub,
        tid,
        name: payload.name || null,
        email:
          payload.preferred_username ||
          payload.upn ||
          payload.email ||
          null,
        roles: payload.roles || [],
      };
    } catch (err) {
      if (err.code === 'TENANT_NOT_ALLOWED') throw err;
      lastError = err;
    }
  }

  const err = new Error('Invalid or expired Microsoft sign-in token');
  err.status = 401;
  err.code = 'INVALID_MICROSOFT_TOKEN';
  err.cause = lastError;
  throw err;
}

function requireAuth(req, res, next) {
  if (env.authDisabled) {
    req.user = { oid: 'auth-disabled', tid: 'local', name: 'Dev', email: null };
    return next();
  }

  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({
      message: 'Sign in with Microsoft required',
      code: 'AUTH_REQUIRED',
    });
  }

  verifyMicrosoftToken(match[1].trim())
    .then((user) => {
      req.user = user;
      next();
    })
    .catch((err) => {
      const status = err.status || 401;
      console.warn('[auth]', err.code || 'AUTH_ERROR', err.message);
      res.status(status).json({
        message: err.message,
        code: err.code || 'AUTH_ERROR',
      });
    });
}

module.exports = { requireAuth, verifyMicrosoftToken };
