/**
 * `oumomo-agent setup [--api-url <url>] [--utm-* ...]`
 *
 * OAuth device flow with browser launch and a small TUI spinner.
 * The browser is opened as soon as the authorization response arrives —
 * no Enter-to-continue prompt.
 */
import { buildAgentAuthUrl, openBrowserUrl } from './browser.js';
import { getOption } from './cli-args.js';
import { resolveDeviceVerificationUrl, resolveApiBaseUrl } from './api-base.js';
import { DeviceAuthError, runDeviceFlow } from './device-auth.js';
import { writeCredential } from './credentials.js';
import { printSetupLogin, printSetupSuccess, startSetupWaitingIndicator } from './tui.js';
import type { ParsedCliArgs } from './cli-args.js';

const BROWSER_SKIP_ENV = 'OUMOMO_CLI_BROWSER';

export async function runSetup(args: ParsedCliArgs): Promise<void> {
  const apiBaseUrl = resolveApiBaseUrl(getOption(args, 'api-url'));
  const utmSource = getOption(args, 'utm-source') || 'oumomo-agent';
  const utmMedium = getOption(args, 'utm-medium') || 'cli';
  const utmCampaign = getOption(args, 'utm-campaign') || 'agent_setup';
  const utmContent = getOption(args, 'utm-content') || 'device_oauth';

  let stopWaiting: () => void = () => undefined;
  let credential: Awaited<ReturnType<typeof runDeviceFlow>>;
  try {
    credential = await runDeviceFlow({
      apiBaseUrl,
      onAuthorization: (authorization) => {
        const verificationUrl = resolveDeviceVerificationUrl(authorization);
        const loginUrl = buildAgentAuthUrl(verificationUrl, apiBaseUrl, {
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
        });
        const opened = shouldOpenBrowser() ? openBrowserUrl(loginUrl) : false;
        printSetupLogin(loginUrl, opened);
        stopWaiting = startSetupWaitingIndicator();
      },
    });
  } catch (error) {
    stopWaiting();
    throw error;
  } finally {
    stopWaiting();
  }

  await writeCredential({
    apiBaseUrl: credential.apiBaseUrl,
    cookie: credential.cookie,
    email: credential.email,
    accessToken: credential.accessToken,
    ...(credential.refreshToken ? { refreshToken: credential.refreshToken } : {}),
    ...(credential.accessTokenExpiresAt ? { accessTokenExpiresAt: credential.accessTokenExpiresAt } : {}),
    ...(credential.operatorId ? { operatorId: credential.operatorId } : {}),
    ...(credential.merchantId ? { merchantId: credential.merchantId } : {}),
  });
  printSetupSuccess(credential.email);
}

function shouldOpenBrowser(): boolean {
  const value = process.env[BROWSER_SKIP_ENV];
  if (!value) return true;
  return value.toLowerCase() !== 'skip' && value !== '0' && value.toLowerCase() !== 'false';
}

// Re-export the device-auth error so callers (bin.ts) can pattern-match without
// importing both modules.
export { DeviceAuthError };
