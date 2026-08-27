/**
 * `oumomo-agent tool list | describe <name> | call <name> --input '<json>' [--confirm]`
 *
 * All three sub-commands share the same allowlist + cookie + JSON envelope.
 * The CLI does its own allowlist check before sending so the user gets a
 * fast, structured error without a network roundtrip. The server enforces
 * the same allowlist on its side — clients and server must agree.
 */
import { resolveApiBaseUrl } from './api-base.js';
import { hasFlag, getOption } from './cli-args.js';
import { readCredential } from './credentials.js';
import { redactValue, sanitizeCliError } from './redactor.js';
import {
  isPublishedSkillTool,
  OUMOMO_VIDEO_REPLICA_TOOL_DESCRIPTIONS,
  requiresConfirmation as toolRequiresConfirmation,
  type OumomoVideoReplicaTool,
} from './skill-tools.js';
import type { ParsedCliArgs } from './cli-args.js';

const CONFIRMATION_REQUIRED_MESSAGE = 'Tool requires explicit `--confirm`.';

export async function runToolList(args: ParsedCliArgs): Promise<void> {
  const apiBaseUrl = resolveApiBaseUrl(getOption(args, 'api-url'));
  const skill = getOption(args, 'skill') || 'oumomo-video-replica';
  if (skill !== 'oumomo-video-replica') {
    throw new Error(`Unknown published skill: ${skill}.`);
  }
  const credential = await readCredential();
  if (!credential) {
    throw new Error('No Oumomo CLI session is available. Run `oumomo-agent setup` first.');
  }

  const response = await fetch(new URL('/api/cli/tools', `${apiBaseUrl}/`), {
    method: 'GET',
    headers: {
      accept: 'application/json',
      cookie: credential.cookie,
      source: 'oumomo-agent-cli',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Tool list failed (HTTP ${response.status}).`);
  }
  const payload = (await response.json()) as { tools?: Array<{ name: string; description: string; requiresConfirmation: boolean }> };
  const tools = Array.isArray(payload.tools) ? payload.tools : [];
  process.stdout.write(`${JSON.stringify({ skill, tools }, null, 2)}\n`);
}

export async function runToolDescribe(args: ParsedCliArgs): Promise<void> {
  const [name = ''] = args.positionals;
  if (!name) {
    throw new Error('Usage: oumomo-agent tool describe <tool-name>.');
  }
  if (!isPublishedSkillTool(name)) {
    throw new Error(`Tool is not exposed by the published Oumomo skills: ${name}.`);
  }
  const apiBaseUrl = resolveApiBaseUrl(getOption(args, 'api-url'));
  const credential = await readCredential();
  if (!credential) {
    throw new Error('No Oumomo CLI session is available. Run `oumomo-agent setup` first.');
  }

  const response = await fetch(new URL(`/api/cli/tools/${encodeURIComponent(name)}`, `${apiBaseUrl}/`), {
    method: 'GET',
    headers: {
      accept: 'application/json',
      cookie: credential.cookie,
      source: 'oumomo-agent-cli',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = await readErrorBody(response);
    throw new Error(`Tool describe failed (HTTP ${response.status}): ${detail}`);
  }
  const payload = (await response.json()) as {
    name: string;
    description: string;
    requiresConfirmation: boolean;
    parameters: unknown;
  };
  // Inject the description from the local allowlist if the server did not
  // include one — keeps the CLI usable even if the server is on an older
  // version that omits tool descriptions.
  if (!payload.description) {
    payload.description = OUMOMO_VIDEO_REPLICA_TOOL_DESCRIPTIONS[name as OumomoVideoReplicaTool] || '';
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export async function runToolCall(args: ParsedCliArgs): Promise<void> {
  const [name = ''] = args.positionals;
  if (!name) {
    throw new Error('Usage: oumomo-agent tool call <tool-name> --input \'<json>\'.');
  }
  if (!isPublishedSkillTool(name)) {
    throw new Error(`Tool is not exposed by the published Oumomo skills: ${name}.`);
  }
  const rawInput = getOption(args, 'input') || getOption(args, 'args') || '{}';
  let parsedInput: Record<string, unknown>;
  try {
    const candidate = JSON.parse(rawInput) as unknown;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error('object required');
    }
    parsedInput = candidate as Record<string, unknown>;
  } catch {
    throw new Error('`tool --input` / `tool --args` must be a valid JSON object.');
  }

  const isConfirmationRequested = hasFlag(args, 'confirm');
  if (toolRequiresConfirmation(name) && !isConfirmationRequested) {
    throw new Error(`\`${name}\` requires explicit \`--confirm\`. ${CONFIRMATION_REQUIRED_MESSAGE}`);
  }

  const apiBaseUrl = resolveApiBaseUrl(getOption(args, 'api-url'));
  const credential = await readCredential();
  if (!credential) {
    throw new Error('No Oumomo CLI session is available. Run `oumomo-agent setup` first.');
  }

  const response = await fetch(new URL(`/api/cli/tools/${encodeURIComponent(name)}/call`, `${apiBaseUrl}/`), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      cookie: credential.cookie,
      source: 'oumomo-agent-cli',
    },
    body: JSON.stringify({ input: parsedInput, confirm: isConfirmationRequested }),
    signal: AbortSignal.timeout(60_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    ok?: boolean;
    result?: unknown;
    error?: string;
    blocked?: boolean;
  };
  if (!response.ok) {
    const detail = payload.error || (await readErrorBody(response));
    process.stdout.write(`${JSON.stringify({
      tool: name,
      success: false,
      error: detail,
      ...(payload.blocked ? { blocked: true } : {}),
    }, null, 2)}\n`);
    throw new Error(detail);
  }
  const succeeded = payload.success === true || payload.ok === true;
  const output = {
    tool: name,
    success: succeeded,
    ...(payload.result !== undefined ? { result: redactValue(payload.result) } : {}),
    ...(payload.error ? { error: sanitizeCliError(payload.error) } : {}),
    ...(payload.blocked ? { blocked: true } : {}),
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!succeeded) {
    throw new Error(payload.error || `Tool failed: ${name}`);
  }
}

async function readErrorBody(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return response.statusText || 'empty response body';
  try {
    const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
    return String(parsed.error || parsed.message || raw).slice(0, 500);
  } catch {
    return sanitizeCliError(raw).slice(0, 500);
  }
}
