/**
 * Minimal argv parser. Splits the first non-flag token into `command`, then
 * folds the remaining tokens into a `Map<key, string[]>` of options plus a
 * `positionals` array. Supports `--key=value` and repeated `--key value`.
 *
 * Intentionally tiny: no third-party deps, no shell-quoting semantics.
 */

export interface ParsedCliArgs {
  command: string;
  options: Map<string, string[]>;
  positionals: string[];
}

export class CliArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliArgumentError';
  }
}

export function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  const [first = 'help', ...rest] = argv;
  const startsWithFlag = first.startsWith('-');
  const command = startsWithFlag ? 'help' : first;
  const tokens = startsWithFlag ? [...argv] : rest;
  const options = new Map<string, string[]>();
  const positionals: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const equalsAt = token.indexOf('=');
    const key = token.slice(2, equalsAt >= 0 ? equalsAt : undefined);
    if (!key) throw new CliArgumentError('Option names cannot be empty.');
    let value: string;
    if (equalsAt >= 0) {
      value = token.slice(equalsAt + 1);
    } else if (tokens[index + 1] && !tokens[index + 1].startsWith('--')) {
      value = tokens[index + 1];
      index += 1;
    } else {
      value = 'true';
    }
    options.set(key, [...(options.get(key) || []), value]);
  }

  return { command, options, positionals };
}

export function getOption(args: ParsedCliArgs, key: string): string | undefined {
  return args.options.get(key)?.at(-1)?.trim() || undefined;
}

export function getOptions(args: ParsedCliArgs, key: string): string[] {
  return (args.options.get(key) || []).map((value) => value.trim()).filter(Boolean);
}

export function hasFlag(args: ParsedCliArgs, key: string): boolean {
  return args.options.has(key);
}
