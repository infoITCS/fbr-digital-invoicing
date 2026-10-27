/**
 * Safe FBR auth diagnostics — never prints the token value.
 * Usage: node scripts/diagnose-fbr-auth.js
 * Does NOT call FBR.
 */
const path = require('path');
const fs = require('fs');

const serverEnvPath = path.resolve(__dirname, '../.env');
const rootEnvPath = path.resolve(__dirname, '../../.env');

function inspectEnvFile(label, filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[file] ${label}: MISSING (${filePath})`);
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  let tokenRaw = null;
  const keys = [];
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1);
    keys.push(k);
    if (k === 'FBR_API_TOKEN') tokenRaw = v;
  }
  console.log(`[file] ${label}: ${filePath}`);
  console.log(`  keys: ${keys.join(', ')}`);
  if (tokenRaw == null) {
    console.log('  FBR_API_TOKEN: ABSENT');
  } else {
    const trimmed = tokenRaw.trim().replace(/^["']|["']$/g, '');
    console.log(
      `  FBR_API_TOKEN: present rawLen=${tokenRaw.length} trimLen=${trimmed.length}` +
        ` quotes=${/^["']/.test(tokenRaw.trim())}` +
        ` leadWS=${/^\s/.test(tokenRaw)} trailWS=${/\s$/.test(tokenRaw)}` +
        ` bearerPrefix=${/^Bearer\s/i.test(tokenRaw.trim())}`
    );
  }
  return tokenRaw;
}

console.log('=== FBR auth diagnostics (no network, no token value) ===\n');
const serverTok = inspectEnvFile('server/.env', serverEnvPath);
const rootTok = inspectEnvFile('root .env', rootEnvPath);

if (serverTok != null && rootTok != null) {
  const a = serverTok.trim().replace(/^["']|["']$/g, '');
  const b = rootTok.trim().replace(/^["']|["']$/g, '');
  console.log(
    `\n[compare] server vs root token same length? ${a.length === b.length} (server=${a.length}, root=${b.length})`
  );
  console.log(
    `[compare] server vs root token identical? ${a === b ? 'YES' : 'NO — dual .env mismatch'}`
  );
}

// Load app env the same way the server does
const { env, getConfigReadiness } = require('../src/config/env');
const { getNormalizedBearerToken, describeAuthHeader } = require('../src/config/token');

console.log('\n=== Runtime config (after dotenv) ===');
console.log('loadedPrefer:', fs.existsSync(serverEnvPath) ? 'server/.env' : 'root/.env');
console.log('FBR_ENVIRONMENT:', env.fbrEnvironment);
console.log('FBR_VALIDATE_URL:', env.fbrValidateUrl);
console.log('FBR_SUBMIT_URL:', env.fbrSubmitUrl);

const token = getNormalizedBearerToken();
const auth = describeAuthHeader();
console.log('tokenConfigured:', Boolean(token));
console.log('tokenTrimLen:', token.length);
console.log('authScheme:', auth.scheme);
console.log('authHasDoubleBearer:', auth.doubleBearer);
console.log('authHeaderLength:', auth.headerLength);
console.log('readiness:', getConfigReadiness());

const expectedValidate =
  'https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb';
const expectedSubmit =
  'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb';
console.log(
  '\nURL match official sandbox validate?',
  env.fbrValidateUrl === expectedValidate
);
console.log(
  'URL match official sandbox submit?',
  env.fbrSubmitUrl === expectedSubmit
);

if (token.length > 0 && token.length < 40) {
  console.log(
    '\n[warn] Token trim length is unusually short for a PRAL/IRIS security token.' +
      ' Confirm you pasted the full sandbox token (not a truncated copy).'
  );
}

console.log('\nDone. No FBR request was made.');
