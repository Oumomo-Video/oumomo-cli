#!/usr/bin/env node
import { clearCredential, readCredential, writeCredential, type Credential } from './credentials.js';
import { oauthDeviceLogin, passwordLogin, readPassword } from './auth.js';

const apiUrl = () => (process.env.OUMOMO_API_URL || 'https://www.oumomo.ai').replace(/\/$/, '');
const out = (value: unknown) => process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value)}\n`);

function help(): void {
  out(`Usage:\n  oumomo login --account <email-or-mobile>\n  oumomo auth login\n  oumomo auth status\n  oumomo mcp login --key <omcp_key>\n  oumomo logout`);
}

async function loginPassword(args: string[]): Promise<void> {
  const account = args[args.indexOf('--account') + 1];
  if (!account) throw new Error('Use --account <email-or-mobile>.');
  const credential = await passwordLogin({ apiUrl: apiUrl(), account, password: await readPassword() });
  await writeCredential(credential);
  out({ authenticated: true, kind: 'password', account });
}

async function loginOAuth(): Promise<void> {
  const credential = await oauthDeviceLogin({ apiUrl: apiUrl(), print: out });
  await writeCredential(credential);
  out({ authenticated: true, kind: 'oauth', account: credential.account || null });
}

async function loginMcp(args: string[]): Promise<void> {
  const key = args[args.indexOf('--key') + 1] || process.env.OUMOMO_MCP_KEY;
  if (!key?.startsWith('omcp_')) throw new Error('Use --key omcp_... or OUMOMO_MCP_KEY.');
  const credential: Credential = { kind: 'mcp', apiUrl: apiUrl(), mcpKey: key, updatedAt: new Date().toISOString() };
  await writeCredential(credential);
  out({ authenticated: true, kind: 'mcp' });
}

async function main(args: string[]): Promise<void> {
  if (!args.length || args.includes('--help')) return help();
  if (args[0] === 'login') return loginPassword(args);
  if (args[0] === 'auth' && args[1] === 'login') return loginOAuth();
  if (args[0] === 'auth' && args[1] === 'status') {
    const credential = await readCredential();
    out({ authenticated: Boolean(credential), kind: credential?.kind || null });
    return;
  }
  if (args[0] === 'mcp' && args[1] === 'login') return loginMcp(args);
  if (args[0] === 'logout') {
    await clearCredential();
    out({ authenticated: false });
    return;
  }
  return help();
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`oumomo: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
