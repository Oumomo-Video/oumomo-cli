import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import { parseCliArgs, type ParsedCliArgs } from '../src/cli-args.js';
import { writeCredential } from '../src/credentials.js';
import { runToolCall, runToolDescribe, runToolList } from '../src/tool-command.js';

function commandArgs(argv: readonly string[]): ParsedCliArgs {
  const parsed = parseCliArgs(argv);
  return { ...parsed, positionals: parsed.positionals.slice(1) };
}

async function withCredential(t: TestContext): Promise<void> {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-direct-tools-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  await writeCredential({
    apiBaseUrl: 'https://api.example.test',
    cookie: 'token_test=opaque',
    email: 'cli@example.com',
  });
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
}

function captureStdout() {
  const original = process.stdout;
  const buffer = { value: '' };
  Object.defineProperty(process, 'stdout', {
    configurable: true,
    value: { isTTY: false, write(chunk: string) { buffer.value += chunk; return true; } },
  });
  return {
    buffer,
    restore: () => Object.defineProperty(process, 'stdout', { configurable: true, value: original }),
  };
}

test('tool list is local and exposes only the published workflow tools', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('tool list must not use the network'); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const out = captureStdout();
  t.after(out.restore);

  await runToolList(parseCliArgs(['tool', 'list']));
  const payload = JSON.parse(out.buffer.value);
  assert.deepEqual(payload.tools.map((tool: { name: string }) => tool.name), [
    'url_to_video_fetch_product',
    'video_replica_search',
    'video_replica_generate_video',
    'replica_progress',
    'replica_project_result',
  ]);
});

test('tool describe returns a local JSON schema', async (t) => {
  const out = captureStdout();
  t.after(out.restore);
  await runToolDescribe(commandArgs(['tool', 'describe', 'video_replica_search']));
  const payload = JSON.parse(out.buffer.value);
  assert.equal(payload.parameters.properties.region.type, 'string');
  assert.equal(payload.requiresConfirmation, false);
});

test('tool call rejects tools outside the published workflow', async () => {
  await assert.rejects(
    () => runToolCall(commandArgs(['tool', 'call', 'video_breakdown_by_vision', '--input', '{}'])),
    /not exposed by the published Oumomo skill/,
  );
});

test('generation requires explicit confirmation before credentials or network', async () => {
  await assert.rejects(
    () => runToolCall(commandArgs(['tool', 'call', 'video_replica_generate_video', '--input', '{}'])),
    /requires explicit `--confirm`/,
  );
});

test('video search calls the existing business API directly', async (t) => {
  await withCredential(t);
  const out = captureStdout();
  t.after(out.restore);
  let request: { url: string; body: string; headers: Record<string, string> } | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    request = {
      url: String(input),
      body: String(init?.body || ''),
      headers: init?.headers as Record<string, string>,
    };
    return new Response(JSON.stringify({ code: 0, data: { list: [{ video_id: '123' }] } }), { status: 200 });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  await runToolCall(commandArgs([
    'tool', 'call', 'video_replica_search',
    '--input', '{"region":"US","category":"lipstick","pagesize":6}',
    '--api-url', 'https://api.example.test',
  ]));
  assert.equal(request!.url, 'https://api.example.test/api/video_clone/search_video');
  assert.equal(request!.headers.cookie, 'token_test=opaque');
  const form = new URLSearchParams(request!.body);
  assert.equal(form.get('region'), 'US');
  assert.equal(form.get('words'), 'lipstick');
  assert.equal(form.get('pagesize'), '6');
  assert.match(out.buffer.value, /"video_id": "123"/);
  assert.match(out.buffer.value, /https:\/\/www\.tiktok\.com\/video\/123/);
});

test('generation calls submit_task with the confirmed direct contract', async (t) => {
  await withCredential(t);
  let request: { url: string; body: string } | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    request = { url: String(input), body: String(init?.body || '') };
    return new Response(JSON.stringify({ code: 0, data: { task_no: 'task_1' } }), { status: 200 });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const out = captureStdout();
  t.after(out.restore);

  await runToolCall(commandArgs([
    'tool', 'call', 'video_replica_generate_video', '--confirm',
    '--input', '{"videoId":"7670692481700203790","productImageFileNo":"pres_1","seconds":30,"lang":"EN_US","replicaPrompt":"UGC demo"}',
    '--api-url', 'https://api.example.test',
  ]));
  assert.equal(request!.url, 'https://api.example.test/api/video_clone/submit_task');
  const form = new URLSearchParams(request!.body);
  assert.equal(form.get('video_id'), '7670692481700203790');
  assert.equal(form.get('file_no'), 'pres_1');
  assert.equal(form.get('seconds'), '30');
  assert.equal(form.get('script'), '');
  assert.match(String(form.get('product_info')), /UGC demo/);
});

test('generation resolves a TikTok short link with the existing resolver API', async (t) => {
  await withCredential(t);
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    if (String(input).endsWith('/api/tools/get_tt_video_url')) {
      return new Response(JSON.stringify({ code: 0, data: { status: 'DOING', video_id: '7670692481700203790' } }), { status: 200 });
    }
    return new Response(JSON.stringify({ code: 0, data: { task_no: 'task_short_link' } }), { status: 200 });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const out = captureStdout();
  t.after(out.restore);

  await runToolCall(commandArgs([
    'tool', 'call', 'video_replica_generate_video', '--confirm',
    '--input', '{"videoUrl":"https://vt.tiktok.com/example/","productImageFileNo":"pres_1"}',
    '--api-url', 'https://api.example.test',
  ]));
  assert.equal(urls[0], 'https://api.example.test/api/tools/get_tt_video_url');
  assert.equal(urls[1], 'https://api.example.test/api/video_clone/submit_task');
});

test('product, progress, and result tools call their existing GET APIs', async (t) => {
  await withCredential(t);
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ code: 0, data: { ok: true } }), { status: 200 });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const out = captureStdout();
  t.after(out.restore);

  await runToolCall(commandArgs(['tool', 'call', 'url_to_video_fetch_product', '--input', '{"productUrl":"https://example.com/product/1"}', '--api-url', 'https://api.example.test']));
  await runToolCall(commandArgs(['tool', 'call', 'replica_progress', '--input', '{"taskNo":"task_1"}', '--api-url', 'https://api.example.test']));
  await runToolCall(commandArgs(['tool', 'call', 'replica_project_result', '--input', '{"taskNo":"task_1"}', '--api-url', 'https://api.example.test']));

  assert.equal(urls[0], 'https://api.example.test/api/link_video/get_product_info?product_url=https%3A%2F%2Fexample.com%2Fproduct%2F1');
  assert.equal(urls[1], 'https://api.example.test/api/video_clone/task_status?task_no=task_1');
  assert.equal(urls[2], 'https://api.example.test/api/project/get_task_result?task_no=task_1&scene=7');
});

test('tool call rejects malformed JSON input', async () => {
  await assert.rejects(
    () => runToolCall(commandArgs(['tool', 'call', 'video_replica_search', '--input', 'not json'])),
    /must be a valid JSON object/,
  );
});
