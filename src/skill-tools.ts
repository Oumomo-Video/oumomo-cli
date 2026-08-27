/**
 * Single source of truth for which tools the slim CLI exposes. Mirrors
 * the published `oumomo-video-replica` skill's tool list exactly — the
 * server also enforces this set, so adding a tool here requires a
 * corresponding server-side registration.
 */

export const OUMOMO_VIDEO_REPLICA_TOOLS = [
  'url_to_video_fetch_product',
  'video_replica_search',
  'video_replica_generate_video',
  'replica_progress',
  'replica_project_result',
] as const;

export type OumomoVideoReplicaTool = typeof OUMOMO_VIDEO_REPLICA_TOOLS[number];

export const OUMOMO_VIDEO_REPLICA_TOOL_DESCRIPTIONS: Readonly<Record<OumomoVideoReplicaTool, string>> = {
  url_to_video_fetch_product: 'Resolve a TikTok Shop / FastMoss product-detail URL into a normalized product + category context.',
  video_replica_search: 'Search the Oumomo viral reference catalog by category, market, and date window.',
  video_replica_generate_video: 'Submit a viral-remake generation request. Triggers a real model job and incurs cost.',
  replica_progress: 'Poll the progress of a previously submitted viral-remake task.',
  replica_project_result: 'Fetch the final result (video URL, poster, metadata) for a completed viral-remake task.',
};

const TOOL_SET: ReadonlySet<string> = new Set(OUMOMO_VIDEO_REPLICA_TOOLS);

export function isPublishedSkillTool(name: string): name is OumomoVideoReplicaTool {
  return TOOL_SET.has(name);
}

export const REQUIRES_CONFIRMATION_TOOLS: ReadonlySet<string> = new Set([
  'video_replica_generate_video',
]);

export function requiresConfirmation(name: string): boolean {
  return REQUIRES_CONFIRMATION_TOOLS.has(name);
}

export function listPublishedToolNames(): string[] {
  return [...OUMOMO_VIDEO_REPLICA_TOOLS];
}
