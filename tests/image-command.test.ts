import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parseCliArgs } from '../src/cli-args.js';
import { writeCredential } from '../src/credentials.js';
import { runImageUpload } from '../src/image-command.js';

test('image upload uses existing presign and storage APIs', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-image-state-'));
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-image-file-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  });
  await writeCredential({ apiBaseUrl: 'https://api.example.test', cookie: 'token_test=opaque', email: 'cli@example.com' });
  const imagePath = path.join(workDir, 'product.png');
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const requests: Array<{ url: string; method: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), method: String(init?.method), body: init?.body });
    if (String(input).endsWith('/api/file/get_presigns')) {
      return new Response(JSON.stringify({
        code: 0,
        data: { file_list: [{ file_no: 'pres_42', presign_url: 'https://storage.example/upload', headers: { 'x-test': '1' } }] },
      }), { status: 200 });
    }
    return new Response('', { status: 200 });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  await runImageUpload(parseCliArgs(['image', 'upload', '--file', imagePath, '--api-url', 'https://api.example.test']));
  assert.equal(requests[0].url, 'https://api.example.test/api/file/get_presigns');
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[1].url, 'https://storage.example/upload');
  assert.equal(requests[1].method, 'PUT');
});

test('image upload rejects unsupported file types', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-image-bad-state-'));
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-image-bad-file-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  });
  await writeCredential({ apiBaseUrl: 'https://api.example.test', cookie: 'token_test=opaque', email: 'cli@example.com' });
  const imagePath = path.join(workDir, 'product.bmp');
  await writeFile(imagePath, 'BM');
  await assert.rejects(() => runImageUpload(parseCliArgs(['image', 'upload', '--file', imagePath])), /must use \.jpg/);
});
