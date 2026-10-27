const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { getNormalizedBearerToken, getTokenDiagnostics } = require('./token');

const serverEnvPath = path.resolve(__dirname, '../../.env');
const rootEnvPath = path.resolve(__dirname, '../../../.env');

/** Which .env file was loaded (for safe diagnostics only) */
let loadedEnvPath = null;

if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
  loadedEnvPath = serverEnvPath;
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
  loadedEnvPath = rootEnvPath;
} else {
  dotenv.config();
  loadedEnvPath = '(dotenv default cwd)';
}

const SANDBOX_VALIDATE =
  'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb';
const SANDBOX_SUBMIT =
  'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb';

function resolveValidateUrl() {
  if (process.env.FBR_VALIDATE_URL) return process.env.FBR_VALIDATE_URL.trim();
  if (process.env.FBR_BASE_URL || process.env.FBR_VALIDATE_PATH) {
    const base = (process.env.FBR_BASE_URL || 'https://gw.fbr.gov.pk').replace(
      /\/$/,
      ''
    );
    const p =
      process.env.FBR_VALIDATE_PATH ||
      '/di_data/v1/di/validateinvoicedata_sb';
    return `${base}${p.startsWith('/') ? p : `/${p}`}`;
  }
  return SANDBOX_VALIDATE;
}

function resolveSubmitUrl() {
  if (process.env.FBR_SUBMIT_URL) return process.env.FBR_SUBMIT_URL.trim();
  if (process.env.FBR_BASE_URL || process.env.FBR_SUBMIT_PATH) {
    const base = (process.env.FBR_BASE_URL || 'https://gw.fbr.gov.pk').replace(
      /\/$/,
      ''
    );
    const p =
      process.env.FBR_SUBMIT_PATH || '/di_data/v1/di/postinvoicedata_sb';
    return `${base}${p.startsWith('/') ? p : `/${p}`}`;
  }
  return SANDBOX_SUBMIT;
}

/** Live getters so tests / reloads see current process.env */
const env = {
  get port() {
    return Number(process.env.PORT) || 5000;
  },
  get mongodbUri() {
    return process.env.MONGODB_URI || '';
  },
  get clientOrigin() {
    return process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  },
  get fbrEnvironment() {
    return (process.env.FBR_ENVIRONMENT || 'sandbox').toLowerCase();
  },
  get fbrApiToken() {
    // Always return normalized token (trim / strip quotes / strip duplicate Bearer)
    return getNormalizedBearerToken();
  },
  get loadedEnvPath() {
    return loadedEnvPath;
  },
  get fbrValidateUrl() {
    return resolveValidateUrl();
  },
  get fbrSubmitUrl() {
    return resolveSubmitUrl();
  },
  get fbrTimeoutMs() {
    return Number(process.env.FBR_TIMEOUT_MS) || 30000;
  },
  /** Microsoft Entra ID (Azure AD) — single-tenant login */
  get azureAdTenantId() {
    return (process.env.AZURE_AD_TENANT_ID || '').trim();
  },
  get azureAdClientId() {
    return (process.env.AZURE_AD_CLIENT_ID || '').trim();
  },
  get azureAdAudience() {
    return (process.env.AZURE_AD_AUDIENCE || process.env.AZURE_AD_CLIENT_ID || '').trim();
  },
  /** Only for automated tests — never enable in production */
  get authDisabled() {
    return String(process.env.AUTH_DISABLED || '').toLowerCase() === 'true';
  },
};

function isSandboxUrl(url) {
  const u = String(url || '').toLowerCase();
  return u.includes('_sb') || u.includes('sandbox');
}

function assertRequiredConfig() {
  const missing = [];
  if (!env.mongodbUri) missing.push('MONGODB_URI');
  if (!env.fbrApiToken) missing.push('FBR_API_TOKEN');
  if (!env.authDisabled) {
    if (!env.azureAdTenantId) missing.push('AZURE_AD_TENANT_ID');
    if (!env.azureAdClientId) missing.push('AZURE_AD_CLIENT_ID');
  }
  if (missing.length) {
    const err = new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Create server/.env from .env.example and set placeholder values.`
    );
    err.code = 'ENV_MISSING';
    throw err;
  }
}

function assertSafeFbrConfig() {
  if (env.fbrEnvironment !== 'sandbox') {
    throw new Error(
      `FBR_ENVIRONMENT="${env.fbrEnvironment}" is not allowed. ` +
        'This application is sandbox-only until production is explicitly authorized.'
    );
  }

  const validateOk = isSandboxUrl(env.fbrValidateUrl);
  const submitOk = isSandboxUrl(env.fbrSubmitUrl);

  if (!validateOk || !submitOk) {
    throw new Error(
      'Non-sandbox FBR endpoints detected. ' +
        'Configure FBR_VALIDATE_URL and FBR_SUBMIT_URL to sandbox (*_sb) URLs only.'
    );
  }
}

function getConfigReadiness() {
  const tokenDiag = getTokenDiagnostics();
  return {
    environment: env.fbrEnvironment,
    mongodbConfigured: Boolean(env.mongodbUri),
    fbrTokenConfigured: tokenDiag.present && tokenDiag.trimmedLength > 0,
    fbrTokenTrimmedLength: tokenDiag.trimmedLength,
    fbrTokenHadWhitespace: tokenDiag.hadWhitespace,
    fbrTokenHadQuotes: tokenDiag.hadQuotes,
    fbrTokenHadBearerPrefix: tokenDiag.hadBearerPrefix,
    envFileLoaded:
      loadedEnvPath === serverEnvPath
        ? 'server/.env'
        : loadedEnvPath === rootEnvPath
          ? 'project-root/.env'
          : loadedEnvPath,
    validateUrlIsSandbox: isSandboxUrl(env.fbrValidateUrl),
    submitUrlIsSandbox: isSandboxUrl(env.fbrSubmitUrl),
    validateEndpoint: 'validateinvoicedata_sb',
    submitEndpoint: 'postinvoicedata_sb',
    validateUrl: env.fbrValidateUrl,
    submitUrl: env.fbrSubmitUrl,
    azureAdConfigured: Boolean(env.azureAdTenantId && env.azureAdClientId),
    authDisabled: env.authDisabled,
  };
}

function logSafeAuthStartup() {
  const readiness = getConfigReadiness();
  const tokenDiag = getTokenDiagnostics();
  console.log('[config] FBR auth diagnostics (token value never logged)', {
    envFile: readiness.envFileLoaded,
    environment: readiness.environment,
    tokenConfigured: readiness.fbrTokenConfigured,
    tokenTrimmedLength: tokenDiag.trimmedLength,
    tokenHadWhitespace: tokenDiag.hadWhitespace,
    tokenHadQuotes: tokenDiag.hadQuotes,
    tokenHadBearerPrefix: tokenDiag.hadBearerPrefix,
    validateEndpoint: readiness.validateEndpoint,
    submitEndpoint: readiness.submitEndpoint,
    validateUrl: readiness.validateUrl,
    submitUrl: readiness.submitUrl,
    azureAdConfigured: readiness.azureAdConfigured,
    authDisabled: readiness.authDisabled,
  });
}

module.exports = {
  env,
  assertRequiredConfig,
  assertSafeFbrConfig,
  getConfigReadiness,
  isSandboxUrl,
  logSafeAuthStartup,
  serverEnvPath,
  rootEnvPath,
};
