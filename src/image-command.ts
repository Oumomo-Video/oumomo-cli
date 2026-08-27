import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { resolveApiBaseUrl } from './api-base.js';
import { getOption } from './cli-args.js';
import { readCredential } from './credentials.js';
import type { ParsedCliArgs } from './cli-args.js';

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MIME_TYPES: Readonly<Record<string, string>> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function uploadHeaders(meta: Record<string, unknown>, mimeType: string): Record<string, string> {
  const signed = (meta.header || meta.headers || {}) as Record<string, unknown>;
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(signed)) {
    if (value === undefined || value === null) continue;
    if (['content-length', 'host', 'user-agent'].includes(key.toLowerCase())) continue;
    headers[key] = String(value);
  }
  if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
    headers['content-type'] = mimeType;
  }
  return headers;
}

export async function runImageUpload(args: ParsedCliArgs): Promise<void> {
  const filePath = getOption(args, 'file');
  if (!filePath) throw new Error('`image upload` requires `--file <path>`.');
  const credential = await readCredential();
  if (!credential) throw new Error('No Oumomo CLI session is available. Run `oumomo-agent setup` first.');

  const absolutePath = path.resolve(filePath);
  const metadata = await stat(absolutePath);
  if (!metadata.isFile()) throw new Error(`Image is not a file: ${absolutePath}`);
  if (metadata.size <= 0 || metadata.size > MAX_IMAGE_BYTES) throw new Error('Image size must be between 1 byte and 50 MiB.');
  const mimeType = MIME_TYPES[path.extname(absolutePath).toLowerCase()];
  if (!mimeType) throw new Error('Images must use .jpg, .jpeg, .png, or .webp.');
  const fileName = path.basename(absolutePath);
  const apiBaseUrl = resolveApiBaseUrl(getOption(args, 'api-url'));

  const presignResponse = await fetch(new URL('/api/file/get_presigns', `${apiBaseUrl}/`), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      cookie: credential.cookie,
      source: 'pc',
    },
    body: JSON.stringify({
      file_list: [{ type: 'img', file_name: fileName, file_size: metadata.size, file_type: mimeType }],
      scene: 'video_clone',
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const presignBody = (await presignResponse.json().catch(() => ({}))) as Record<string, any>;
  if (!presignResponse.ok || Number(presignBody.code) !== 0) {
    throw new Error(String(presignBody.msg || `Image presign failed (HTTP ${presignResponse.status}).`));
  }
  const uploadMeta = presignBody.data?.file_list?.[0] as Record<string, any> | undefined;
  if (!uploadMeta?.presign_url || !uploadMeta?.file_no) throw new Error('Image presign response is incomplete.');

  const bytes = await readFile(absolutePath);
  const uploadResponse = await fetch(String(uploadMeta.presign_url), {
    method: 'PUT',
    headers: uploadHeaders(uploadMeta, mimeType),
    body: bytes,
    signal: AbortSignal.timeout(180_000),
  });
  if (!uploadResponse.ok) throw new Error(`Image storage upload failed (HTTP ${uploadResponse.status}).`);

  process.stdout.write(`${JSON.stringify({
    success: true,
    image: {
      fileNo: String(uploadMeta.file_no),
      fileName,
      mimeType,
      size: metadata.size,
    },
  }, null, 2)}\n`);
}
