import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// We test the demo app's Express server by importing it as a module.
// Since demo app uses require() and starts listening, we'll test via HTTP
// against a mock setup.

// Instead of importing the CJS app directly, we test the API contract
// by spawning the server as a subprocess with a mock PostgreSQL.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_JS = path.join(__dirname, '..', 'demo', 'backend', 'server.js');
const FRONTEND_HTML = path.join(__dirname, '..', 'demo', 'frontend', 'index.html');

// --- Mock PostgreSQL server ---
// We create a tiny TCP server that speaks enough PG wire protocol to satisfy pg client init.
// Actually, let's use a simpler approach: test with env that makes pg fail gracefully.

const TEST_PORT = 39876;

describe('Demo App - /api/hello endpoint', () => {
  let proc;
  let baseUrl;

  before(async () => {
    baseUrl = `http://127.0.0.1:${TEST_PORT}`;

    proc = spawn('node', [SERVER_JS], {
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        POSTGRES_HOST: '127.0.0.1',
        POSTGRES_PORT: '59999', // nonexistent - will fail gracefully
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Wait for server to start (it starts even without DB)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 10000);
      let output = '';
      proc.stdout.on('data', (d) => {
        output += d.toString();
        if (output.includes('Demo app running')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      proc.stderr.on('data', (d) => {
        output += d.toString();
      });
      proc.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}: ${output}`));
      });
    });
  });

  after(() => {
    if (proc) proc.kill('SIGTERM');
  });

  it('GET /api/hello returns 200 with message', async () => {
    const res = await fetch(`${baseUrl}/api/hello`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.message, 'Hello from Claude Sandbox!');
    assert.ok(body.timestamp);
    assert.ok(body.node_version);
  });

  it('GET /api/hello returns valid ISO timestamp', async () => {
    const res = await fetch(`${baseUrl}/api/hello`);
    const body = await res.json();
    const parsed = new Date(body.timestamp);
    assert.ok(!isNaN(parsed.getTime()), 'timestamp should be valid ISO date');
  });

  it('GET /api/hello returns current node version', async () => {
    const res = await fetch(`${baseUrl}/api/hello`);
    const body = await res.json();
    assert.equal(body.node_version, process.version);
  });

  it('GET / serves index.html', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Claude Sandbox Demo'));
    assert.ok(text.includes('</html>'));
  });

  it('GET /api/messages returns 500 when DB unavailable', async () => {
    const res = await fetch(`${baseUrl}/api/messages`);
    // Without DB, should return 500 with error
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('POST /api/messages returns 500 when DB unavailable', async () => {
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test' }),
    });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('POST /api/messages validates empty text', async () => {
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'text is required');
  });

  it('POST /api/messages validates missing text', async () => {
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'text is required');
  });

  it('POST /api/messages validates whitespace-only text', async () => {
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '   ' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'text is required');
  });

  it('POST /api/messages validates non-string text', async () => {
    const res = await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 123 }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'text is required');
  });
});

describe('Demo App - Static files', () => {
  it('frontend/index.html exists and is valid HTML', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(FRONTEND_HTML, 'utf-8');
    assert.ok(content.includes('<!DOCTYPE html>'), 'should have DOCTYPE');
    assert.ok(content.includes('<html'), 'should have html tag');
    assert.ok(content.includes('</html>'), 'should have closing html tag');
    assert.ok(content.includes('<head>'), 'should have head tag');
    assert.ok(content.includes('</head>'), 'should have closing head tag');
    assert.ok(content.includes('<body>'), 'should have body tag');
    assert.ok(content.includes('</body>'), 'should have closing body tag');
  });

  it('frontend uses safe DOM methods (no innerHTML)', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(FRONTEND_HTML, 'utf-8');
    // Extract only script content for check
    const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, 'should have script tag');
    const scriptContent = scriptMatch[1];
    assert.ok(!scriptContent.includes('innerHTML'), 'should not use innerHTML in JS');
  });

  it('frontend references correct API endpoints', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(FRONTEND_HTML, 'utf-8');
    assert.ok(content.includes("fetch('/api/hello')"), 'should call /api/hello');
    assert.ok(content.includes("fetch('/api/messages'"), 'should call /api/messages');
  });

  it('package.json is valid and has required deps', async () => {
    const fs = await import('node:fs/promises');
    const pkgPath = path.join(__dirname, '..', 'demo', 'backend', 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    assert.equal(pkg.name, 'demo-hello-world');
    assert.ok(pkg.dependencies.express, 'should depend on express');
    assert.ok(pkg.dependencies.pg, 'should depend on pg');
    assert.equal(pkg.main, 'server.js');
  });
});
