/**
 * `oumomo-agent auth status` / `oumomo-agent auth logout`.
 *
 * `auth status` reads the local credential and reports whether the user is
 * signed in. It deliberately does not call the network — the credential
 * already contains the email; a server roundtrip would add latency and a
 * dependency on transient network health to a status check.
 */

import { clearCredential, readCredential, type OumomoCliCredential } from './credentials.js';
import type { ParsedCliArgs } from './cli-args.js';
import { getOption } from './cli-args.js';

export async function runAuthStatus(): Promise<void> {
  try {
    const credential = await readCredential();
    if (!credential) {
      throw new Error('No Oumomo CLI session is available. Run `oumomo-agent setup` first.');
    }
    printAuthStatus(credential);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ authenticated: false, error: friendlyMessage(error) })}\n`);
    throw error;
  }
}

function printAuthStatus(credential: OumomoCliCredential): void {
  process.stdout.write(`${JSON.stringify({
    authenticated: true,
    account: credential.email,
    apiBaseUrl: credential.apiBaseUrl,
    authType: credential.accessToken ? 'oauth' : 'password',
    operatorId: credential.operatorId,
    merchantId: credential.merchantId,
    updatedAt: credential.updatedAt,
  }, null, 2)}\n`);
}

export async function runAuthLogout(): Promise<void> {
  await clearCredential();
  process.stdout.write('Signed out.\n');
}

function friendlyMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// Allow `auth <action>` form so the bin dispatcher can pass through either
// `oumomo-agent auth status` or `oumomo-agent auth logout` directly. The
// dispatcher strips the `auth` token before calling this module.
export interface AuthActionArgs {
  args: ParsedCliArgs;
  action: 'status' | 'logout';
}

export async function runAuthAction({ action }: AuthActionArgs): Promise<void> {
  if (action === 'logout') return runAuthLogout();
  return runAuthStatus();
}

// `getOption` re-export so bin.ts has a single place to import it from. Kept
// here as a no-op binding to avoid an unused import warning when only the
// runAuthStatus / runAuthLogout entry points are used.
void getOption;
