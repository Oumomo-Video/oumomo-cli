import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Capability = {
  id: string;
  name_zh: string;
  command: string;
  availability: 'ready' | 'preview';
  durations?: number[];
};

export async function listCapabilities(): Promise<Capability[]> {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDirectory, '..', 'capabilities.json'),
    path.resolve(moduleDirectory, '..', '..', 'capabilities.json'),
  ];
  for (const file of candidates) {
    try {
      const manifest = JSON.parse(await readFile(file, 'utf8')) as { capabilities?: Capability[] };
      if (Array.isArray(manifest.capabilities)) return manifest.capabilities;
    } catch {
      // Try the source-tree/package layout fallback.
    }
  }
  throw new Error('The Oumomo capability manifest is missing.');
}
