#!/bin/bash
# Paste these commands into Plesk → Git → "Enable additional deploy actions"
# (or run manually via SSH after each pull).
#
# Working directory is usually the deployment directory (httpdocs).

set -e

echo "[plesk] Installing server dependencies..."
npm install --prefix server --omit=dev

echo "[plesk] Installing client dependencies..."
npm install --prefix client

echo "[plesk] Building React app..."
npm run build --prefix client

echo "[plesk] Done. Restart the Node.js app in Plesk if it does not auto-restart."
