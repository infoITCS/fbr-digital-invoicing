const mongoose = require('mongoose');
const {
  env,
  assertRequiredConfig,
  assertSafeFbrConfig,
  getConfigReadiness,
  logSafeAuthStartup,
} = require('./config/env');
const { createApp } = require('./app');

try {
  assertSafeFbrConfig();
  assertRequiredConfig();
  logSafeAuthStartup();
} catch (err) {
  console.error('[config]', err.message);
  process.exit(1);
}

const app = createApp();

async function start() {
  try {
    await mongoose.connect(env.mongodbUri);
    console.log('[db] Connected to MongoDB');
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    process.exit(1);
  }

  const readiness = getConfigReadiness();

  app.listen(env.port, () => {
    console.log(`[server] ITCS FBR Invoicing API on port ${env.port}`);
    console.log(`[server] FBR environment: ${readiness.environment}`);
    console.log(
      `[server] Endpoints: ${readiness.validateEndpoint}, ${readiness.submitEndpoint}`
    );
    console.log(`[server] CORS origin: ${env.clientOrigin}`);
    console.log(
      `[server] Token configured: ${readiness.fbrTokenConfigured ? 'yes' : 'no'}`
    );
  });
}

start();
