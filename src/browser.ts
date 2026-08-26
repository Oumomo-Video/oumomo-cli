/**
 * Cross-platform browser launcher + agent-auth URL builder.
 * Reused verbatim from the previous fat CLI to preserve the `oumomo-agent setup`
 * experience (the user opens the same Oumomo login URL).
 */
import { spawn } from 'node:child_process';

export function buildAgentAuthUrl(
  verificationUrl: string,
  apiBaseUrl: string,
  query: Readonly<Record<string, string | undefined>>,
): string {
  const verification = new URL(verificationUrl);
  const api = new URL(apiBaseUrl);
  if (verification.origin !== api.origin || verification.pathname !== '/api/oauth/device') {
    throw new Error('The OAuth server returned an invalid verification URL.');
  }

  const agentAuth = new URL('/agent-auth', api.origin);
  agentAuth.searchParams.set('from', verification.toString());
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'from' && value) agentAuth.searchParams.set(key, value);
  }
  return agentAuth.toString();
}

/** Open the Oumomo browser login page without requiring an MCP credential. */
export function openBrowserUrl(url: string, platform: string = process.platform): boolean {
  try {
    const parsed = new URL(url);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) return false;
    if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
      return true;
    }
    if (platform === 'win32') {
      spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      return true;
    }
    if (platform === 'linux' || platform === 'freebsd' || platform === 'openbsd') {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
