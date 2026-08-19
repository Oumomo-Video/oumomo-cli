import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readCredential, writeCredential } from '../src/credentials.js';

const home = await mkdtemp(path.join(os.tmpdir(), 'oumomo-cli-public-'));
await writeCredential({ kind: 'mcp', apiUrl: 'https://example.test', mcpKey: 'omcp_test', updatedAt: '' }, { OUMOMO_CLI_HOME: home });
assert.equal((await readCredential({ OUMOMO_CLI_HOME: home }))?.kind, 'mcp');
console.log('public credential test passed');
