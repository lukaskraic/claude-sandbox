#!/bin/bash
set -e

APP_DIR="/srv/claude-sandbox/app"
SRC_DIR="/home/licencieclaude13/work/claude-sandbox"

echo "Deploying claude-sandbox..."

# Copy all server dist files
rm -rf "$APP_DIR/packages/server/dist"
cp -r "$SRC_DIR/packages/server/dist" "$APP_DIR/packages/server/"

# Copy frontend files
rm -rf "$APP_DIR/packages/web/dist"
cp -r "$SRC_DIR/packages/web/dist" "$APP_DIR/packages/web/"

# Create standalone package.json for production (no workspace deps)
cat > "$APP_DIR/packages/server/package.json" << 'PKGJSON'
{
  "name": "@claude-sandbox/server",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@trpc/server": "^10.45.0",
    "better-sqlite3": "^9.4.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dockerode": "^4.0.0",
    "express": "^4.18.2",
    "multer": "^2.0.2",
    "simple-git": "^3.22.0",
    "tar-stream": "^3.1.7",
    "uuid": "^9.0.0",
    "ws": "^8.16.0",
    "zod": "^3.22.0"
  }
}
PKGJSON

# Install production dependencies
cd "$APP_DIR/packages/server"
rm -rf node_modules package-lock.json
/usr/bin/npm install --omit=dev --no-audit --no-fund 2>&1 || true

# Set ownership
chown -R claude-sandbox:claude-sandbox "$APP_DIR"

# Restart service
systemctl restart claude-sandbox

echo "Deploy complete!"
systemctl status claude-sandbox --no-pager | head -5
