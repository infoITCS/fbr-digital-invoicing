const path = require('path');
const fs = require('fs');
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

  const serveClient =
    String(process.env.SERVE_CLIENT || '').toLowerCase() === 'true';

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

  // Production / Plesk: same Node process serves API + built React SPA
  if (serveClient) {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(clientDist, 'index.html'), (err) => {
          if (err) next(err);
        });
      });
    }
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
