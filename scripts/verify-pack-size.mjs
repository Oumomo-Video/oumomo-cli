#!/usr/bin/env node
// Verifies the published tgz stays under the size budget. Intended to be
// invoked manually after `npm pack` succeeds.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');

const TARBALL_BUDGET_BYTES = 200 * 1024;
const UNPACKED_BUDGET_BYTES = 1024 * 1024;
const FILE_COUNT_BUDGET = 50;
const PROD_DEP_BUDGET = 0;

const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: ROOT_DIR,
  encoding: 'utf8',
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

const parsed = JSON.parse(result.stdout);
const entry = Array.isArray(parsed) ? parsed[0] : parsed;

const summary = {
  tarball: {
    filename: entry.filename,
    files: entry.entryCount,
    unpackedSize: entry.unpackedSize,
    shasum: entry.shasum,
    integrity: entry.integrity,
  },
  budgets: {
    tarballBytes: TARBALL_BUDGET_BYTES,
    unpackedBytes: UNPACKED_BUDGET_BYTES,
    fileCount: FILE_COUNT_BUDGET,
    prodDeps: PROD_DEP_BUDGET,
  },
};

console.log(JSON.stringify(summary, null, 2));

const failures = [];
const packageJson = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(path.join(ROOT_DIR, 'package.json'), 'utf8')));
const prodDeps = Object.keys(packageJson.dependencies || {}).length;
if (entry.unpackedSize > UNPACKED_BUDGET_BYTES) {
  failures.push(`unpackedSize ${entry.unpackedSize} exceeds ${UNPACKED_BUDGET_BYTES}`);
}
if (entry.entryCount > FILE_COUNT_BUDGET) {
  failures.push(`entryCount ${entry.entryCount} exceeds ${FILE_COUNT_BUDGET}`);
}
if (prodDeps > PROD_DEP_BUDGET) {
  failures.push(`prodDependencies ${prodDeps} exceeds ${PROD_DEP_BUDGET}`);
}

if (failures.length > 0) {
  console.error('Pack size check failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(2);
}
console.log('Pack size within budget.');
