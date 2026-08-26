#!/usr/bin/env node
import { chmod, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const BIN_PATH = path.join(ROOT_DIR, 'dist', 'bin.js');

async function ensureExecutable(targetPath) {
  const source = await readFile(targetPath, 'utf8');
  if (!source.startsWith('#!')) {
    throw new Error(`Refusing to chmod a non-shebang file: ${targetPath}`);
  }
  const metadata = await stat(targetPath);
  // Add the executable bit for the current user without disturbing other bits.
  const nextMode = metadata.mode | 0o100;
  if (process.platform !== 'win32') {
    await chmod(targetPath, nextMode);
  }
  // Re-write the shebang so it points at /usr/bin/env node explicitly even on
  // Windows where chmod is a no-op for the executable bit.
  await writeFile(targetPath, source, { encoding: 'utf8', mode: nextMode });
}

ensureExecutable(BIN_PATH)
  .then(() => {
    console.log(`[oumomo-agent] dist/bin.js is executable.`);
  })
  .catch((error) => {
    console.error(`[oumomo-agent] failed to make bin.js executable: ${error.message}`);
    process.exit(1);
  });
