import { resolveApiBaseUrl } from './api-base.js';
import { getOption, hasFlag } from './cli-args.js';
import { readCredential } from './credentials.js';
import { DIRECT_TOOLS, getDirectTool } from './direct-tools.js';
import { redactValue } from './redactor.js';
import type { ParsedCliArgs } from './cli-args.js';

export async function runToolList(args: ParsedCliArgs): Promise<void> {
  const skill = getOption(args, 'skill') || 'oumomo-video-replica';
  if (skill !== 'oumomo-video-replica') throw new Error(`Unknown published skill: ${skill}.`);
  process.stdout.write(`${JSON.stringify({
    skill,
    tools: DIRECT_TOOLS.map(({ name, description, requiresConfirmation }) => ({
      name, description, requiresConfirmation,
    })),
  }, null, 2)}\n`);
}

export async function runToolDescribe(args: ParsedCliArgs): Promise<void> {
  const [name = ''] = args.positionals;
  const tool = getDirectTool(name);
  if (!tool) throw new Error(`Tool is not exposed by the published Oumomo skill: ${name}.`);
  process.stdout.write(`${JSON.stringify({
    name: tool.name,
    description: tool.description,
    requiresConfirmation: tool.requiresConfirmation,
    parameters: tool.parameters,
  }, null, 2)}\n`);
}

export async function runToolCall(args: ParsedCliArgs): Promise<void> {
  const [name = ''] = args.positionals;
  const tool = getDirectTool(name);
  if (!tool) throw new Error(`Tool is not exposed by the published Oumomo skill: ${name}.`);
  if (tool.requiresConfirmation && !hasFlag(args, 'confirm')) {
    throw new Error(`\`${name}\` requires explicit \`--confirm\`.`);
  }

  const rawInput = getOption(args, 'input') || getOption(args, 'args') || '{}';
  let input: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawInput) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
    input = parsed as Record<string, unknown>;
  } catch {
    throw new Error('`tool --input` / `tool --args` must be a valid JSON object.');
  }

  const credential = await readCredential();
  if (!credential) throw new Error('No Oumomo CLI session is available. Run `oumomo-agent setup` first.');
  const result = await tool.execute(input, {
    apiBaseUrl: resolveApiBaseUrl(getOption(args, 'api-url')),
    credential,
  });
  const success = !(result && typeof result === 'object' && (result as Record<string, unknown>).success === false);
  process.stdout.write(`${JSON.stringify({ tool: name, success, result: redactValue(result) }, null, 2)}\n`);
  if (!success) {
    const record = result as Record<string, unknown>;
    throw new Error(String(record.msg || record.error || `Tool failed: ${name}`));
  }
}
