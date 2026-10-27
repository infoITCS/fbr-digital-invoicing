const express = require('express');
const mongoose = require('mongoose');
const { getConfigReadiness, env } = require('../config/env');

const router = express.Router();

router.get('/', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbLabels = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const readiness = getConfigReadiness();
  const mongodb = dbLabels[dbState] || 'unknown';
  const ready =
    readiness.environment === 'sandbox' &&
    readiness.mongodbConfigured &&
    readiness.fbrTokenConfigured &&
    readiness.validateUrlIsSandbox &&
    readiness.submitUrlIsSandbox &&
    mongodb === 'connected';

  res.json({
    ok: ready,
    service: 'itcs-fbr-invoicing-server',
    environment: readiness.environment.toUpperCase(),
    mongodb,
    config: {
      mongodbConfigured: readiness.mongodbConfigured,
      fbrTokenConfigured: readiness.fbrTokenConfigured,
      fbrTokenTrimmedLength: readiness.fbrTokenTrimmedLength,
      fbrTokenHadWhitespace: readiness.fbrTokenHadWhitespace,
      fbrTokenHadQuotes: readiness.fbrTokenHadQuotes,
      fbrTokenHadBearerPrefix: readiness.fbrTokenHadBearerPrefix,
      envFileLoaded: readiness.envFileLoaded,
      validateUrlIsSandbox: readiness.validateUrlIsSandbox,
      submitUrlIsSandbox: readiness.submitUrlIsSandbox,
      validateEndpoint: readiness.validateEndpoint,
      submitEndpoint: readiness.submitEndpoint,
      validateUrl: readiness.validateUrl,
      submitUrl: readiness.submitUrl,
      azureAdConfigured: readiness.azureAdConfigured,
      authDisabled: readiness.authDisabled,
      // Never expose the token value, Azure secrets, or Mongo URI
    },
    port: env.port,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
