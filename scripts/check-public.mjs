import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const forbidden = /BFF_INTERNAL_HMAC_SECRET|LLM_GATEWAY_API_KEY|DATABASE_URL\s*=|REDIS_URL\s*=|ALLYNEXT_ACCESS_TOKEN|FASTMOSS_CLIENT_SECRET|token_prod=[^<\s]+|omcp_[A-Za-z0-9_-]{12,}/i;
const roots = ['src', 'docs', 'connectors', 'README.md', 'SECURITY.md'];
const files = [];
function walk(relative) {
  const absolute = path.resolve(relative);
  if (!statSync(absolute).isDirectory()) return files.push(relative);
  for (const item of readdirSync(absolute)) {
    if (['node_modules', 'dist', '.git'].includes(item)) continue;
    walk(path.join(relative, item));
  }
}
for (const root of roots) walk(root);
const hits = files.flatMap((file) => {
  const value = readFileSync(file, 'utf8');
  return forbidden.test(value) ? [file] : [];
});
if (hits.length) throw new Error(`Potential private configuration found: ${hits.join(', ')}`);
execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
console.log(`public repository check passed (${files.length} files)`);
