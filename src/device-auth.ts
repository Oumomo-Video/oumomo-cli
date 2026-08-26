/**
 * OAuth device flow. The slim CLI talks to the Oumomo API directly:
 * - POST /api/oauth/device/code  → get device_code + user_code + verification_uri
 * - POST /api/oauth/token        → poll until authorization completes
 */
import { normalizeApiBaseUrl } from './api-base.js';

const DEVICE_CODE_PATH = '/api/oauth/device/code';
const TOKEN_PATH = '/api/oauth/token';
const DEFAULT_CLIENT_ID = 'oumomo-workbuddy-cli';

export class DeviceAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceAuthError';
  }
}

export interface DeviceAuthorization {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

interface DeviceTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  session_cookie?: string;
  account?: string;
  operator_id?: string | number;
  merchant_id?: string | number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => undefined);
  if (!isRecord(body)) {
    throw new DeviceAuthError(
      response.status === 404
        ? 'Oumomo CLI login is not available in this environment. Check `--api-url` and try again.'
        : 'Oumomo could not start the CLI connection. Please try again.',
    );
  }
  return body;
}

export interface DeviceFlowCredentialInput {
  apiBaseUrl: string;
  cookie: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  operatorId?: string;
  merchantId?: string;
}

export async function startDeviceAuthorization(params: {
  apiBaseUrl: string;
  clientId?: string;
  fetchImpl?: typeof fetch;
}): Promise<DeviceAuthorization> {
  const apiBaseUrl = normalizeApiBaseUrl(params.apiBaseUrl);
  const response = await (params.fetchImpl || fetch)(new URL(DEVICE_CODE_PATH, `${apiBaseUrl}/`), {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: params.clientId || DEFAULT_CLIENT_ID, scope: 'oumomo:cli' }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await readJson(response);
  if (!response.ok) throw new DeviceAuthError(String(body.error_description || body.error || 'Oumomo could not start the CLI connection. Please try again.'));
  const authorization = body as unknown as DeviceAuthorization;
  if (!authorization.device_code || !authorization.user_code || !authorization.verification_uri || !authorization.expires_in) {
    throw new DeviceAuthError('Oumomo returned an incomplete connection response. Please try again.');
  }
  return authorization;
}

export async function pollDeviceToken(params: {
  apiBaseUrl: string;
  authorization: DeviceAuthorization;
  clientId?: string;
  fetchImpl?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
}): Promise<DeviceFlowCredentialInput> {
  const apiBaseUrl = normalizeApiBaseUrl(params.apiBaseUrl);
  const fetchImpl = params.fetchImpl || fetch;
  const wait = params.wait || ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = Date.now() + params.authorization.expires_in * 1000;
  let interval = Math.max(1, params.authorization.interval || 5);

  while (Date.now() < deadline) {
    const response = await fetchImpl(new URL(TOKEN_PATH, `${apiBaseUrl}/`), {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: params.authorization.device_code,
        client_id: params.clientId || DEFAULT_CLIENT_ID,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await readJson(response);
    if (response.ok) {
      const token = body as unknown as DeviceTokenResponse;
      if (!token.access_token || token.token_type?.toLowerCase() !== 'bearer' || !token.session_cookie) {
        throw new DeviceAuthError('Oumomo could not finish the CLI connection. Please run `oumomo-agent setup` again.');
      }
      return {
        apiBaseUrl,
        cookie: token.session_cookie,
        email: token.account || 'oauth-device',
        accessToken: token.access_token,
        ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
        accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        ...(token.operator_id !== undefined ? { operatorId: String(token.operator_id) } : {}),
        ...(token.merchant_id !== undefined ? { merchantId: String(token.merchant_id) } : {}),
      };
    }
    const error = String(body.error || '');
    if (error === 'authorization_pending') {
      await wait(interval * 1000);
      continue;
    }
    if (error === 'slow_down') {
      interval += 5;
      await wait(interval * 1000);
      continue;
    }
    throw new DeviceAuthError(String(body.error_description || error || 'The CLI connection could not be completed.'));
  }
  throw new DeviceAuthError('The connection request expired. Please run `oumomo-agent setup` again.');
}

export async function runDeviceFlow(params: {
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  onAuthorization: (authorization: DeviceAuthorization) => void;
}): Promise<DeviceFlowCredentialInput> {
  const authorization = await startDeviceAuthorization(params);
  params.onAuthorization(authorization);
  return pollDeviceToken({ ...params, authorization });
}
