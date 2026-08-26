// Pure-data redactor. Used by every command to scrub Cookie / Authorization /
// inline base64 payloads from anything that might leak to the terminal.

const SENSITIVE_KEY_PATTERN = /cookie|authorization|access.?token|refresh.?token|password|secret|bearer/i;
const SESSION_COOKIE_PATTERN = /token_[A-Za-z0-9_-]+=([^;\s]+)/g;
const INLINE_DATA_URL_PATTERN = /data:[^\s]+;base64,[A-Za-z0-9+/=]+/g;

export function redactString(value: string): string {
  return value
    .replace(SESSION_COOKIE_PATTERN, 'token_[redacted]')
    .replace(INLINE_DATA_URL_PATTERN, '[inline-data-omitted]');
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.startsWith('data:') ? '[inline-data-omitted]' : value;
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) return [key, '[redacted]'];
      return [key, redactValue(item)];
    }));
  }
  return value;
}

/**
 * Sanitize an error message before printing it. Replaces session cookies and
 * inline base64 payloads, collapses newlines, and clamps length.
 */
export function sanitizeCliError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'Unknown CLI error');
  return redactString(raw)
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 1000);
}
