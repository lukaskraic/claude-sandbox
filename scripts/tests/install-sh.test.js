import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INSTALL_SH = path.join(__dirname, '..', 'install.sh');

describe('install.sh - shellcheck', () => {
  it('passes shellcheck', () => {
    try {
      execFileSync('shellcheck', ['-s', 'bash', '-e', 'SC1091', INSTALL_SH], { encoding: 'utf-8' });
    } catch (e) {
      assert.fail(`shellcheck errors:\n${e.stdout || e.stderr || e.message}`);
    }
  });
});

describe('install.sh - argument parsing', () => {
  it('fails without --runtime flag', () => {
    try {
      execFileSync('bash', [INSTALL_SH], { encoding: 'utf-8', stdio: 'pipe' });
      assert.fail('should have exited with error');
    } catch (e) {
      const output = (e.stdout || '') + (e.stderr || '');
      assert.ok(output.includes('Missing --runtime'),
        `should mention missing --runtime flag, got: ${output.slice(0, 200)}`);
    }
  });

  it('fails with invalid runtime value', () => {
    try {
      execFileSync('bash', [INSTALL_SH, '--runtime', 'invalid'], { encoding: 'utf-8', stdio: 'pipe' });
      assert.fail('should have exited with error');
    } catch (e) {
      const output = (e.stdout || '') + (e.stderr || '');
      assert.ok(output.includes('podman') || output.includes('docker'),
        `should mention valid runtimes, got: ${output.slice(0, 200)}`);
    }
  });

  it('fails with unknown argument', () => {
    try {
      execFileSync('bash', [INSTALL_SH, '--foo', 'bar'], { encoding: 'utf-8', stdio: 'pipe' });
      assert.fail('should have exited with error');
    } catch (e) {
      const output = (e.stdout || '') + (e.stderr || '');
      assert.ok(output.includes('Unknown argument'),
        `should mention unknown argument, got: ${output.slice(0, 200)}`);
    }
  });
});

describe('install.sh - script structure', () => {
  const content = readFileSync(INSTALL_SH, 'utf-8');

  it('starts with bash shebang', () => {
    assert.ok(content.startsWith('#!/bin/bash'), 'should start with #!/bin/bash');
  });

  it('uses set -euo pipefail', () => {
    assert.ok(content.includes('set -euo pipefail'), 'should use strict mode');
  });

  it('handles both podman and docker runtimes', () => {
    assert.ok(content.includes('podman'), 'should reference podman');
    assert.ok(content.includes('docker'), 'should reference docker');
  });

  it('handles both alma and ubuntu OS', () => {
    assert.ok(content.includes('dnf'), 'should have dnf for RHEL-family');
    assert.ok(content.includes('apt'), 'should have apt for Debian-family');
  });

  it('creates systemd service', () => {
    assert.ok(content.includes('claude-sandbox.service'), 'should create systemd unit');
    assert.ok(content.includes('systemctl daemon-reload'), 'should reload systemd');
    assert.ok(content.includes('systemctl enable'), 'should enable service');
  });

  it('sets correct environment variables in service', () => {
    assert.ok(content.includes('CONTAINER_RUNTIME=$RUNTIME'), 'should set CONTAINER_RUNTIME');
    assert.ok(content.includes('CONTAINER_SOCKET=$CONTAINER_SOCKET'), 'should set CONTAINER_SOCKET');
    assert.ok(content.includes('HOST=0.0.0.0'), 'should bind to 0.0.0.0');
    assert.ok(content.includes('PORT=3020'), 'should use port 3020');
  });

  it('runs health check after start', () => {
    assert.ok(content.includes('curl') && content.includes('/health'), 'should health check');
  });

  it('installs Node.js 20', () => {
    assert.ok(content.includes('setup_20.x'), 'should install Node 20');
  });

  it('installs Claude Code', () => {
    assert.ok(content.includes('@anthropic-ai/claude-code'), 'should install Claude Code');
  });

  it('creates service user', () => {
    assert.ok(content.includes('useradd'), 'should create claude-sandbox user');
  });

  it('sets ACL permissions', () => {
    assert.ok(content.includes('setfacl'), 'should set ACL');
    assert.ok(content.includes('.claude'), 'should ACL .claude dir');
  });

  it('configures correct socket paths per runtime', () => {
    assert.ok(content.includes('/run/podman/podman.sock'), 'podman socket path');
    assert.ok(content.includes('/var/run/docker.sock'), 'docker socket path');
  });

  it('checks for pre-built dist before deploying', () => {
    assert.ok(content.includes('packages/server/dist'), 'should check server dist');
    assert.ok(content.includes('packages/web/dist'), 'should check web dist');
  });
});
