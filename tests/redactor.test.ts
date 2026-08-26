import { test } from 'node:test';
import assert from 'node:assert/strict';

import { redactString, redactValue, sanitizeCliError } from '../src/redactor.js';

test('redacts session cookies by name', () => {
  assert.equal(redactString('Login token_prod=secret-cookie-value went through'), 'Login token_[redacted] went through');
});

test('redacts arbitrary token_* cookies', () => {
  assert.equal(
    redactString('cookie token_custom_env=opaque; token_browser=value'),
    'cookie token_[redacted]; token_[redacted]',
  );
});

test('redacts inline base64 data URLs', () => {
  assert.equal(
    redactString('payload: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA hidden'),
    'payload: [inline-data-omitted] hidden',
  );
});

test('preserves non-credential strings', () => {
  assert.equal(redactString('just a regular log line'), 'just a regular log line');
});

test('redacts sensitive keys in nested objects', () => {
  const output = redactValue({
    name: 'ok',
    cookie: 'token_prod=secret',
    authHeaders: { cookie: 'token_prod=secret', lang: 'zh-CN' },
    body: { password: 'hunter2', account: 'public@example.com' },
    list: [{ access_token: 'secret', email: 'public@example.com' }],
  });
  assert.deepEqual(output, {
    name: 'ok',
    cookie: '[redacted]',
    authHeaders: { cookie: '[redacted]', lang: 'zh-CN' },
    body: { password: '[redacted]', account: 'public@example.com' },
    list: [{ access_token: '[redacted]', email: 'public@example.com' }],
  });
});

test('replaces inline data URLs in string values inside objects', () => {
  const output = redactValue({ image: 'data:image/jpeg;base64,AAA' });
  assert.deepEqual(output, { image: '[inline-data-omitted]' });
});

test('sanitizeCliError strips newlines and clamps length', () => {
  const message = 'line1\nline2\nline3'.repeat(200);
  const sanitized = sanitizeCliError(new Error(message));
  assert.ok(!sanitized.includes('\n'));
  assert.ok(sanitized.length <= 1000);
});

test('sanitizeCliError handles non-Error inputs', () => {
  assert.equal(sanitizeCliError('plain string'), 'plain string');
  assert.equal(sanitizeCliError(undefined), 'Unknown CLI error');
});
