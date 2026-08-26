import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runCli } from '../src/bin.js';
import { writeCredential } from '../src/credentials.js';

test('compact tool syntax dispatches to tool call', async () => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-bin-'));
  const originalStateDir = process.env.OUMOMO_CLI_STATE_DIR;
  const originalFetch = globalThis.fetch;
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  await writeCredential({
    apiBaseUrl: 'https://api.example.test',
    cookie: 'token_test=secret',
    email: 'cli@example.test',
  });
  globalThis.fetch = async (_input, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), {
      input: { page: 1 },
      confirm: false,
    });
    return new Response(JSON.stringify({ success: true, result: { items: [] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    assert.equal(await runCli([
      'tool',
      'video_replica_search',
      '--args',
      '{"page":1}',
      '--api-url',
      'https://api.example.test',
    ]), 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStateDir === undefined) delete process.env.OUMOMO_CLI_STATE_DIR;
    else process.env.OUMOMO_CLI_STATE_DIR = originalStateDir;
    await rm(stateDir, { recursive: true, force: true });
  }
});
