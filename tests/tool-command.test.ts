import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parseCliArgs, type ParsedCliArgs } from '../src/cli-args.js';
import { runToolCall, runToolDescribe, runToolList } from '../src/tool-command.js';
import { writeCredential } from '../src/credentials.js';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

async function bootstrapCredential(stateDir: string) {
  await writeCredential({
    apiBaseUrl: 'https://api.example.test',
    cookie: 'token_test=opaque',
    email: 'cli@example.com',
  }, { env: { ...process.env, OUMOMO_CLI_STATE_DIR: stateDir } });
}

function withToolSubcommand(argv: readonly string[]): ParsedCliArgs {
  // bin.ts strips the tool subcommand (`list` / `describe` / `call`) before
  // forwarding the args to runTool* — mirror that here.
  const parsed = parseCliArgs(argv);
  const [, ...rest] = parsed.positionals;
  return { ...parsed, positionals: rest };
}

interface StdoutCapture {
  buffer: string;
  restore: () => void;
}

function captureStdout(): StdoutCapture {
  const original = process.stdout;
  const buffer = { value: '' };
  const stream = {
    isTTY: false,
    write(chunk: string) {
      buffer.value += chunk;
      return true;
    },
  };
  Object.defineProperty(process, 'stdout', { value: stream, configurable: true });
  return {
    get buffer() { return buffer.value; },
    restore: () => Object.defineProperty(process, 'stdout', { value: original, configurable: true }),
  };
}

test('tool list forwards the cookie and prints the JSON envelope', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-tool-list-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
  await bootstrapCredential(stateDir);

  const out = captureStdout();
  t.after(() => out.restore());

  let captured: CapturedRequest | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = {
      url: String(input),
      method: (init?.method || 'GET').toUpperCase(),
      headers: normalizeHeaders(init?.headers),
    };
    return new Response(JSON.stringify({
      tools: [
        { name: 'video_replica_search', description: 'Search viral videos.', requiresConfirmation: false },
        { name: 'video_replica_generate_video', description: 'Generate a viral remake.', requiresConfirmation: true },
      ],
    }), { status: 200 });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  await runToolList(parseCliArgs(['tool', 'list', '--api-url', 'https://api.example.test']));
  assert.ok(captured, 'fetch must be called');
  assert.equal(captured!.url, 'https://api.example.test/api/cli/tools');
  assert.equal(captured!.headers['cookie'], 'token_test=opaque');
  const parsed = JSON.parse(out.buffer);
  assert.equal(parsed.tools.length, 2);
  assert.equal(parsed.tools[1].requiresConfirmation, true);
});

test('tool describe rejects tools not in the allowlist before hitting the network', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-tool-describe-bad-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
  await bootstrapCredential(stateDir);
  const out = captureStdout();
  t.after(() => out.restore());

  await assert.rejects(
    () => runToolDescribe(withToolSubcommand(['tool', 'describe', 'project_remove_task_material'])),
    /not exposed by the published Oumomo skills/,
  );
});

test('tool describe sends the right URL and prints the schema', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-tool-describe-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
  await bootstrapCredential(stateDir);
  const out = captureStdout();
  t.after(() => out.restore());

  let captured: CapturedRequest | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = {
      url: String(input),
      method: (init?.method || 'GET').toUpperCase(),
      headers: normalizeHeaders(init?.headers),
    };
    return new Response(JSON.stringify({
      name: 'video_replica_search',
      description: '',
      requiresConfirmation: false,
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
    }), { status: 200 });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  await runToolDescribe(withToolSubcommand(['tool', 'describe', 'video_replica_search', '--api-url', 'https://api.example.test']));
  assert.equal(captured!.url, 'https://api.example.test/api/cli/tools/video_replica_search');
  // The slim CLI injects a fallback description from its allowlist when the
  // server response omits one.
  const parsed = JSON.parse(out.buffer);
  assert.match(parsed.description, /Search the Oumomo viral reference catalog/);
});

test('tool call rejects tools outside the allowlist', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-tool-call-bad-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
  await bootstrapCredential(stateDir);
  const out = captureStdout();
  t.after(() => out.restore());

  await assert.rejects(
    () => runToolCall(withToolSubcommand(['tool', 'call', 'project_remove_task_material', '--input', '{}'])),
    /not exposed by the published Oumomo skills/,
  );
});

test('tool call rejects video_replica_generate_video without --confirm', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-tool-call-confirm-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
  await bootstrapCredential(stateDir);
  const out = captureStdout();
  t.after(() => out.restore());

  await assert.rejects(
    () => runToolCall(withToolSubcommand(['tool', 'call', 'video_replica_generate_video', '--input', '{"referenceVideoUrl":"x"}'])),
    /requires explicit `--confirm`/,
  );
});

test('tool call sends the request and prints the result', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-tool-call-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
  await bootstrapCredential(stateDir);
  const out = captureStdout();
  t.after(() => out.restore());

  let captured: CapturedRequest | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    captured = {
      url: String(input),
      method: (init?.method || 'POST').toUpperCase(),
      headers: normalizeHeaders(init?.headers),
      body,
    };
    return new Response(JSON.stringify({
      ok: true,
      result: { matches: [{ id: 'r1' }] },
    }), { status: 200 });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  await runToolCall(withToolSubcommand(['tool', 'call', 'video_replica_search', '--input', '{"query":"phone"}', '--api-url', 'https://api.example.test']));
  assert.equal(captured!.url, 'https://api.example.test/api/cli/tools/video_replica_search/call');
  assert.equal(captured!.method, 'POST');
  assert.equal(captured!.headers['cookie'], 'token_test=opaque');
  assert.deepEqual(captured!.body, { input: { query: 'phone' }, confirm: false });
  assert.ok(out.buffer.includes('matches'));
});

test('tool call fails non-zero when the server reports an error', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-tool-call-fail-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
  await bootstrapCredential(stateDir);
  const out = captureStdout();
  t.after(() => out.restore());

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: false,
    error: 'upstream unavailable',
  }), { status: 200 })) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    () => runToolCall(withToolSubcommand(['tool', 'call', 'video_replica_search', '--input', '{"query":"phone"}'])),
    /upstream unavailable/,
  );
});

test('tool call rejects malformed JSON input', async (t) => {
  const stateDir = await mkdtemp(path.join(os.tmpdir(), 'oumomo-agent-tool-call-badjson-'));
  process.env.OUMOMO_CLI_STATE_DIR = stateDir;
  t.after(async () => {
    delete process.env.OUMOMO_CLI_STATE_DIR;
    await rm(stateDir, { recursive: true, force: true });
  });
  await bootstrapCredential(stateDir);
  const out = captureStdout();
  t.after(() => out.restore());

  await assert.rejects(
    () => runToolCall(withToolSubcommand(['tool', 'call', 'video_replica_search', '--input', 'not json'])),
    /must be a valid JSON object/,
  );
});

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!headers) return normalized;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => { normalized[key.toLowerCase()] = value; });
    return normalized;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) normalized[key.toLowerCase()] = String(value);
    return normalized;
  }
  for (const [key, value] of Object.entries(headers)) normalized[key.toLowerCase()] = String(value);
  return normalized;
}
