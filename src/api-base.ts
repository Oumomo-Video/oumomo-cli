/**
 * Helpers for the Oumomo API base URL.
 */

export class ApiBaseUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiBaseUrlError';
  }
}

export function normalizeApiBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ApiBaseUrlError('The Oumomo API base URL must be a valid HTTP(S) URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new ApiBaseUrlError('The Oumomo API base URL must be a credential-free HTTP(S) origin.');
  }
  return url.origin;
}

export function resolveApiBaseUrl(
  explicitValue: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  fallback = 'https://www.oumomo.ai',
): string {
  return explicitValue?.trim()
    || env.OUMOMO_CLI_API_URL?.trim()
    || env.OUMOMO_API_BASE_URL?.trim()
    || fallback;
}

export interface DeviceVerification {
  verification_uri: string;
  verification_uri_complete?: string;
  user_code: string;
}

export function resolveDeviceVerificationUrl(authorization: DeviceVerification): string {
  if (authorization.verification_uri_complete) return authorization.verification_uri_complete;
  const verificationUrl = new URL(authorization.verification_uri);
  verificationUrl.searchParams.set('user_code', authorization.user_code);
  return verificationUrl.toString();
}
