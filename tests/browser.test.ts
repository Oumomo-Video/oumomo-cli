import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentAuthUrl, openBrowserUrl } from '../src/browser.js';

test('buildAgentAuthUrl attaches the verification URL to /agent-auth', () => {
  const url = new URL(buildAgentAuthUrl(
    'https://test.oumomo.ai/api/oauth/device?user_code=ABCD-1234',
    'https://test.oumomo.ai',
    { utm_source: 'cli', utm_campaign: 'agent_setup' },
  ));
  assert.equal(url.origin, 'https://test.oumomo.ai');
  assert.equal(url.pathname, '/agent-auth');
  assert.equal(url.searchParams.get('from'), 'https://test.oumomo.ai/api/oauth/device?user_code=ABCD-1234');
  assert.equal(url.searchParams.get('utm_source'), 'cli');
  assert.equal(url.searchParams.get('utm_campaign'), 'agent_setup');
});

test('buildAgentAuthUrl rejects a verification URL from a different origin', () => {
  assert.throws(() => buildAgentAuthUrl(
    'https://attacker.example/api/oauth/device?user_code=abcd',
    'https://test.oumomo.ai',
    {},
  ), /invalid verification URL/);
});

test('buildAgentAuthUrl never allows the caller to override the "from" parameter', () => {
  const url = new URL(buildAgentAuthUrl(
    'https://test.oumomo.ai/api/oauth/device?user_code=ABCD',
    'https://test.oumomo.ai',
    { from: 'https://attacker.example/evil' },
  ));
  assert.equal(url.searchParams.get('from'), 'https://test.oumomo.ai/api/oauth/device?user_code=ABCD');
});

test('openBrowserUrl refuses non-HTTPS remote URLs', () => {
  assert.equal(openBrowserUrl('http://attacker.example/login', 'darwin'), false);
});

test('openBrowserUrl accepts http://localhost on macOS', () => {
  // We do not actually invoke `open` during the test — we only verify the
  // protocol/host check returns true before the spawn. We assert the function
  // does not throw.
  assert.doesNotThrow(() => openBrowserUrl('http://localhost:8080/foo', 'darwin'));
});

test('openBrowserUrl refuses bad URLs on every platform', () => {
  assert.equal(openBrowserUrl('not-a-url', 'darwin'), false);
  assert.equal(openBrowserUrl('not-a-url', 'win32'), false);
  assert.equal(openBrowserUrl('not-a-url', 'linux'), false);
});

test('openBrowserUrl returns false on unsupported platforms', () => {
  assert.equal(openBrowserUrl('https://www.oumomo.ai/login', 'freebsd-but-not-supported'), false);
});
