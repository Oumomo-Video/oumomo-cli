import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isSetupTuiEnabled, printSetupLogin, printSetupSuccess, startSetupWaitingIndicator } from '../src/tui.js';

interface FakeStream {
  isTTY: boolean;
  buffer: string;
  write(chunk: string): boolean;
}

function makeFakeStream(isTTY: boolean): FakeStream {
  const stream: FakeStream = {
    isTTY,
    buffer: '',
    write(chunk: string) {
      this.buffer += chunk;
      return true;
    },
  };
  return stream;
}

test('NO_COLOR is preserved as a read-only hint; tui functions still execute', () => {
  const previous = process.env.NO_COLOR;
  process.env.NO_COLOR = '1';
  try {
    const originalStdout = process.stdout;
    const stream = makeFakeStream(true);
    Object.defineProperty(process, 'stdout', { value: stream, configurable: true });
    printSetupLogin('https://www.oumomo.ai/agent-auth', true);
    assert.ok(stream.buffer.includes('https://www.oumomo.ai/agent-auth'));
    assert.ok(!stream.buffer.includes('\x1b['), 'NO_COLOR must strip ANSI escapes');
    Object.defineProperty(process, 'stdout', { value: originalStdout, configurable: true });
  } finally {
    if (previous === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = previous;
  }
});

test('non-TTY stdout falls back to plain text', () => {
  const originalStdout = process.stdout;
  const stream = makeFakeStream(false);
  Object.defineProperty(process, 'stdout', { value: stream, configurable: true });
  printSetupLogin('https://www.oumomo.ai/agent-auth', true);
  assert.ok(stream.buffer.includes('请完成登录') || stream.buffer.includes('browser'));
  Object.defineProperty(process, 'stdout', { value: originalStdout, configurable: true });
});

test('printSetupSuccess prints the account email when authenticated', () => {
  const originalStdout = process.stdout;
  const stream = makeFakeStream(true);
  Object.defineProperty(process, 'stdout', { value: stream, configurable: true });
  printSetupSuccess('cli@example.com');
  assert.ok(stream.buffer.includes('cli@example.com'));
  Object.defineProperty(process, 'stdout', { value: originalStdout, configurable: true });
});

test('startSetupWaitingIndicator returns a noop when no TTY', () => {
  const originalStdout = process.stdout;
  const originalStderr = process.stderr;
  Object.defineProperty(process, 'stdout', { value: makeFakeStream(false), configurable: true });
  Object.defineProperty(process, 'stderr', { value: makeFakeStream(false), configurable: true });
  assert.equal(isSetupTuiEnabled(), false);
  const stop = startSetupWaitingIndicator();
  assert.equal(typeof stop, 'function');
  stop();
  Object.defineProperty(process, 'stdout', { value: originalStdout, configurable: true });
  Object.defineProperty(process, 'stderr', { value: originalStderr, configurable: true });
});
