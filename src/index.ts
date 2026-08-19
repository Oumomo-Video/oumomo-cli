#!/usr/bin/env node
import { clearCredential, readCredential, writeCredential, type Credential } from './credentials.js';
import { oauthDeviceLogin, passwordLogin, readPassword } from './auth.js';
import { callPublicApi, type PublicCommand } from './api.js';
import { listCapabilities } from './capabilities.js';

const apiUrl = () => (process.env.OUMOMO_API_URL || 'https://www.oumomo.ai').replace(/\/$/, '');
const out = (value: unknown) => process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value)}\n`);
const valueAfter = (args: string[], name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

function required(args: string[], name: string): string {
  const value = valueAfter(args, name)?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

async function runPublicCommand(args: string[]): Promise<void> {
  const credential = await readCredential();
  if (!credential) throw new Error('Not authenticated. Run `oumomo login` or `oumomo auth login`.');
  const command = args[0];
  let request: PublicCommand;
  if (command === 'viral-replica' && args[1] === 'create') {
    const duration = Number(valueAfter(args, '--duration') || 15);
    if (![10, 15, 30].includes(duration)) throw new Error('--duration must be 10, 15, or 30.');
    request = { method: 'POST', path: '/api/cli/viral-replica', body: {
      reference_url: required(args, '--reference'), image: required(args, '--image'),
      region: required(args, '--region'), language: required(args, '--language'), duration,
    } };
  } else if (command === 'script' && args[1] === 'create') {
    request = { method: 'POST', path: '/api/cli/scripts', body: {
      product: required(args, '--product'), region: valueAfter(args, '--region'), language: valueAfter(args, '--language'),
      duration: Number(valueAfter(args, '--duration') || 30), tone: valueAfter(args, '--tone') || 'UGC',
    } };
  } else if (command === 'product-images' && args[1] === 'create') {
    const files = args.flatMap((arg, index) => arg === '--file' ? [args[index + 1]] : []).filter(Boolean);
    if (!files.length) throw new Error('At least one --file is required.');
    request = { method: 'POST', path: '/api/cli/product-images', body: {
      files, region: required(args, '--region'), language: required(args, '--language'), prompt: required(args, '--prompt'),
      main_count: Number(valueAfter(args, '--main-count') || 7), detail_count: Number(valueAfter(args, '--detail-count') || 1), quality: valueAfter(args, '--quality') || '1K',
    } };
  } else if (command === 'task' && args[1] === 'get') {
    request = { method: 'GET', path: `/api/cli/tasks/${encodeURIComponent(required(args, '--id'))}` };
  } else {
    throw new Error('Unknown public command. Run `oumomo --help`.');
  }
  if (args.includes('--dry-run')) {
    out(request);
    return;
  }
  out(await callPublicApi(credential, request));
}

function help(): void {
  out(`Usage:\n  oumomo login --account <email-or-mobile>\n  oumomo auth login\n  oumomo auth status\n  oumomo mcp login --key <omcp_key>\n  oumomo logout`);
  out('  oumomo viral-replica create --reference <url> --image <path> --region <code> --language <code> --duration 15 [--dry-run]');
  out('  oumomo script create --product <text-or-url> --region <code> --language <code> [--dry-run]');
  out('  oumomo product-images create --file <path> --region <code> --language <code> --prompt <text> [--dry-run]');
  out('  oumomo task get --id <task-id> [--dry-run]');
  out('  oumomo capabilities list [--ready-only] [--json]');
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
  if (args[0] === 'capabilities' && args[1] === 'list') {
    const capabilities = await listCapabilities();
    const selected = args.includes('--ready-only') ? capabilities.filter((item) => item.availability === 'ready') : capabilities;
    if (args.includes('--json')) out({ capabilities: selected });
    else selected.forEach((item) => out(`${item.availability.padEnd(7)} ${item.name_zh} (${item.id}) - ${item.command}`));
    return;
  }
  if (['viral-replica', 'script', 'product-images', 'task'].includes(args[0])) return runPublicCommand(args);
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
