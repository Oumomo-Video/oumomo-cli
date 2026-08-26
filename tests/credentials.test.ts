import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  clearCredential,
  CredentialError,
  readCredential,
  resolveCredentialPath,
  writeCredential,
} from '../src/credentials.js';

test('writes, reads, and clears a credential round-trip', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-cred-'));
  const env = { ...process.env, OUMOMO_CLI_STATE_DIR: stateDir };
  t.after(() => rm(stateDir, { recursive: true, force: true }));

  await writeCredential({
    apiBaseUrl: 'https://test.oumomo.ai/',
    cookie: 'token_test=opaque',
    email: 'cli@example.com',
    operatorId: '42',
    merchantId: 'merchant_42',
  }, { env });

  const credentialPath = resolveCredentialPath(env);
  const credential = await readCredential({ env });
  assert.equal(credential?.apiBaseUrl, 'https://test.oumomo.ai');
  assert.equal(credential?.cookie, 'token_test=opaque');
  assert.equal(credential?.operatorId, '42');

  if (process.platform !== 'win32') {
    assert.equal((await stat(stateDir)).mode & 0o777, 0o700);
    assert.equal((await stat(credentialPath)).mode & 0o777, 0o600);
    await chmod(credentialPath, 0o644);
    await assert.rejects(() => readCredential({ env }), /broad permissions/);
    await chmod(credentialPath, 0o600);
  }

  await clearCredential({ env });
  assert.equal(await readCredential({ env }), undefined);
});

test('rejects empty cookie and email when writing', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-cred-bad-'));
  const env = { ...process.env, OUMOMO_CLI_STATE_DIR: stateDir };
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  await assert.rejects(
    () => writeCredential({ apiBaseUrl: 'https://test.oumomo.ai', cookie: '', email: '' }, { env }),
    (error: unknown) => error instanceof CredentialError && /required/.test(error.message),
  );
});

test('rejects malformed JSON in the credential file', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-cred-malformed-'));
  const env = { ...process.env, OUMOMO_CLI_STATE_DIR: stateDir };
  const credentialPath = resolveCredentialPath(env);
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(path.dirname(credentialPath), { recursive: true, mode: 0o700 });
  await writeFile(credentialPath, '{ not valid json', { encoding: 'utf8', mode: 0o600 });
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  await assert.rejects(() => readCredential({ env }), /malformed/);
});
