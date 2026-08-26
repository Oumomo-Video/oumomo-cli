#!/usr/bin/env node
// CLI entry point. Must stay first: installs the console patch before any
// other module's top-level side effects run.
import './log-filter.js';

import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCliArgs, hasFlag, type ParsedCliArgs } from './cli-args.js';
import { runAuthStatus, runAuthLogout } from './auth-command.js';
import { runSetup } from './setup-command.js';
import { runImageUpload } from './image-command.js';
import { runToolCall, runToolDescribe, runToolList } from './tool-command.js';
import { sanitizeCliError } from './redactor.js';

const require = createRequire(import.meta.url);

interface PackageMetadata {
  version: string;
  name: string;
}

function readVersion(): string {
  try {
    const pkg = require('../package.json') as PackageMetadata;
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const USAGE = `Usage:
  oumomo-agent setup [--api-url <url>] [--utm-source <s>] [--utm-medium <m>] [--utm-campaign <c>] [--utm-content <x>]
  oumomo-agent auth status
  oumomo-agent auth logout
  oumomo-agent image upload --file <path> [--api-url <url>]
  oumomo-agent tool list
  oumomo-agent tool describe <tool-name>
  oumomo-agent tool call <tool-name> --input '<json>' [--confirm]
  oumomo-agent tool <tool-name> --args '<json>' [--confirm]
  oumomo-agent --version | --help

The CLI is a thin client: tools, model calls, and adapter execution all
happen on the Oumomo server. Do not pass credentials, files, or shell
fragments from untrusted sources.

Environment variables:
  OUMOMO_API_BASE_URL       API origin (default: https://www.oumomo.ai)
  OUMOMO_CLI_API_URL        Same, overrides OUMOMO_API_BASE_URL
  OUMOMO_CLI_STATE_DIR      Override credential directory
  OUMOMO_CLI_BROWSER=skip   Disable browser auto-launch (CI / smoke tests)
  OUMOMO_CLI_DEBUG=1        Forward internal [OBSERVABILITY] / [GO_API] logs
  NO_COLOR                  Disable ANSI colors (TUI layout remains)
`;

function writeStdout(value: string): void {
  process.stdout.write(value.endsWith('\n') ? value : `${value}\n`);
}

function writeStderr(value: string): void {
  process.stderr.write(value.endsWith('\n') ? value : `${value}\n`);
}

export async function runCli(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  let args: ParsedCliArgs;
  try {
    args = parseCliArgs(argv);
  } catch (error) {
    writeStderr(`oumomo-agent: ${sanitizeCliError(error)}`);
    return 1;
  }

  if (hasFlag(args, 'version') || args.command === 'version' || args.command === '--version' || args.command === '-v') {
    writeStdout(readVersion());
    return 0;
  }
  if (hasFlag(args, 'help') || args.command === 'help' || args.command === '--help' || args.command === '-h') {
    writeStdout(USAGE);
    return 0;
  }

  try {
    switch (args.command) {
      case 'setup':
        await runSetup(args);
        return 0;
      case 'auth': {
        const [action = 'status'] = args.positionals;
        if (action === 'logout') {
          await runAuthLogout();
          return 0;
        }
        if (action === 'status' || action === 'login') {
          await runAuthStatus();
          return 0;
        }
        throw new Error('Usage: oumomo-agent auth <status|logout>.');
      }
      case 'image': {
        const [action = ''] = args.positionals;
        if (action !== 'upload') {
          throw new Error('Usage: oumomo-agent image upload --file <path>.');
        }
        await runImageUpload({
          ...args,
          positionals: args.positionals.slice(1),
        });
        return 0;
      }
      case 'tool': {
        const [subcommand = 'list', ...rest] = args.positionals;
        if (subcommand === 'list') {
          await runToolList(args);
          return 0;
        }
        if (subcommand === 'describe') {
          await runToolDescribe({ ...args, positionals: rest });
          return 0;
        }
        if (subcommand === 'call') {
          await runToolCall({ ...args, positionals: rest });
          return 0;
        }
        // Compatibility with the published skill contract and the original
        // CLI: `tool <name> --args` is the compact form of `tool call`.
        await runToolCall(args);
        return 0;
      }
      default:
        writeStdout(USAGE);
        return 1;
    }
  } catch (error) {
    writeStderr(`oumomo-agent: ${sanitizeCliError(error)}`);
    return 1;
  }
}

if (
  process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolvePath(process.argv[1]))
) {
  const exitCode = await runCli();
  process.exitCode = exitCode;
}
