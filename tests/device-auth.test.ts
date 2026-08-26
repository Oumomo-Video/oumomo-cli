import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DeviceAuthError, pollDeviceToken, runDeviceFlow, startDeviceAuthorization } from '../src/device-auth.js';

test('starts device authorization and parses the response', async () => {
  const authorization = await startDeviceAuthorization({
    apiBaseUrl: 'https://api.example.test',
    fetchImpl: async (input) => {
      assert.equal(String(input), 'https://api.example.test/api/oauth/device/code');
      return new Response(JSON.stringify({
        device_code: 'device-1',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://api.example.test/oauth/device',
        verification_uri_complete: 'https://api.example.test/oauth/device?user_code=ABCD-EFGH',
        expires_in: 600,
        interval: 1,
      }), { status: 200 });
    },
  });
  assert.equal(authorization.device_code, 'device-1');
  assert.equal(authorization.user_code, 'ABCD-EFGH');
  assert.equal(authorization.expires_in, 600);
});

test('retries on authorization_pending then succeeds', async () => {
  const calls: string[] = [];
  const credential = await pollDeviceToken({
    apiBaseUrl: 'https://api.example.test',
    authorization: {
      device_code: 'device-1',
      user_code: 'ABCD-EFGH',
      verification_uri: 'https://api.example.test/oauth/device',
      expires_in: 600,
      interval: 1,
    },
    fetchImpl: async (input) => {
      calls.push(String(input));
      if (calls.length === 1) return new Response(JSON.stringify({ error: 'authorization_pending' }), { status: 400 });
      return new Response(JSON.stringify({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        token_type: 'Bearer',
        expires_in: 3600,
        session_cookie: 'token_prod=session-1',
        account: 'user@example.com',
        operator_id: 7,
        merchant_id: 70,
      }), { status: 200 });
    },
    wait: async () => undefined,
  });
  assert.equal(calls.length, 2);
  assert.equal(credential.cookie, 'token_prod=session-1');
  assert.equal(credential.accessToken, 'access-1');
  assert.equal(credential.operatorId, '7');
  assert.equal(credential.merchantId, '70');
});

test('rejects when the token response lacks a session cookie', async () => {
  await assert.rejects(
    () => pollDeviceToken({
      apiBaseUrl: 'https://api.example.test',
      authorization: {
        device_code: 'device-1',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://api.example.test/oauth/device',
        expires_in: 600,
        interval: 1,
      },
      fetchImpl: async () => new Response(JSON.stringify({
        access_token: 'access-1',
        token_type: 'Bearer',
        expires_in: 3600,
      }), { status: 200 }),
      wait: async () => undefined,
    }),
    /could not finish/,
  );
});

test('throws on slow_down backoff and continues polling', async () => {
  const calls: string[] = [];
  let elapsed = 0;
  const credential = await pollDeviceToken({
    apiBaseUrl: 'https://api.example.test',
    authorization: {
      device_code: 'device-1',
      user_code: 'ABCD-EFGH',
      verification_uri: 'https://api.example.test/oauth/device',
      expires_in: 600,
      interval: 1,
    },
    fetchImpl: async (input) => {
      calls.push(String(input));
      if (calls.length === 1) return new Response(JSON.stringify({ error: 'slow_down' }), { status: 400 });
      return new Response(JSON.stringify({
        access_token: 'access-1',
        token_type: 'Bearer',
        expires_in: 3600,
        session_cookie: 'token_prod=session-1',
      }), { status: 200 });
    },
    wait: async (ms) => { elapsed += ms; },
  });
  assert.equal(credential.accessToken, 'access-1');
  assert.ok(elapsed >= 6, 'slow_down must add at least 5 seconds to the next interval');
});

test('runDeviceFlow fires the onAuthorization hook once', async () => {
  const authorizations: Array<{ user_code: string }> = [];
  const credential = await runDeviceFlow({
    apiBaseUrl: 'https://api.example.test',
    onAuthorization: (authorization) => authorizations.push({ user_code: authorization.user_code }),
    wait: async () => undefined,
    fetchImpl: async (input) => {
      if (String(input).endsWith('/api/oauth/device/code')) {
        return new Response(JSON.stringify({
          device_code: 'device-1',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://api.example.test/oauth/device',
          expires_in: 600,
          interval: 1,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        access_token: 'access-1',
        token_type: 'Bearer',
        expires_in: 3600,
        session_cookie: 'token_prod=session-1',
      }), { status: 200 });
    },
  });
  assert.equal(authorizations.length, 1);
  assert.equal(authorizations[0]?.user_code, 'ABCD-EFGH');
  assert.equal(credential.cookie, 'token_prod=session-1');
});

test('DeviceAuthError type matches thrown errors', async () => {
  try {
    await startDeviceAuthorization({
      apiBaseUrl: 'https://api.example.test',
      fetchImpl: async () => new Response(JSON.stringify({ error: 'unauthorized_client' }), { status: 400 }),
    });
    assert.fail('expected throw');
  } catch (error) {
    assert.ok(error instanceof DeviceAuthError);
  }
});
