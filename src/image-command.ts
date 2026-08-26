/**
 * `oumomo-agent image upload --file <path>`
 *
 * Streams the local file as multipart/form-data to the Oumomo direct-tool
 * endpoint `/api/cli/image/upload`. The credential's session cookie is
 * forwarded for authentication; the server is responsible for the actual
 * presign + PUT + register dance.
 *
 * The body is sent as a streaming ReadableStream so a 50 MB product image
 * never results in two copies in memory. We also set a pre-computed
 * `Content-Length` so the server can stream the upload without buffering.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

import { resolveApiBaseUrl } from './api-base.js';
import { getOption } from './cli-args.js';
import { readCredential } from './credentials.js';
import { sanitizeCliError } from './redactor.js';
import type { ParsedCliArgs } from './cli-args.js';

const DEFAULT_MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const SUPPORTED_IMAGE_MIME_TYPES: Readonly<Record<string, string>> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function detectMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = SUPPORTED_IMAGE_MIME_TYPES[extension];
  if (!mimeType) {
    throw new Error('Images must use .jpg, .jpeg, .png, or .webp.');
  }
  return mimeType;
}

function escapeQuotes(value: string): string {
  return value.replace(/[\\"]/g, (match) => `\\${match}`);
}

function buildMultipartPreamble(boundary: string, fileName: string, mimeType: string): Buffer {
  return Buffer.from(
    `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="file"; filename="${escapeQuotes(fileName)}"\r\n`
      + `Content-Type: ${mimeType}\r\n\r\n`,
    'utf8',
  );
}

function buildMultipartEpilogue(boundary: string): Buffer {
  return Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
}

function generateBoundary(): string {
  return `oumomo-agent-${Date.now().toString(36)}-${randomBytes(8).toString('hex')}`;
}

export async function runImageUpload(args: ParsedCliArgs): Promise<void> {
  const filePath = getOption(args, 'file');
  if (!filePath) {
    throw new Error('`image upload` requires `--file <path>`.');
  }
  const apiBaseUrl = resolveApiBaseUrl(getOption(args, 'api-url'));
  const credential = await readCredential();
  if (!credential) {
    throw new Error('No Oumomo CLI session is available. Run `oumomo-agent setup` first.');
  }

  const absolutePath = path.resolve(filePath);
  const metadata = await stat(absolutePath);
  if (!metadata.isFile()) throw new Error(`Image is not a file: ${absolutePath}`);
  if (metadata.size > DEFAULT_MAX_IMAGE_BYTES) {
    throw new Error('Images larger than 50 MiB are not accepted by the CLI transport.');
  }
  const mimeType = detectMimeType(absolutePath);
  const fileName = path.basename(absolutePath);

  const boundary = generateBoundary();
  const preamble = buildMultipartPreamble(boundary, fileName, mimeType);
  const epilogue = buildMultipartEpilogue(boundary);
  const contentLength = preamble.byteLength + metadata.size + epilogue.byteLength;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(preamble.buffer, preamble.byteOffset, preamble.byteLength));
      const fileStream = createReadStream(absolutePath);
      fileStream.on('data', (chunk: Buffer | string) => {
        const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
      });
      fileStream.on('error', (error) => controller.error(error));
      fileStream.on('end', () => {
        controller.enqueue(new Uint8Array(epilogue.buffer, epilogue.byteOffset, epilogue.byteLength));
        controller.close();
      });
    },
  });

  const response = await fetch(new URL('/api/cli/image/upload', `${apiBaseUrl}/`), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      cookie: credential.cookie,
      source: 'oumomo-agent-cli',
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(contentLength),
    },
    body,
    // fetch in Node 20 will not buffer ReadableStream bodies if a
    // content-length header is provided.
    duplex: 'half',
  } as RequestInit);

  if (!response.ok) {
    const detail = await readErrorBody(response);
    throw new Error(`Image upload failed (HTTP ${response.status}): ${detail}`);
  }
  const payload = (await response.json()) as { success?: boolean; image?: unknown; error?: string };
  if (!payload.success) {
    throw new Error(`Image upload rejected: ${payload.error || 'unknown server error'}`);
  }
  process.stdout.write(`${JSON.stringify({ success: true, image: payload.image }, null, 2)}\n`);
}

function readErrorBody(response: Response): Promise<string> {
  return response.text().then((raw) => {
    if (!raw) return response.statusText || 'empty response body';
    try {
      const parsed = JSON.parse(raw) as { msg?: unknown; error?: unknown; message?: unknown };
      return String(parsed.msg || parsed.error || parsed.message || raw).slice(0, 500);
    } catch {
      return sanitizeCliError(raw).slice(0, 500);
    }
  });
}
