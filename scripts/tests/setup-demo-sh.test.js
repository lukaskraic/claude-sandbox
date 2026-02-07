import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETUP_SH = path.join(__dirname, '..', 'setup-demo.sh');

describe('setup-demo.sh - shellcheck', () => {
  it('passes shellcheck', () => {
    try {
      execFileSync('shellcheck', ['-s', 'bash', SETUP_SH], { encoding: 'utf-8' });
    } catch (e) {
      assert.fail(`shellcheck errors:\n${e.stdout || e.stderr || e.message}`);
    }
  });
});

describe('setup-demo.sh - script structure', () => {
  const content = readFileSync(SETUP_SH, 'utf-8');

  it('starts with bash shebang', () => {
    assert.ok(content.startsWith('#!/bin/bash'), 'should start with #!/bin/bash');
  });

  it('uses set -euo pipefail', () => {
    assert.ok(content.includes('set -euo pipefail'), 'should use strict mode');
  });

  it('checks service health before proceeding', () => {
    assert.ok(content.includes('curl') && content.includes('/health'),
      'should check service health at startup');
  });

  it('creates git repo with demo files', () => {
    assert.ok(content.includes('git init'), 'should init git repo');
    assert.ok(content.includes('git') && content.includes('commit'), 'should make initial commit');
  });

  it('creates project via tRPC API', () => {
    assert.ok(content.includes('project.create'), 'should call project.create');
    assert.ok(content.includes('demo-hello-world'), 'should use demo-hello-world name');
  });

  it('configures correct services', () => {
    assert.ok(content.includes('"type": "postgres"'), 'should configure postgres');
    assert.ok(content.includes('"version": "16"'), 'should use postgres 16');
  });

  it('configures Node 20 runtime', () => {
    assert.ok(content.includes('"node": "20"'), 'should configure node 20');
  });

  it('configures port 3000', () => {
    assert.ok(content.includes('3000'), 'should expose port 3000');
  });

  it('creates and starts session', () => {
    assert.ok(content.includes('session.create'), 'should call session.create');
    assert.ok(content.includes('session.start'), 'should call session.start');
  });

  it('is idempotent - checks if project exists', () => {
    assert.ok(content.includes('project.getByName'), 'should check for existing project');
    assert.ok(content.includes('already exists'), 'should handle existing project');
  });

  it('sets correct API base URL', () => {
    assert.ok(content.includes('localhost:3020'), 'should target port 3020');
  });

  it('uses setup script to install deps and start the demo app', () => {
    assert.ok(content.includes('npm install'), 'setup should install deps');
    assert.ok(content.includes('node server.js'), 'setup should start the server');
    assert.ok(content.includes('setsid'), 'setup should daemonize server with setsid');
  });
});
