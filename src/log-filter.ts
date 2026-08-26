// Must stay first: installs the console patch before any other module's
// top-level side effects run.
const INTERNAL_LOG_PREFIXES = [
  '[TOOL_REGISTRY]',
  '[TOOL_RESULT]',
  '[GO_API]',
  '[GO_API_START]',
  '[GO_API_FAIL]',
  '[AGENT]',
  '[AGENT_TOOL_API]',
  '[OBSERVABILITY]',
  '[INFO]',
  '[WARN]',
  '[ERROR]',
  '[DEBUG]',
  '[VIDEO_BREAKDOWN]',
  '[first_video_metrics]',
  '[video_replica_search',
  '[video_clone',
  '[MEDIA_UPLOAD_START]',
  '[MEDIA_UPLOAD_END]',
  '[MEDIA_TRANSFORM_START]',
  '[MEDIA_TRANSFORM_END]',
  '[DB]',
  '[DB_PERF]',
  '[AUTH_CACHE]',
  '[AUTH_DEDUP]',
  '[MEMORY_FALLBACK]',
  '[MEMORY_HISTORY_INDUCTION]',
  '[memory-maintenance]',
  '[MemoryTreeQueue]',
  '[TASK_PROGRESS_PERSIST]',
  '[SKILL_LOAD]',
  '[IDENTITY_INTERNAL]',
  '[logger]',
];

export function isOumomoCliDebugLoggingEnabled(
  env: { OUMOMO_CLI_DEBUG?: string | undefined } = process.env,
): boolean {
  const value = env.OUMOMO_CLI_DEBUG;
  return value === '1' || value === 'true';
}

function isInternalLogLine(firstArg: unknown): boolean {
  return typeof firstArg === 'string' && INTERNAL_LOG_PREFIXES.some((prefix) => firstArg.startsWith(prefix));
}

export function installOumomoCliLogFilter(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  if ((console.log as { __oumomoCliLogFilter?: boolean }).__oumomoCliLogFilter || isOumomoCliDebugLoggingEnabled(env)) {
    return INTERNAL_LOG_PREFIXES;
  }

  if (!env.LOG_CONSOLE) env.LOG_CONSOLE = 'false';

  const nativeLog = console.log.bind(console);
  const nativeWarn = console.warn.bind(console);
  const filteredLog = (...args: unknown[]) => {
    if (!isInternalLogLine(args[0])) nativeLog(...args);
  };
  const filteredWarn = (...args: unknown[]) => {
    if (!isInternalLogLine(args[0])) nativeWarn(...args);
  };
  (filteredLog as { __oumomoCliLogFilter?: boolean }).__oumomoCliLogFilter = true;
  (filteredWarn as { __oumomoCliLogFilter?: boolean }).__oumomoCliLogFilter = true;
  console.log = filteredLog;
  console.warn = filteredWarn;
  return INTERNAL_LOG_PREFIXES;
}

installOumomoCliLogFilter();
