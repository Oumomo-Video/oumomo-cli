import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parseCliArgs } from '../src/cli-args.js';
import { runSetup } from '../src/setup-command.js';

interface CapturedStream {
  buffer: string;
  write(chunk: string): boolean;
}

function captureStream(target: 'stdout' | 'stderr'): { stream: CapturedStream; restore: () => void } {
  const original = process[target];
  const stream: CapturedStream = {
    buffer: '',
    write(chunk: string) {
      this.buffer += chunk;
      return true;
    },
  };
  Object.defineProperty(process, target, { value: stream, configurable: true });
  return { stream, restore: () => Object.defineProperty(process, target, { value: original, configurable: true }) };
}

test('setup completes when the device flow returns a token', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-setup-'));
  const previousStateDir = process.env.OUMOMO_CLI_STATE_DIR;
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  process.env.OUMOMO_CLI_BROWSER = 'skip';
  t.after(async () => {
    if (previousStateDir === undefined) delete process.env.OUMOMO_CLI_STATE_DIR;
    else process.env.OUMOMO_CLI_STATE_DIR = previousStateDir;
    delete process.env.OUMOMO_CLI_BROWSER;
    await rm(stateDir, { recursive: true, force: true });
  });

  const stdoutCapture = captureStream('stdout');
  const stderrCapture = captureStream('stderr');
  t.after(() => {
    stdoutCapture.restore();
    stderrCapture.restore();
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/oauth/device/code')) {
      return new Response(JSON.stringify({
        device_code: 'device-1',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://api.example.test/api/oauth/device',
        verification_uri_complete: 'https://api.example.test/api/oauth/device?user_code=ABCD-EFGH',
        expires_in: 600,
        interval: 1,
      }), { status: 200 });
    }
    if (url.endsWith('/api/oauth/token')) {
      return new Response(JSON.stringify({
        access_token: 'access-1',
        token_type: 'Bearer',
        expires_in: 3600,
        session_cookie: 'token_prod=session-1',
        account: 'cli@example.com',
        operator_id: 11,
        merchant_id: 110,
      }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const args = parseCliArgs(['setup', '--api-url', 'https://api.example.test']);
  await runSetup(args);

  assert.ok(stdoutCapture.stream.buffer.includes('cli@example.com'), 'should print the authenticated email');
  const { readCredential } = await import('../src/credentials.js');
  const credential = await readCredential({ env: process.env });
  assert.equal(credential?.cookie, 'token_prod=session-1');
  assert.equal(credential?.operatorId, '11');
});
