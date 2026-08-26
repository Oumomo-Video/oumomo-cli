import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runAuthLogout, runAuthStatus } from '../src/auth-command.js';
import { writeCredential } from '../src/credentials.js';

interface StdoutCapture {
  value: string;
  restore: () => void;
}

function captureStdout(): StdoutCapture {
  const original = process.stdout;
  const buffer = { value: '' };
  const stream = {
    isTTY: false,
    write(chunk: string) { buffer.value += chunk; return true; },
  };
  Object.defineProperty(process, 'stdout', { value: stream, configurable: true });
  return {
    get value() { return buffer.value; },
    restore: () => Object.defineProperty(process, 'stdout', { value: original, configurable: true }),
  };
}

test('auth status is structured JSON when the credential exists', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-auth-ok-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
  await writeCredential({
    apiBaseUrl: 'https://test.oumomo.ai',
    cookie: 'token_test=opaque',
    email: 'cli@example.com',
    operatorId: '42',
    merchantId: 'merchant_42',
  }, { env: process.env });

  const out = captureStdout();
  t.after(() => out.restore());
  await runAuthStatus();
  const parsed = JSON.parse(out.value);
  assert.equal(parsed.authenticated, true);
  assert.equal(parsed.account, 'cli@example.com');
  assert.equal(parsed.apiBaseUrl, 'https://test.oumomo.ai');
  assert.equal(parsed.operatorId, '42');
  assert.equal(parsed.merchantId, 'merchant_42');
});

test('auth status exits 1 when there is no credential', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-auth-none-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
  const out = captureStdout();
  t.after(() => out.restore());

  await assert.rejects(() => runAuthStatus(), /No Oumomo CLI session/);
  const parsed = JSON.parse(out.value);
  assert.equal(parsed.authenticated, false);
});

test('auth logout removes the credential', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-auth-logout-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
  await writeCredential({
    apiBaseUrl: 'https://test.oumomo.ai',
    cookie: 'token_test=opaque',
    email: 'cli@example.com',
  }, { env: process.env });

  const out = captureStdout();
  t.after(() => out.restore());
  await runAuthLogout();
  assert.match(out.value, /Signed out/);
  const { readCredential } = await import('../src/credentials.js');
  assert.equal(await readCredential({ env: process.env }), undefined);
});
