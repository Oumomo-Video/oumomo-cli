import type { OumomoCliCredential } from './credentials.js';

export interface DirectToolDefinition {
  name: string;
  description: string;
  requiresConfirmation: boolean;
  parameters: Record<string, unknown>;
  execute: (input: Record<string, unknown>, context: DirectToolContext) => Promise<unknown>;
}

interface DirectToolContext {
  apiBaseUrl: string;
  credential: OumomoCliCredential;
}

interface ApiResponse {
  code?: string | number;
  data?: unknown;
  msg?: string;
  message?: string;
  request_id?: string;
  [key: string]: unknown;
}

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});

const stringProperty = (description: string) => ({ type: 'string', description });
const numberProperty = (description: string, values?: number[]) => ({
  type: 'number',
  description,
  ...(values ? { enum: values } : {}),
});

function apiHeaders(cookie: string, contentType?: string): Record<string, string> {
  return {
    accept: 'application/json',
    cookie,
    source: 'pc',
    'user-agent': 'OumomoAgent/1.0',
    ...(contentType ? { 'content-type': contentType } : {}),
  };
}

async function requestApi(
  path: string,
  context: DirectToolContext,
  options: { method?: string; body?: Record<string, unknown>; form?: boolean } = {},
): Promise<ApiResponse> {
  const formBody = options.form && options.body
    ? new URLSearchParams(Object.entries(options.body).flatMap(([key, value]) => (
      value === undefined || value === null ? [] : [[key, String(value)]]
    )))
    : undefined;
  const response = await fetch(new URL(path, `${context.apiBaseUrl}/`), {
    method: options.method || 'GET',
    headers: apiHeaders(
      context.credential.cookie,
      options.body ? (options.form ? 'application/x-www-form-urlencoded' : 'application/json') : undefined,
    ),
    body: formBody?.toString() || (options.body ? JSON.stringify(options.body) : undefined),
    signal: AbortSignal.timeout(120_000),
  });
  const payload = (await response.json().catch(() => ({}))) as ApiResponse;
  if (!response.ok) {
    throw new Error(String(payload.msg || payload.message || `Oumomo API returned HTTP ${response.status}.`));
  }
  return payload;
}

function successful(payload: ApiResponse): boolean {
  return payload.code === undefined || payload.code === 0 || payload.code === '0';
}

function normalizedResult(payload: ApiResponse): Record<string, unknown> {
  return {
    success: successful(payload),
    code: payload.code ?? 0,
    data: payload.data,
    msg: String(payload.msg || payload.message || ''),
    request_id: String(payload.request_id || ''),
  };
}

function requiredString(input: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function positiveInteger(value: unknown, fallback: number, max?: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

function normalizeRegion(value: unknown): string {
  const aliases: Record<string, string> = {
    USA: 'US', 'UNITED STATES': 'US', 美国: 'US', 美区: 'US',
    UK: 'GB', 'UNITED KINGDOM': 'GB', 英国: 'GB',
    日本: 'JP', 韩国: 'KR', 印尼: 'ID', 越南: 'VN', 泰国: 'TH',
  };
  const raw = typeof value === 'string' ? value.trim() : '';
  return aliases[raw.toUpperCase()] || aliases[raw] || raw.toUpperCase();
}

async function fetchProduct(input: Record<string, unknown>, context: DirectToolContext) {
  const productUrl = requiredString(input, 'url', 'productUrl');
  if (!/^https?:\/\//i.test(productUrl)) throw new Error('A valid TikTok Shop or FastMoss product URL is required.');
  const payload = await requestApi(
    `/api/link_video/get_product_info?product_url=${encodeURIComponent(productUrl)}`,
    context,
  );
  return normalizedResult(payload);
}

async function searchVideos(input: Record<string, unknown>, context: DirectToolContext) {
  const region = normalizeRegion(input.region || input.country);
  const category = requiredString(input, 'words', 'category', 'title');
  const body: Record<string, unknown> = {
    region: input.searchAllCountries === true ? '' : region,
    words: category,
    page: positiveInteger(input.page, 1),
    pagesize: positiveInteger(input.pagesize, 12, 12),
    sort: positiveInteger(input.sort, 15),
    date_type: positiveInteger(input.date_type, 14),
    l1_cid: requiredString(input, 'l1_cid'),
    l2_cid: requiredString(input, 'l2_cid'),
    l3_cid: requiredString(input, 'l3_cid'),
    word_type: 4,
    play_count: requiredString(input, 'play_count'),
    gmv: requiredString(input, 'gmv'),
  };
  if (input.is_aigc !== undefined) body.is_aigc = Number(input.is_aigc);
  const payload = await requestApi('/api/video_clone/search_video', context, {
    method: 'POST', body, form: true,
  });
  const result = normalizedResult(payload);
  if (result.data && typeof result.data === 'object') {
    const data = result.data as Record<string, unknown>;
    const listKey = Array.isArray(data.ad_list) ? 'ad_list' : Array.isArray(data.list) ? 'list' : undefined;
    if (listKey) {
      result.data = {
        ...data,
        [listKey]: (data[listKey] as unknown[]).map((item) => {
          if (!item || typeof item !== 'object') return item;
          const record = item as Record<string, unknown>;
          const videoId = String(record.video_id || '').trim();
          const videoUrl = videoId ? `https://www.tiktok.com/video/${videoId}` : '';
          return { ...record, ...(videoUrl ? { videoUrl, url: videoUrl } : {}) };
        }),
      };
    }
  }
  return result;
}

function normalizeRatio(value: unknown): number {
  return value === 1 || value === '1' || value === '16:9' ? 1 : 0;
}

function normalizeLanguage(value: unknown): string {
  const raw = String(value || 'EN_US').trim().replace('-', '_').toUpperCase();
  const aliases: Record<string, string> = { EN: 'EN_US', ZH: 'ZH_CN', JA: 'JA_JP', JP: 'JA_JP', ES: 'ES_ES' };
  return aliases[raw] || raw;
}

async function resolveReferenceVideoId(videoUrl: string, context: DirectToolContext): Promise<string> {
  if (!videoUrl) return '';
  const payload = await requestApi('/api/tools/get_tt_video_url', context, {
    method: 'POST',
    body: { video_url: videoUrl },
  });
  if (!successful(payload) || !payload.data || typeof payload.data !== 'object') return '';
  return requiredString(payload.data as Record<string, unknown>, 'video_id', 'videoId');
}

async function generateVideo(input: Record<string, unknown>, context: DirectToolContext) {
  const videoUrl = requiredString(input, 'videoUrl', 'referenceVideoUrl');
  let videoId = requiredString(input, 'videoId');
  if (!/^\d+$/.test(videoId) && videoUrl) videoId = videoUrl.match(/\/video\/(\d+)/)?.[1] || '';
  if (!/^\d+$/.test(videoId) && videoUrl) videoId = await resolveReferenceVideoId(videoUrl, context);
  if (!/^\d+$/.test(videoId)) throw new Error('A numeric reference videoId or TikTok video URL is required.');

  const fileNo = requiredString(input, 'productImageFileNo', 'fileNo');
  if (!/^pres_/i.test(fileNo)) throw new Error('Upload a product image first and pass its pres_ file number.');

  const seconds = positiveInteger(input.seconds, 15);
  if (![10, 15, 30].includes(seconds)) throw new Error('Supported viral-remake durations are 10, 15, and 30 seconds.');
  const lang = normalizeLanguage(input.lang);
  const supportedLanguages = ['EN_US', 'ES_ES', 'FR_FR', 'ZH_CN', 'ID_ID', 'DE_DE', 'JA_JP'];
  if (!supportedLanguages.includes(lang)) throw new Error(`Unsupported language: ${lang}.`);

  const editSummary = requiredString(input, 'userRequirements', 'replicaEditSummary');
  const replicaPrompt = requiredString(input, 'replicaPrompt');
  const productInfo = [
    replicaPrompt ? `Remake prompt:\n${replicaPrompt}` : '',
    editSummary ? `User edit instruction for the viral remake: ${editSummary}` : '',
  ].filter(Boolean).join('\n\n');

  const payload = await requestApi('/api/video_clone/submit_task', context, {
    method: 'POST',
    form: true,
    body: {
      script: '',
      file_no: fileNo,
      video_id: videoId,
      seconds,
      ratio: normalizeRatio(input.ratio),
      lang,
      quality: requiredString(input, 'quality') || '720p',
      count: positiveInteger(input.count, 1, 10),
      version: positiveInteger(input.version, 1, 3),
      generation_method: 1,
      product_info: productInfo,
      product_no: requiredString(input, 'productNo'),
      avatar_no: requiredString(input, 'avatarNo'),
      type: '0',
      model_id: '0',
    },
  });
  const result = normalizedResult(payload);
  return {
    ...result,
    productImageFileNo: fileNo,
    videoId,
    linkToVideoCreated: result.success,
  };
}

async function taskProgress(input: Record<string, unknown>, context: DirectToolContext) {
  const taskNo = requiredString(input, 'taskNo');
  if (!taskNo) throw new Error('taskNo is required.');
  return normalizedResult(await requestApi(
    `/api/video_clone/task_status?task_no=${encodeURIComponent(taskNo)}`,
    context,
  ));
}

async function projectResult(input: Record<string, unknown>, context: DirectToolContext) {
  const taskNo = requiredString(input, 'taskNo');
  if (!taskNo) throw new Error('taskNo is required.');
  return normalizedResult(await requestApi(
    `/api/project/get_task_result?task_no=${encodeURIComponent(taskNo)}&scene=7`,
    context,
  ));
}

export const DIRECT_TOOLS: readonly DirectToolDefinition[] = [
  {
    name: 'url_to_video_fetch_product',
    description: 'Fetch product information from a TikTok Shop or FastMoss product URL.',
    requiresConfirmation: false,
    parameters: objectSchema({ url: stringProperty('Product URL.'), productUrl: stringProperty('Alias for url.') }),
    execute: fetchProduct,
  },
  {
    name: 'video_replica_search',
    description: 'Search Oumomo viral reference videos by category and market.',
    requiresConfirmation: false,
    parameters: objectSchema({
      region: stringProperty('Target market code, such as US.'),
      country: stringProperty('Alias for region.'),
      category: stringProperty('Product category or concise English search term.'),
      words: stringProperty('Explicit search term.'),
      page: numberProperty('Page number.'),
      pagesize: numberProperty('Results per page, up to 12.'),
      sort: numberProperty('1=plays, 5=ROAS, 15=sales, 19=revenue.', [1, 5, 15, 19]),
      date_type: numberProperty('Search window in days.', [7, 14, 28, 60, 90, 180]),
      l1_cid: stringProperty('Optional level-one category ID.'),
      l2_cid: stringProperty('Optional level-two category ID.'),
      l3_cid: stringProperty('Optional level-three category ID.'),
    }),
    execute: searchVideos,
  },
  {
    name: 'video_replica_generate_video',
    description: 'Generate a product video from a selected viral reference and uploaded product image.',
    requiresConfirmation: true,
    parameters: objectSchema({
      videoId: stringProperty('Numeric TikTok reference video ID.'),
      videoUrl: stringProperty('TikTok reference URL when videoId is unavailable.'),
      productImageFileNo: stringProperty('pres_ file number returned by image upload.'),
      seconds: numberProperty('Duration in seconds.', [10, 15, 30]),
      lang: stringProperty('Language code; defaults to EN_US.'),
      ratio: stringProperty('9:16 or 16:9.'),
      quality: stringProperty('480p or 720p.'),
      replicaPrompt: stringProperty('Optional remake prompt.'),
      userRequirements: stringProperty('Optional requested changes.'),
    }, ['videoId', 'productImageFileNo']),
    execute: generateVideo,
  },
  {
    name: 'replica_progress',
    description: 'Check a viral-remake generation task.',
    requiresConfirmation: false,
    parameters: objectSchema({ taskNo: stringProperty('Generation task number.') }, ['taskNo']),
    execute: taskProgress,
  },
  {
    name: 'replica_project_result',
    description: 'Get the completed viral-remake video result.',
    requiresConfirmation: false,
    parameters: objectSchema({ taskNo: stringProperty('Generation task number.') }, ['taskNo']),
    execute: projectResult,
  },
];

const DIRECT_TOOL_MAP = new Map(DIRECT_TOOLS.map((tool) => [tool.name, tool]));

export function getDirectTool(name: string): DirectToolDefinition | undefined {
  return DIRECT_TOOL_MAP.get(name);
}
