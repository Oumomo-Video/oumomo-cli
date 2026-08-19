import type { Credential } from './credentials.js';

export type PublicCommand = {
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
};

function headers(credential: Credential): HeadersInit {
  if (credential.kind === 'mcp' && credential.mcpKey) return { accept: 'application/json', authorization: `Bearer ${credential.mcpKey}` };
  if (credential.kind === 'oauth' && credential.accessToken) return { accept: 'application/json', authorization: `Bearer ${credential.accessToken}` };
  if (credential.cookie) return { accept: 'application/json', cookie: credential.cookie };
  throw new Error('No usable credential is stored. Run login first.');
}

export async function callPublicApi(credential: Credential, command: PublicCommand): Promise<unknown> {
  const response = await fetch(`${credential.apiUrl.replace(/\/$/, '')}${command.path}`, {
    method: command.method,
    headers: { ...headers(credential), ...(command.body ? { 'content-type': 'application/json' } : {}) },
    ...(command.body ? { body: JSON.stringify(command.body) } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`Oumomo API request failed (HTTP ${response.status}).`);
  return body;
}
