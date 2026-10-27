/**
 * Single entry for Plesk / production.
 * Starts the Express API and (when client/dist exists) serves the React app
 * from the same process — one Node application, one port.
 *
 * Plesk Node.js:
 *   Application root: httpdocs (this folder after Git deploy)
 *   Application startup file: start.js
 *
 * Before first start (or in post-deploy):
 *   npm run install:all
 *   npm run build
 */
'use strict';

const path = require('path');
const fs = require('fs');

// Prefer server/.env (same loader as the API)
process.chdir(__dirname);

const clientDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  process.env.SERVE_CLIENT = process.env.SERVE_CLIENT || 'true';
  console.log('[start] Serving React build from client/dist');
} else {
  console.warn(
    '[start] client/dist not found — run "npm run build" after install. API-only mode.'
  );
}

require('./server/src/index.js');
