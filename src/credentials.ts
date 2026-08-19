import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type Credential = {
  kind: 'password' | 'oauth' | 'mcp';
  apiUrl: string;
  account?: string;
  cookie?: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  mcpKey?: string;
  updatedAt: string;
};

export function credentialPath(env = process.env): string {
  const root = env.OUMOMO_CLI_HOME?.trim() || path.join(os.homedir(), '.oumomo');
  return path.join(root, 'credential.json');
}

export async function readCredential(env = process.env): Promise<Credential | undefined> {
  try {
    return JSON.parse(await readFile(credentialPath(env), 'utf8')) as Credential;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new Error('Unable to read the local Oumomo credential.');
  }
}

export async function writeCredential(value: Credential, env = process.env): Promise<void> {
  const file = credentialPath(env);
  const directory = path.dirname(file);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const serialized = `${JSON.stringify({ ...value, updatedAt: new Date().toISOString() }, null, 2)}\n`;
  await writeFile(file, serialized, { mode: 0o600 });
  if (process.platform !== 'win32') await chmod(file, 0o600);
}

export async function clearCredential(env = process.env): Promise<void> {
  await rm(credentialPath(env), { force: true });
}
