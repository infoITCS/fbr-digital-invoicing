const express = require('express');
const { requireAuth } = require('../middleware/azureAuth');
const { env } = require('../config/env');

const router = express.Router();

/** Public: client needs tenant/client IDs for MSAL (never secrets) */
router.get('/config', (_req, res) => {
  res.json({
    enabled: !env.authDisabled && Boolean(env.azureAdTenantId && env.azureAdClientId),
    tenantId: env.azureAdTenantId || null,
    clientId: env.azureAdClientId || null,
    authority: env.azureAdTenantId
      ? `https://login.microsoftonline.com/${env.azureAdTenantId}`
      : null,
  });
});

/** Protected: current signed-in user */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      name: req.user.name,
      email: req.user.email,
      oid: req.user.oid,
      tid: req.user.tid,
    },
  });
});

module.exports = router;
