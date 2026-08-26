import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CliArgumentError, getOption, getOptions, hasFlag, parseCliArgs } from '../src/cli-args.js';

test('parses a simple command with one flag and a positional', () => {
  const args = parseCliArgs(['tool', 'list', '--skill', 'oumomo-video-replica']);
  assert.equal(args.command, 'tool');
  assert.deepEqual(args.positionals, ['list']);
  assert.equal(getOption(args, 'skill'), 'oumomo-video-replica');
});

test('treats leading flags as the help command', () => {
  const args = parseCliArgs(['--help']);
  assert.equal(args.command, 'help');
  assert.equal(hasFlag(args, 'help'), true);
});

test('accepts --key=value form', () => {
  const args = parseCliArgs(['setup', '--api-url=https://test.oumomo.ai']);
  assert.equal(args.command, 'setup');
  assert.equal(getOption(args, 'api-url'), 'https://test.oumomo.ai');
});

test('keeps the last value for repeated flags', () => {
  const args = parseCliArgs(['setup', '--api-url', 'https://a.oumomo.ai', '--api-url', 'https://b.oumomo.ai']);
  assert.equal(getOption(args, 'api-url'), 'https://b.oumomo.ai');
});

test('collects all values when using getOptions', () => {
  const args = parseCliArgs(['tool', 'call', 'video_replica_search', '--input', '{}', '--confirm', '--confirm']);
  assert.deepEqual(getOptions(args, 'confirm'), ['true', 'true']);
  assert.equal(hasFlag(args, 'confirm'), true);
});

test('treats --flag with no value as the literal string "true"', () => {
  const args = parseCliArgs(['tool', 'call', 'foo', '--confirm']);
  assert.equal(getOption(args, 'confirm'), 'true');
  assert.equal(hasFlag(args, 'confirm'), true);
});

test('rejects empty option names', () => {
  assert.throws(() => parseCliArgs(['--']), (error: unknown) => error instanceof CliArgumentError);
});

test('preserves positional order', () => {
  const args = parseCliArgs(['tool', 'describe', 'video_replica_search']);
  assert.deepEqual(args.positionals, ['describe', 'video_replica_search']);
  assert.equal(args.command, 'tool');
});
