/**
 * Minimal in-terminal UI helpers. Single-line spinner + boxed header.
 * NO_COLOR keeps the layout but strips ANSI. Non-TTY callers get plain text.
 */

function isTty(stream: NodeJS.WriteStream | NodeJS.ReadStream | null | undefined): boolean {
  return Boolean(stream && stream.isTTY);
}

export function isSetupTuiEnabled(): boolean {
  return isTty(process.stdout) && isTty(process.stderr);
}

function ansi(open: string): string {
  return process.env.NO_COLOR ? '' : open;
}

const RESET = ansi('\x1b[0m');
const BOLD = ansi('\x1b[1m');
const MUTED = ansi('\x1b[2m');
const PINK = ansi('\x1b[38;5;213m');
const CYAN = ansi('\x1b[38;5;87m');
const GREEN = ansi('\x1b[38;5;84m');

export function printSetupLogin(loginUrl: string, opened: boolean): void {
  if (!isSetupTuiEnabled()) {
    process.stdout.write(`Oumomo CLI\n${opened ? '浏览器已打开，请完成登录。' : '请在浏览器中打开以下链接：'}\n${loginUrl}\n`);
    return;
  }
  const state = opened ? `${CYAN}✓ 浏览器已打开${RESET}` : `${PINK}! 请手动打开登录链接${RESET}`;
  process.stdout.write(
    `\n  ${BOLD}${PINK}Oumomo${RESET}  ${MUTED}CLI Connection${RESET}\n`
      + `  ${MUTED}────────────────────────────────${RESET}\n`
      + `  ${state}\n`
      + `  ${MUTED}${loginUrl}${RESET}\n\n`,
  );
}

export function startSetupWaitingIndicator(): () => void {
  const message = '等待浏览器完成登录...';
  if (!isSetupTuiEnabled()) {
    process.stderr.write(`${message}\n`);
    return () => undefined;
  }
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let index = 0;
  const render = () => process.stderr.write(`\r  ${PINK}${frames[index++ % frames.length]}${RESET} ${message}`);
  render();
  const timer = setInterval(render, 80);
  return () => {
    clearInterval(timer);
    process.stderr.write('\r\x1b[2K');
  };
}

export function printSetupSuccess(account: string): void {
  if (!isSetupTuiEnabled()) {
    process.stdout.write(`Oumomo CLI 已连接：${account}\n`);
    return;
  }
  process.stdout.write(`  ${GREEN}✓${RESET} ${BOLD}连接成功${RESET}  ${MUTED}${account}${RESET}\n\n`);
}
