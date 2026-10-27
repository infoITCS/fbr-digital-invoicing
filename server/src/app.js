const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const healthRouter = require('./routes/health');
const invoicesRouter = require('./routes/invoices');
const authRouter = require('./routes/auth');
const { requireAuth } = require('./middleware/azureAuth');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigin,
      methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  // Invoice APIs require Microsoft tenant sign-in
  app.use('/api/invoices', requireAuth, invoicesRouter);

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
