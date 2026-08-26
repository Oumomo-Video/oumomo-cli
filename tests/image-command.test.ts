import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parseCliArgs } from '../src/cli-args.js';
import { runImageUpload } from '../src/image-command.js';
import { writeCredential } from '../src/credentials.js';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyLength: number;
  bodyText: string;
}

async function bootstrapCredential(stateDir: string) {
  await writeCredential({
    apiBaseUrl: 'https://api.example.test',
    cookie: 'token_test=opaque',
    email: 'cli@example.com',
  }, { env: { ...process.env, OUMOMO_CLI_STATE_DIR: stateDir } });
}

test('image upload streams a multipart body to /api/cli/image/upload', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-image-'));
  const previousStateDir = process.env.OUMOMO_CLI_STATE_DIR;
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    if (previousStateDir === undefined) delete process.env.OUMOMO_CLI_STATE_DIR;
    else process.env.OUMOMO_CLI_STATE_DIR = previousStateDir;
    await rm(stateDir, { recursive: true, force: true });
  });

  await bootstrapCredential(stateDir);

  const workDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-image-file-'));
  const imagePath = path.join(workDir, 'product.png');
  await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  t.after(() => rm(workDir, { recursive: true, force: true }));

  const stdoutCapture: { buffer: string; restore: () => void } = (() => {
    const original = process.stdout;
    const buffer: { value: string } = { value: '' };
    const stream = {
      isTTY: false,
      write(chunk: string) {
        buffer.value += chunk;
        return true;
      },
    };
    Object.defineProperty(process, 'stdout', { value: stream, configurable: true });
    return { buffer: buffer, restore: () => Object.defineProperty(process, 'stdout', { value: original, configurable: true }) };
  })();
  t.after(() => stdoutCapture.restore());

  let captured: CapturedRequest | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const rawHeaders = init.headers as Record<string, string>;
      for (const [key, value] of Object.entries(rawHeaders)) headers[key.toLowerCase()] = String(value);
    }
    const bodyText = typeof init?.body === 'string'
      ? init.body
      : init?.body && typeof (init.body as ReadableStream).getReader === 'function'
        ? await readStreamToText(init.body as ReadableStream<Uint8Array>)
        : '';
    captured = {
      url,
      method,
      headers,
      bodyLength: bodyText.length,
      bodyText,
    };
    return new Response(JSON.stringify({
      success: true,
      image: { fileNo: 'pres_42', url: 'https://cdn.oumomo.com/x.png', fileName: 'product.png', mimeType: 'image/png', size: 8 },
    }), { status: 200 });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const args = parseCliArgs([
    'image', 'upload',
    '--file', imagePath,
    '--api-url', 'https://api.example.test',
  ]);
  await runImageUpload(args);

  assert.ok(captured, 'fetch should have been called');
  assert.equal(captured!.url, 'https://api.example.test/api/cli/image/upload');
  assert.equal(captured!.method, 'POST');
  assert.equal(captured!.headers['content-type']?.startsWith('multipart/form-data; boundary='), true);
  assert.ok(captured!.headers['content-length'], 'should set a precise content-length');
  assert.ok(captured!.bodyText.includes('product.png'), 'multipart body must include filename');
  assert.ok(captured!.bodyText.includes('Content-Disposition: form-data; name="file"'), 'multipart body must use the "file" field name');
  assert.ok(stdoutCapture.buffer.value.includes('pres_42'), 'should print the file number from the server response');
});

async function readStreamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return buffer;
    buffer += decoder.decode(value, { stream: true });
  }
}

test('image upload rejects unsupported mime types', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-image-bad-'));
  const previousStateDir = process.env.OUMOMO_CLI_STATE_DIR;
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    if (previousStateDir === undefined) delete process.env.OUMOMO_CLI_STATE_DIR;
    else process.env.OUMOMO_CLI_STATE_DIR = previousStateDir;
    await rm(stateDir, { recursive: true, force: true });
  });

  await bootstrapCredential(stateDir);

  const workDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-image-badfile-'));
  const imagePath = path.join(workDir, 'product.bmp');
  await writeFile(imagePath, Buffer.from('BM'));
  t.after(() => rm(workDir, { recursive: true, force: true }));

  const args = parseCliArgs(['image', 'upload', '--file', imagePath]);
  await assert.rejects(() => runImageUpload(args), /must use \.jpg/);
});
