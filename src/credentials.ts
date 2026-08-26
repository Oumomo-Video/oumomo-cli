/**
 * Cross-platform credential storage for the slim `oumomo-agent` CLI.
 * File is JSON, 0o600 on POSIX, 0o700 directory. Never logged, never
 * printed. Stored in the user's per-platform state directory by default.
 */
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { normalizeApiBaseUrl } from './api-base.js';

const CREDENTIAL_FILE_NAME = 'session.json';

export interface OumomoCliCredential {
  version: 1;
  apiBaseUrl: string;
  cookie: string;
  email: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  operatorId?: string;
  merchantId?: string;
  updatedAt: string;
}

export class CredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialError';
  }
}

export function resolveStateDirectory(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDirectory = os.homedir(),
): string {
  const configured = env.OUMOMO_CLI_STATE_DIR?.trim();
  if (configured) return path.resolve(configured);

  if (platform === 'darwin') {
    return path.join(homeDirectory, 'Library', 'Application Support', 'oumomo-agent');
  }
  if (platform === 'win32') {
    return path.join(env.APPDATA?.trim() || homeDirectory, 'oumomo-agent');
  }
  return path.join(env.XDG_STATE_HOME?.trim() || path.join(homeDirectory, '.local', 'state'), 'oumomo-agent');
}

export function resolveCredentialPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDirectory = os.homedir(),
): string {
  return path.join(resolveStateDirectory(env, platform, homeDirectory), CREDENTIAL_FILE_NAME);
}

function isCredential(value: unknown): value is OumomoCliCredential {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1
    && typeof candidate.apiBaseUrl === 'string'
    && typeof candidate.cookie === 'string'
    && (candidate.cookie.trim().length > 0 || typeof candidate.accessToken === 'string')
    && typeof candidate.email === 'string'
    && typeof candidate.updatedAt === 'string';
}

function assertPrivateMode(mode: number, filePath: string, platform: NodeJS.Platform): void {
  if (platform === 'win32') return;
  if ((mode & 0o077) !== 0) {
    throw new CredentialError(
      `Refusing to read credentials with broad permissions: ${filePath}. Run chmod 600 on the file.`,
    );
  }
}

export async function readCredential(params: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homeDirectory?: string;
} = {}): Promise<OumomoCliCredential | undefined> {
  const env = params.env || process.env;
  const platform = params.platform || process.platform;
  const filePath = resolveCredentialPath(env, platform, params.homeDirectory || os.homedir());

  let raw: string;
  try {
    const metadata = await stat(filePath);
    assertPrivateMode(metadata.mode, filePath, platform);
    raw = await readFile(filePath, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    if (error instanceof CredentialError) throw error;
    throw new CredentialError('Unable to read the local Oumomo CLI session.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CredentialError('The local Oumomo CLI session is malformed. Run `oumomo-agent auth logout` and `oumomo-agent setup` again.');
  }
  if (!isCredential(parsed)) {
    throw new CredentialError('The local Oumomo CLI session is incomplete. Run `oumomo-agent auth logout` and `oumomo-agent setup` again.');
  }

  return {
    ...parsed,
    apiBaseUrl: normalizeApiBaseUrl(parsed.apiBaseUrl),
    cookie: parsed.cookie.trim(),
    email: parsed.email.trim(),
    accessToken: parsed.accessToken?.trim() || undefined,
    refreshToken: parsed.refreshToken?.trim() || undefined,
    accessTokenExpiresAt: parsed.accessTokenExpiresAt?.trim() || undefined,
    operatorId: parsed.operatorId?.trim() || undefined,
    merchantId: parsed.merchantId?.trim() || undefined,
  };
}

export async function writeCredential(
  credential: Omit<OumomoCliCredential, 'version' | 'updatedAt'> & Partial<Pick<OumomoCliCredential, 'updatedAt'>>,
  params: {
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    homeDirectory?: string;
  } = {},
): Promise<void> {
  const env = params.env || process.env;
  const platform = params.platform || process.platform;
  const directory = resolveStateDirectory(env, platform, params.homeDirectory || os.homedir());
  const filePath = path.join(directory, CREDENTIAL_FILE_NAME);
  const normalizedCookie = credential.cookie.trim();
  const normalizedEmail = credential.email.trim();
  if ((!normalizedCookie && !credential.accessToken?.trim()) || !normalizedEmail) {
    throw new CredentialError('A session cookie or OAuth access token and an account name are required to save the CLI session.');
  }

  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (platform !== 'win32') await chmod(directory, 0o700);

  const serialized = JSON.stringify({
    version: 1,
    apiBaseUrl: normalizeApiBaseUrl(credential.apiBaseUrl),
    cookie: normalizedCookie,
    email: normalizedEmail,
    ...(credential.accessToken?.trim() ? { accessToken: credential.accessToken.trim() } : {}),
    ...(credential.refreshToken?.trim() ? { refreshToken: credential.refreshToken.trim() } : {}),
    ...(credential.accessTokenExpiresAt?.trim() ? { accessTokenExpiresAt: credential.accessTokenExpiresAt.trim() } : {}),
    ...(credential.operatorId?.trim() ? { operatorId: credential.operatorId.trim() } : {}),
    ...(credential.merchantId?.trim() ? { merchantId: credential.merchantId.trim() } : {}),
    updatedAt: credential.updatedAt || new Date().toISOString(),
  }, null, 2);
  const temporaryPath = path.join(directory, `.${CREDENTIAL_FILE_NAME}.${process.pid}.${Date.now()}.tmp`);

  try {
    await writeFile(temporaryPath, `${serialized}\n`, { encoding: 'utf8', mode: 0o600 });
    if (platform !== 'win32') await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, filePath);
    if (platform !== 'win32') await chmod(filePath, 0o600);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

export async function clearCredential(params: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homeDirectory?: string;
} = {}): Promise<void> {
  const filePath = resolveCredentialPath(
    params.env || process.env,
    params.platform || process.platform,
    params.homeDirectory || os.homedir(),
  );
  await rm(filePath, { force: true });
}
