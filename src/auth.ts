import { stdin, stderr } from 'node:process';
import type { Credential } from './credentials.js';

type Json = Record<string, unknown>;

function record(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid response from Oumomo.');
  return value as Json;
}

async function postForm(url: string, data: Record<string, string>): Promise<{ response: Response; body: Json }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data),
    signal: AbortSignal.timeout(15_000),
  });
  return { response, body: record(await response.json().catch(() => undefined)) };
}

export async function readPassword(): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Password login requires a terminal. Use `oumomo auth login` for OAuth.');
  }
  const wasRaw = stdin.isRaw;
  stderr.write('Password: ');
  stdin.setEncoding('utf8');
  stdin.setRawMode(true);
  stdin.resume();
  try {
    return await new Promise<string>((resolve, reject) => {
      let password = '';
      const onData = (chunk: string) => {
        for (const character of chunk) {
          if (character === '\r' || character === '\n') {
            stdin.off('data', onData);
            stderr.write('\n');
            return password ? resolve(password) : reject(new Error('Password cannot be empty.'));
          }
          if (character === '\u0003') {
            stdin.off('data', onData);
            stderr.write('\n');
            return reject(new Error('Password login cancelled.'));
          }
          if (character === '\u007f' || character === '\b') password = password.slice(0, -1);
          else password += character;
        }
      };
      stdin.on('data', onData);
    });
  } finally {
    stdin.setRawMode(wasRaw);
    stdin.pause();
  }
}

export async function passwordLogin(params: { apiUrl: string; account: string; password: string }): Promise<Credential> {
  const response = await fetch(`${params.apiUrl}/api/user/login`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ email: params.account, password: params.password }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = record(await response.json().catch(() => undefined));
  const cookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
    ?.map((item) => item.split(';', 1)[0]).find((item) => item?.startsWith('token_'));
  if (!response.ok || body.code !== 0 || !cookie) throw new Error('Password login was rejected.');
  return { kind: 'password', apiUrl: params.apiUrl, account: params.account, cookie, updatedAt: new Date().toISOString() };
}

export async function oauthDeviceLogin(params: { apiUrl: string; print: (value: string) => void }): Promise<Credential> {
  const start = await postForm(`${params.apiUrl}/oauth/device/code`, { client_id: 'oumomo-cli', scope: 'oumomo:cli' });
  if (!start.response.ok) throw new Error(String(start.body.error_description || 'Unable to start OAuth login.'));
  const deviceCode = String(start.body.device_code || '');
  const userCode = String(start.body.user_code || '');
  const uri = String(start.body.verification_uri_complete || start.body.verification_uri || '');
  const expiresIn = Number(start.body.expires_in || 0);
  let interval = Math.max(1, Number(start.body.interval || 5));
  if (!deviceCode || !userCode || !uri || !expiresIn) throw new Error('OAuth device response is incomplete.');
  params.print(uri);
  params.print(`User code: ${userCode}`);
  const deadline = Date.now() + expiresIn * 1000;
  while (Date.now() < deadline) {
    const token = await postForm(`${params.apiUrl}/oauth/token`, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: deviceCode, client_id: 'oumomo-cli',
    });
    if (token.response.ok) {
      const accessToken = String(token.body.access_token || '');
      if (!accessToken) throw new Error('OAuth token response is incomplete.');
      return {
        kind: 'oauth', apiUrl: params.apiUrl, account: typeof token.body.account === 'string' ? token.body.account : undefined,
        accessToken, refreshToken: typeof token.body.refresh_token === 'string' ? token.body.refresh_token : undefined,
        accessTokenExpiresAt: new Date(Date.now() + Number(token.body.expires_in || 3600) * 1000).toISOString(), updatedAt: new Date().toISOString(),
      };
    }
    const error = String(token.body.error || '');
    if (error === 'authorization_pending' || error === 'slow_down') {
      if (error === 'slow_down') interval += 5;
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
      continue;
    }
    throw new Error(String(token.body.error_description || error || 'OAuth login failed.'));
  }
  throw new Error('OAuth authorization expired.');
}
