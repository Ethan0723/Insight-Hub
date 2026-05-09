import {
  DailyInsight,
  MatrixRow,
  NewsId,
  NewsItem,
  NewsQuery,
  PagedResult,
  ScoreBreakdown,
  StrategyBrief,
  RevenueImpactResult,
  RevenueScenario
} from '../types/domain';
import { mockNews } from '../data/mock/news';
import { mockAssistant, mockDailyInsight, mockMatrix, mockModelExplainers } from '../data/mock/dashboard';
import { calculateRevenueImpact } from '../data/mock/revenue';
import { combineFinalScore } from './score';

const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));
const riskSortWeight = { 高: 3, 中: 2, 低: 1 };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === 'true';
const SUPABASE_LIMIT = Number(import.meta.env.VITE_SUPABASE_NEWS_LIMIT || 120);
const LIBRARY_FETCH_LIMIT = Number(import.meta.env.VITE_LIBRARY_FETCH_LIMIT || 1000);
const DEFAULT_RECENT_DAYS = Number(import.meta.env.VITE_DASHBOARD_RECENT_DAYS || 3);
const ALLOW_MOCK_FALLBACK = import.meta.env.DEV || import.meta.env.VITE_ALLOW_MOCK_FALLBACK === 'true';
const DAILY_BRIEF_PROMPT_VERSION = import.meta.env.VITE_DAILY_BRIEF_PROMPT_VERSION || '';
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 45000);

let cache: { ts: number; list: NewsItem[] } | null = null;
let cachePending: Promise<NewsItem[]> | null = null;
let runtimeDataSource: 'supabase_direct' | 'server_proxy' | 'mock' = 'mock';

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function parseUtcTimestamp(raw: unknown): Date | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const withZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toUtc8DayKey(raw: unknown): string {
  const date = parseUtcTimestamp(raw);
  if (!date) return '';
  const utc8Ms = date.getTime() + 8 * 60 * 60 * 1000;
  return new Date(utc8Ms).toISOString().slice(0, 10);
}

function utc8TodayKey(): string {
  const utc8Ms = Date.now() + 8 * 60 * 60 * 1000;
  return new Date(utc8Ms).toISOString().slice(0, 10);
}

function normalizeRiskLevel(value: unknown): '低' | '中' | '高' {
  const text = String(value || '').trim();
  if (text === '高') return '高';
  if (text === '低') return '低';
  return '中';
}

function inferPlatform(title: string, source = '', originalUrl = ''): string {
  const t = title.toLowerCase();
  const s = source.toLowerCase();
  const u = originalUrl.toLowerCase();

  const hasNegatedShopify = isNegatedShopifyTitle(title);

  const isOfficial = (patterns: string[]) => patterns.some((p) => s.includes(p) || u.includes(p));

  if (isOfficial(['shopify.com', 'investors.shopify.com']) && !hasNegatedShopify) return 'Shopify';
  if (isOfficial(['aboutamazon.com', 'amazon.com'])) return 'Amazon';
  if (isOfficial(['newsroom.tiktok.com', 'tiktok.com'])) return 'TikTok Shop';
  if (isOfficial(['temu.com', 'pddholdings.com'])) return 'Temu';

  // Non-official sources: keep the match conservative, but do not require the
  // platform keyword to appear only at the headline start.
  if (!hasNegatedShopify && /\bshopify\b/.test(t)) return 'Shopify';
  if (/^(amazon|\[amazon\]|amazon[:：-])/.test(t)) return 'Amazon';
  if (/\btiktok(\s+shop)?\b/.test(t)) return 'TikTok Shop';
  if (/^(temu|\[temu\]|temu[:：-])/.test(t)) return 'Temu';

  return 'Global';
}

function isNegatedShopifyTitle(title: string): boolean {
  const t = title.toLowerCase();
  const hasWooCommerceContrast =
    /(woocommerce|woo commerce)/.test(t) &&
    /shopify/.test(t) &&
    /(instead of|rather than|not|without|vs|versus|而非|不是|并非|转向|放弃|没有选择)/.test(title);
  const hasWooMigrationContext =
    /(woocommerce|woo commerce)/.test(t) &&
    /shopify/.test(t) &&
    /(迁移|指南|对比|替代|migration|migrate|guide|switch|from)/.test(title);
  return (
    hasWooCommerceContrast ||
    hasWooMigrationContext ||
    /(not|without|instead of|vs|leave|left)\s+shopify/.test(t) ||
    /shopify\s+(not|without|instead of|vs)/.test(t) ||
    /没有(选择|采用)?\s*shopify/i.test(title) ||
    /而非.{0,10}shopify/i.test(title) ||
    /(不是|并非).{0,10}shopify/i.test(title) ||
    /放弃.{0,10}shopify/i.test(title)
  );
}

function isShopifyFalsePositive(item: NewsItem): boolean {
  const text = `${item.title} ${item.aiTldr} ${item.summary}`.toLowerCase();
  const hasShopify = text.includes('shopify');
  const hasWoo = text.includes('woocommerce') || text.includes('woo commerce');
  const hasNegative = /(instead of|rather than|not|without|vs|versus|而非|不是|并非|转向|放弃|没有选择)/.test(
    `${item.title} ${item.aiTldr} ${item.summary}`
  );
  return hasShopify && hasWoo && hasNegative;
}

function inferModuleTags(text: string): string[] {
  const t = text.toLowerCase();
  const tags: string[] = [];
  if (/(policy|regulation|tariff|compliance|customs|law|监管|政策)/.test(t)) tags.push('政策');
  if (/(platform|marketplace|shopify|shopline|shoplazza|amazon|tiktok|temu)/.test(t)) tags.push('平台');
  if (/(earnings|quarter|guidance|财报|利润|收入)/.test(t)) tags.push('财报');
  if (/(payment|stripe|paypal|checkout|wallet|收单|支付)/.test(t)) tags.push('支付');
  if (/(ads|advertis|campaign|google ads|meta)/.test(t)) tags.push('广告');
  if (/(logistics|fulfillment|shipping|仓|物流|履约)/.test(t)) tags.push('物流');
  if (/(ai|agent|model|automation|智能)/.test(t)) tags.push('AI');
  if (/(macro|economy|gdp|inflation|interest rate|宏观|经济)/.test(t)) tags.push('宏观');
  return Array.from(new Set(tags));
}

function normalizeImpactDimensions(summaryObj: any, moduleTags: string[]): Array<'订阅' | '佣金' | '支付' | '生态'> {
  const direct = Array.isArray(summaryObj?.impact_dimension)
    ? summaryObj.impact_dimension
    : Array.isArray(summaryObj?.dimensions)
    ? summaryObj.dimensions
    : [];

  const mapped = new Set<string>();

  direct.forEach((dim: any) => {
    const d = String(dim).toLowerCase();
    if (d.includes('订阅') || d.includes('subscription')) mapped.add('订阅');
    if (d.includes('佣金') || d.includes('commission')) mapped.add('佣金');
    if (d.includes('支付') || d.includes('payment')) mapped.add('支付');
    if (d.includes('生态') || d.includes('ecosystem')) mapped.add('生态');
  });

  const details = summaryObj?.dimensions || {};
  const dimKeyMap: Record<string, '订阅' | '佣金' | '支付' | '生态'> = {
    subscription: '订阅',
    commission: '佣金',
    payment: '支付',
    ecosystem: '生态'
  };
  Object.entries(dimKeyMap).forEach(([key, label]) => {
    const impact = String(details?.[key]?.impact || '');
    if (impact && impact !== '无') mapped.add(label);
  });

  if (moduleTags.includes('支付')) mapped.add('支付');
  if (moduleTags.includes('平台') || moduleTags.includes('财报')) mapped.add('佣金');
  if (moduleTags.includes('AI')) mapped.add('生态');

  return Array.from(mapped) as Array<'订阅' | '佣金' | '支付' | '生态'>;
}

function toNewsItem(row: any): NewsItem {
  const summaryObj = typeof row.summary === 'string' ? safeParseJson(row.summary) : row.summary || {};
  const rawTitle = String(row.title || '').trim();
  const titleZh = String(row.title_zh || summaryObj?.title_zh || '').trim();
  const title = titleZh || rawTitle || 'Untitled';
  const content = String(row.content || '').trim();
  const baseText = [title, content, JSON.stringify(summaryObj || {})].join(' ');
  const moduleTags = Array.from(
    new Set([
      ...(Array.isArray(summaryObj?.tags) ? summaryObj.tags.map((t: any) => String(t)) : []),
      ...inferModuleTags(baseText),
      ...(row.event_type ? [String(row.event_type)] : [])
    ])
  ).slice(0, 6);

  const dimensions = normalizeImpactDimensions(summaryObj, moduleTags);

  const why = {
    subscription: summaryObj?.dimensions?.subscription?.analysis || undefined,
    commission: summaryObj?.dimensions?.commission?.analysis || undefined,
    payment: summaryObj?.dimensions?.payment?.analysis || undefined,
    ecosystem: summaryObj?.dimensions?.ecosystem?.analysis || undefined
  };

  const actionsRaw = Array.isArray(summaryObj?.strategic_actions) ? summaryObj.strategic_actions : [];
  const actions = actionsRaw.slice(0, 4).map((a: any) => ({
    priority: ['P0', 'P1', 'P2'].includes(a?.priority) ? a.priority : 'P1',
    owner: ['产品', '运营', '合规', '支付', '市场'].includes(a?.owner) ? a.owner : '产品',
    text: String(a?.action || '').trim() || '持续跟踪并评估影响。'
  }));

  const aiTldr =
    String(row.tldr || '').trim() ||
    String(summaryObj?.tldr || '').trim() ||
    String(row.core_summary || '').trim() ||
    String(summaryObj?.core_summary || '').trim() ||
    content.slice(0, 120) ||
    title;

  const summary =
    String(row.core_summary || '').trim() ||
    String(summaryObj?.core_summary || '').trim() ||
    String(summaryObj?.industry_impact || '').trim() ||
    String(summaryObj?.platform_saas_insight || '').trim() ||
    content.slice(0, 220) ||
    aiTldr;

  const impactScore = Number.isFinite(Number(row.impact_score))
    ? Number(row.impact_score)
    : Number.isFinite(Number(summaryObj?.impact_score))
    ? Number(summaryObj.impact_score)
    : 60;

  const source = String(row.source || 'Unknown').trim();
  const inferredPlatform = inferPlatform(title, source, String(row.url || ''));
  const rawPlatform = String(row.platform || summaryObj?.platform || '').trim();
  const platform = isNegatedShopifyTitle(title) && rawPlatform === 'Shopify' ? 'Global' : rawPlatform || inferredPlatform;
  const region = String(row.region || summaryObj?.region || '').trim() || 'Global';
  const createdAt = parseUtcTimestamp(row.created_at)?.toISOString() || new Date().toISOString();
  const publishDate = row.publish_time
    ? new Date(row.publish_time).toISOString().slice(0, 10)
    : toUtc8DayKey(createdAt) || new Date().toISOString().slice(0, 10);

  return {
    id: row.id,
    title,
    source,
    createdAt,
    publishDate,
    platform,
    region,
    moduleTags,
    riskLevel: normalizeRiskLevel(row.risk_level ?? summaryObj?.risk_level),
    impactScore,
    impactDimensions: dimensions,
    aiTldr,
    summary,
    entities: Array.from(new Set([platform, region, source])).filter(Boolean),
    originalUrl: String(row.url || '#'),
    why,
    actions,
    evidenceContribution: Math.max(30, Math.round(impactScore * 0.88))
  };
}

function normalizeUrlForDedupe(raw: string): string {
  try {
    const url = new URL(String(raw || '').trim());
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.hostname.toLowerCase()}${pathname}`;
  } catch {
    return '';
  }
}

function normalizeTextForDedupe(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/amazon|亚马逊/g, ' amazon ')
    .replace(/shopify/g, ' shopify ')
    .replace(/tiktok shop|tiktok|抖音/g, ' tiktok ')
    .replace(/temu/g, ' temu ')
    .replace(/fba/g, ' fba ')
    .replace(/燃油附加费|燃油及物流附加费|物流附加费|附加费/g, ' surcharge ')
    .replace(/%/g, ' percent ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildBigrams(text: string): Set<string> {
  const compact = text.replace(/\s+/g, '');
  const out = new Set<string>();
  if (!compact) return out;
  if (compact.length === 1) {
    out.add(compact);
    return out;
  }
  for (let i = 0; i < compact.length - 1; i += 1) {
    out.add(compact.slice(i, i + 2));
  }
  return out;
}

function bigramSimilarity(a: string, b: string): number {
  const aSet = buildBigrams(a);
  const bSet = buildBigrams(b);
  if (!aSet.size || !bSet.size) return 0;
  let intersection = 0;
  aSet.forEach((token) => {
    if (bSet.has(token)) intersection += 1;
  });
  const union = new Set([...aSet, ...bSet]).size;
  return union > 0 ? intersection / union : 0;
}

function daysBetween(a: string, b: string): number {
  const aMs = Date.parse(a || '') || 0;
  const bMs = Date.parse(b || '') || 0;
  if (!aMs || !bMs) return Number.POSITIVE_INFINITY;
  return Math.abs(aMs - bMs) / (24 * 60 * 60 * 1000);
}

function pickPreferredNewsItem(current: NewsItem, candidate: NewsItem): NewsItem {
  if ((candidate.impactScore || 0) !== (current.impactScore || 0)) {
    return (candidate.impactScore || 0) > (current.impactScore || 0) ? candidate : current;
  }
  const candidateTs = Date.parse(candidate.createdAt || candidate.publishDate || '') || 0;
  const currentTs = Date.parse(current.createdAt || current.publishDate || '') || 0;
  return candidateTs >= currentTs ? candidate : current;
}

function areLikelyDuplicateNews(a: NewsItem, b: NewsItem): boolean {
  const urlA = normalizeUrlForDedupe(a.originalUrl);
  const urlB = normalizeUrlForDedupe(b.originalUrl);
  if (urlA && urlB && urlA === urlB) return true;

  const titleA = normalizeTextForDedupe(a.title);
  const titleB = normalizeTextForDedupe(b.title);
  const summaryA = normalizeTextForDedupe(`${a.title} ${a.aiTldr} ${a.summary}`);
  const summaryB = normalizeTextForDedupe(`${b.title} ${b.aiTldr} ${b.summary}`);
  const titleSimilarity = bigramSimilarity(titleA, titleB);
  const summarySimilarity = bigramSimilarity(summaryA, summaryB);
  const samePlatform = a.platform === b.platform || a.platform === 'Global' || b.platform === 'Global';
  const nearPublishDay = daysBetween(a.publishDate, b.publishDate) <= 2;

  return samePlatform && nearPublishDay && (titleSimilarity >= 0.72 || summarySimilarity >= 0.68);
}

function dedupeNewsItems(list: NewsItem[]): NewsItem[] {
  const deduped: NewsItem[] = [];
  const sorted = [...list].sort((a, b) => {
    const impactDiff = (b.impactScore || 0) - (a.impactScore || 0);
    if (impactDiff !== 0) return impactDiff;
    return (Date.parse(b.createdAt || b.publishDate || '') || 0) - (Date.parse(a.createdAt || a.publishDate || '') || 0);
  });

  sorted.forEach((item) => {
    const hitIndex = deduped.findIndex((existing) => areLikelyDuplicateNews(existing, item));
    if (hitIndex === -1) {
      deduped.push(item);
      return;
    }
    deduped[hitIndex] = pickPreferredNewsItem(deduped[hitIndex], item);
  });

  return deduped;
}

function isClearlyIrrelevant(item: NewsItem): boolean {
  const lowConfidenceSignals = [
    '模型未返回合法 json',
    '待翻译',
    'low confidence'
  ];
  const hasLowConfidenceSignal = lowConfidenceSignals.some((s) =>
    `${item.title} ${item.aiTldr} ${item.summary}`.toLowerCase().includes(s.toLowerCase())
  );
  return hasLowConfidenceSignal;
}

function safeParseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function safeParseJsonValue(value: unknown): any {
  if (typeof value === 'string') return safeParseJson(value);
  return value;
}

function pickChineseText(candidates: Array<string | undefined>, fallback: string): string {
  const cleaned = candidates
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  for (const text of cleaned) {
    if (/[\u4e00-\u9fff]/.test(text)) return text;
  }
  return fallback;
}

function paginate<T>(list: T[], page = 1, pageSize = 9): PagedResult<T> {
  const total = list.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    list: list.slice(start, end),
    total,
    page,
    pageSize
  };
}

function toCompetitorUpdate(row: any) {
  const publishedAt = String(row.published_at || row.effective_at || row.detected_at || row.created_at || '');
  const rawPayload = safeParseJsonValue(row.raw_payload) || {};
  return {
    id: String(row.id || ''),
    platform: String(row.platform || 'Shopify'),
    sourceType: String(row.source_type || 'product_changelog'),
    sourceName: String(row.source_name || ''),
    sourceUrl: String(row.source_url || ''),
    detailUrl: String(row.detail_url || ''),
    title: String(row.title || 'Untitled'),
    summary: String(row.summary || ''),
    content: String(row.content || ''),
    rawPayload,
    originalTitle: String(rawPayload?.original_title || ''),
    originalSummary: String(rawPayload?.original_summary || ''),
    originalContent: String(rawPayload?.original_content || ''),
    publishedAt,
    effectiveAt: String(row.effective_at || ''),
    detectedAt: String(row.detected_at || ''),
    lastCheckedAt: String(row.last_checked_at || ''),
    eventType: String(row.event_type || 'product_update'),
    updateLabel: String(row.update_label || ''),
    productArea: String(row.product_area || 'Platform'),
    status: String(row.status || 'new'),
    competitiveImpact: String(row.competitive_impact || '中'),
    impactReason: String(row.impact_reason || ''),
    gapAssumption: String(row.gap_assumption || ''),
    recommendedAction: String(row.recommended_action || ''),
    importanceScore: Number(row.importance_score || 0),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    displayDate: publishedAt ? publishedAt.slice(0, 10) : ''
  };
}

async function fetchCompetitorUpdatesPage(params: {
  offset: number;
  limit: number;
  includeTotal?: boolean;
  platform?: string;
  sourceType?: string;
  eventType?: string;
  competitiveImpact?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ rows: any[]; total: number }> {
  const search = new URLSearchParams();
  search.set('offset', String(Math.max(0, params.offset)));
  search.set('limit', String(Math.max(1, Math.min(1000, params.limit))));
  if (params.includeTotal) search.set('include_total', '1');
  if (params.platform) search.set('platform', params.platform);
  if (params.sourceType) search.set('source_type', params.sourceType);
  if (params.eventType) search.set('event_type', params.eventType);
  if (params.competitiveImpact) search.set('competitive_impact', params.competitiveImpact);
  if (params.keyword) search.set('keyword', params.keyword);
  if (params.dateFrom) search.set('date_from', params.dateFrom);
  if (params.dateTo) search.set('date_to', params.dateTo);

  const res = await fetchWithTimeout(`/api/competitor_updates?${search.toString()}`);
  if (!res.ok) throw new Error(`competitor_updates proxy http ${res.status}`);
  const body = await res.json();
  if (params.includeTotal && body && typeof body === 'object') {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const total = Number.isFinite(Number(body.total)) ? Number(body.total) : rows.length;
    return { rows, total };
  }
  const rows = Array.isArray(body) ? body : [];
  return { rows, total: rows.length };
}

function filterNews(list: NewsItem[], query: NewsQuery = {}): NewsItem[] {
  let result = [...list];

  if (query.ids && query.ids.length > 0) {
    const set = new Set(query.ids);
    result = result.filter((item) => set.has(item.id));
  }
  if (query.platforms && query.platforms.length > 0) {
    result = result.filter((item) => query.platforms?.includes(item.platform));
  }
  if (query.regions && query.regions.length > 0) {
    result = result.filter((item) => query.regions?.includes(item.region));
  }
  if (query.moduleTags && query.moduleTags.length > 0) {
    result = result.filter((item) => query.moduleTags?.some((tag) => item.moduleTags.includes(tag)));
  }
  if (query.riskLevels && query.riskLevels.length > 0) {
    result = result.filter((item) => query.riskLevels?.includes(item.riskLevel));
  }
  if (query.impactDimensions && query.impactDimensions.length > 0) {
    result = result.filter((item) => query.impactDimensions?.some((dim) => item.impactDimensions.includes(dim)));
  }
  if (query.dateFrom) {
    const from = new Date(query.dateFrom).getTime();
    result = result.filter((item) => new Date(item.publishDate).getTime() >= from);
  }
  if (query.dateTo) {
    const to = new Date(query.dateTo).getTime();
    result = result.filter((item) => new Date(item.publishDate).getTime() <= to);
  }
  if (query.keyword?.trim()) {
    const key = query.keyword.trim().toLowerCase();
    result = result.filter(
      (item) =>
        item.title.toLowerCase().includes(key) ||
        item.summary.toLowerCase().includes(key) ||
        item.entities.join(' ').toLowerCase().includes(key)
    );
  }

  result.sort((a, b) => {
    if (query.sortBy === 'impact') return b.impactScore - a.impactScore;
    if (query.sortBy === 'risk') return riskSortWeight[b.riskLevel] - riskSortWeight[a.riskLevel];
    return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
  });

  return result;
}

function hasSupabaseConfig(): boolean {
  return Boolean(USE_SUPABASE && SUPABASE_URL && SUPABASE_ANON_KEY);
}

async function fetchNewsRawPage(params: {
  offset: number;
  limit: number;
  dateFrom?: string;
  dateTo?: string;
  includeTotal?: boolean;
  lite?: boolean;
  impactGt?: number;
  impactLte?: number;
}): Promise<{ rows: any[]; total: number }> {
  const { offset, limit, dateFrom, dateTo, includeTotal = false, lite = false, impactGt, impactLte } = params;

  if (hasSupabaseConfig()) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/news_raw`);
    const select = lite
      ? 'id,title,summary,title_zh:summary->>title_zh,tldr:summary->>tldr,core_summary:summary->>core_summary,source,url,publish_time,created_at,impact_score,risk_level,platform,region,event_type'
      : 'id,title,source,url,publish_time,created_at,summary,impact_score,risk_level,platform,region,event_type,importance_level,sentiment_score,summary_generated_at';
    url.searchParams.set('select', select);
    url.searchParams.set('order', 'publish_time.desc.nullslast,created_at.desc');
    url.searchParams.set('offset', String(Math.max(0, offset)));
    url.searchParams.set('limit', String(Math.max(1, Math.min(1000, limit))));
    const andFilters: string[] = [];
    if (dateFrom) andFilters.push(`publish_time.gte.${dateFrom}T00:00:00+08:00`);
    if (dateTo) andFilters.push(`publish_time.lte.${dateTo}T23:59:59+08:00`);
    if (Number.isFinite(impactGt as number)) andFilters.push(`impact_score.gt.${Number(impactGt)}`);
    if (Number.isFinite(impactLte as number)) andFilters.push(`impact_score.lte.${Number(impactLte)}`);
    if (andFilters.length > 0) {
      url.searchParams.set('and', `(${andFilters.join(',')})`);
    }

    const headers: Record<string, string> = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    };
    if (includeTotal) headers.Prefer = 'count=exact';

    const res = await fetchWithTimeout(url.toString(), { headers });
    if (!res.ok) throw new Error(`supabase page http ${res.status}`);
    const rows = await res.json();
    const list = Array.isArray(rows) ? rows : [];
    if (!includeTotal) return { rows: list, total: list.length };

    let total = list.length;
    const contentRange = res.headers.get('content-range') || '';
    const slash = contentRange.lastIndexOf('/');
    if (slash >= 0) {
      const raw = Number.parseInt(contentRange.slice(slash + 1), 10);
      if (Number.isFinite(raw)) total = raw;
    }
    return { rows: list, total };
  }

  const params2 = new URLSearchParams();
  params2.set('offset', String(Math.max(0, offset)));
  params2.set('limit', String(Math.max(1, Math.min(1000, limit))));
  if (lite) params2.set('lite', '1');
  if (includeTotal) params2.set('include_total', '1');
  if (dateFrom) params2.set('date_from', dateFrom);
  if (dateTo) params2.set('date_to', dateTo);
  if (Number.isFinite(impactGt as number)) params2.set('impact_gt', String(impactGt));
  if (Number.isFinite(impactLte as number)) params2.set('impact_lte', String(impactLte));
  const res = await fetchWithTimeout(`/api/news_raw?${params2.toString()}`);
  if (!res.ok) throw new Error(`proxy page http ${res.status}`);
  const body = await res.json();
  if (includeTotal && body && typeof body === 'object') {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const total = Number.isFinite(Number(body.total)) ? Number(body.total) : rows.length;
    return { rows, total };
  }
  const rows = Array.isArray(body) ? body : [];
  return { rows, total: rows.length };
}

function toUtc8WindowLabel(dayKey: string): string {
  return `${dayKey} (UTC+8)`;
}

async function fetchDailyBriefRows(dateKey: string): Promise<any[]> {
  if (hasSupabaseConfig()) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/daily_brief`);
    url.searchParams.set(
      'select',
      'id,brief_date,brief_tz,window_start,window_end,headline,one_liner,top_drivers,impacts,actions,citations,stats,model,prompt_version,usage,generated_at'
    );
    url.searchParams.set('brief_date', `eq.${dateKey}`);
    if (DAILY_BRIEF_PROMPT_VERSION) {
      url.searchParams.set('prompt_version', `eq.${DAILY_BRIEF_PROMPT_VERSION}`);
    }
    url.searchParams.set('order', 'generated_at.desc');
    url.searchParams.set('limit', '1');

    const res = await fetchWithTimeout(url.toString(), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) throw new Error(`daily_brief supabase http ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  const url = new URL('/api/daily_brief', window.location.origin);
  url.searchParams.set('date', dateKey);
  if (DAILY_BRIEF_PROMPT_VERSION) {
    url.searchParams.set('prompt_version', DAILY_BRIEF_PROMPT_VERSION);
  }
  const res = await fetchWithTimeout(`${url.pathname}${url.search}`);
  if (!res.ok) throw new Error(`daily_brief proxy http ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function toDailyBriefCitation(value: unknown, newsMap: Map<string, NewsItem>, idx: number) {
  const key = String(value || '').trim();
  if (!key) return null;
  const isUrl = /^https?:\/\//i.test(key);
  const news = newsMap.get(key);
  if (news) {
    return {
      id: news.id,
      title: news.title,
      source: news.source,
      url: news.originalUrl,
      published_at: news.createdAt || '',
      impact_score: news.impactScore,
      risk_level: news.riskLevel,
      matched_keywords: []
    };
  }
  return {
    id: `brief-${idx}`,
    title: isUrl ? `外部引用 ${idx + 1}` : key,
    source: 'daily_brief',
    url: isUrl ? key : '#',
    published_at: '',
    impact_score: 0,
    risk_level: '中' as const,
    matched_keywords: []
  };
}

function hasReadableCitationTitles(citations: StrategyBrief['citations'] | undefined): boolean {
  if (!Array.isArray(citations) || !citations.length) return false;
  return citations.some((item) => {
    const title = String(item?.title || '').trim();
    if (!title) return false;
    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(title)) return false;
    if (/^brief-\d+$/i.test(title)) return false;
    return true;
  });
}

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function isEnglishHeavy(text: string): boolean {
  const s = String(text || '').trim();
  if (!s) return false;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  return latin >= 12 && cjk <= 8;
}

function chineseOrFallback(text: string, fallback: string): string {
  const cleaned = String(text || '').trim();
  if (!cleaned) return fallback;
  if (isEnglishHeavy(cleaned) && !hasCjk(cleaned)) return fallback;
  return cleaned;
}

function mapDailyBriefToStrategyBrief(row: any, news: NewsItem[]): StrategyBrief | null {
  if (!row || typeof row !== 'object') return null;
  const headline = chineseOrFallback(String(row.headline || ''), '外部信号分散，先执行最小可逆策略');
  const oneLiner = String(row.one_liner || '').trim();
  if (!headline || !oneLiner) return null;

  const topDriversRaw = safeParseJsonValue(row.top_drivers);
  const impacts = safeParseJsonValue(row.impacts) || {};
  const actionsRaw = safeParseJsonValue(row.actions);
  const citationsRaw = safeParseJsonValue(row.citations);
  const statsRaw = safeParseJsonValue(row.stats);

  const topDrivers = (Array.isArray(topDriversRaw) ? topDriversRaw : []).slice(0, 5).map((driver: any, idx: number) => ({
    id: `daily-brief-driver-${idx}`,
    title: chineseOrFallback(String(driver?.title || ''), '外部信号变化'),
    source: 'daily_brief',
    impact_score: 0,
    risk_level: '中' as const,
    why: chineseOrFallback(String(driver?.why_it_matters || ''), '该信号将影响近期经营决策。'),
    signals: Array.isArray(driver?.signals) ? driver.signals.map((item: unknown) => String(item || '').trim()).filter(Boolean) : []
  }));

  const actions = (Array.isArray(actionsRaw) ? actionsRaw : [])
    .filter((item: any) => ['P0', 'P1', 'P2'].includes(String(item?.priority || '')))
    .slice(0, 6)
    .map((action: any) => ({
      priority: action.priority,
      owner: ['战略', '产品', '商业化'].includes(String(action.owner || '')) ? action.owner : '战略',
      action: String(action.action || '').trim() || '补充行动方案',
      expected_effect: String(action.success_metric || '').trim(),
      time_horizon: String(action.timeframe || '').trim()
    }));

  const newsMap = new Map<string, NewsItem>();
  news.forEach((item) => {
    newsMap.set(String(item.id), item);
    newsMap.set(String(item.originalUrl), item);
  });

  const citations = (Array.isArray(citationsRaw) ? citationsRaw : [])
    .slice(0, 10)
    .map((value: unknown, idx: number) => toDailyBriefCitation(value, newsMap, idx))
    .filter(Boolean) as NonNullable<StrategyBrief['citations']>;

  return {
    headline,
    one_liner: oneLiner,
    time_window: toUtc8WindowLabel(String(row.brief_date || utc8TodayKey())),
    signal_case: 'A',
    top_drivers: topDrivers,
    top_news: citations.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title,
      source: item.source,
      url: item.url,
      impact_score: item.impact_score,
      risk_level: item.risk_level,
      matched_keywords: item.matched_keywords || []
    })),
    citations,
    impacts: {
      merchant_demand: String(impacts.merchant_demand || '').trim(),
      acquisition: String(impacts.acquisition || '').trim(),
      conversion: String(impacts.conversion || '').trim(),
      payments_risk: String(impacts.payments_risk || '').trim(),
      fulfillment: String(impacts.fulfillment || '').trim(),
      competition: String(impacts.competition || '').trim()
    },
    actions,
    transmission_analysis: {
      macro: '已由 LLM 基于当日 news_raw 聚合生成。',
      industry: '重点围绕跨境履约、支付与竞争格局变化。',
      saas: '输出公司级结论与行动建议供决策使用。'
    },
    impact_on_revenue_model: {
      subscription: { direction: '→', note: '由 daily_brief 提供结构化结论' },
      commission: { direction: '→', note: '由 daily_brief 提供结构化结论' },
      payment: { direction: '→', note: '由 daily_brief 提供结构化结论' },
      ecosystem: { direction: '→', note: '由 daily_brief 提供结构化结论' }
    },
    meta: {
      news_count_scanned: Number(statsRaw?.scanned || 0),
      news_count_used: Number(statsRaw?.used || 0),
      high_impact: Number(statsRaw?.high_impact || 0),
      generated_at: String(row.generated_at || ''),
      only_news_raw: true,
      brief_source: 'daily_brief'
    }
  };
}

async function fetchFromSupabaseRaw(
  limit = SUPABASE_LIMIT,
  lite = true,
  recentDays: number | null = DEFAULT_RECENT_DAYS,
  dateFrom?: string,
  dateTo?: string
): Promise<NewsItem[]> {
  if (!hasSupabaseConfig()) {
    throw new Error('missing supabase config');
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/news_raw`);
  const select = lite
    ? 'id,title,summary,title_zh:summary->>title_zh,tldr:summary->>tldr,core_summary:summary->>core_summary,source,url,publish_time,created_at,impact_score,risk_level,platform,region,event_type'
    : 'id,title,source,url,publish_time,created_at,summary,impact_score,risk_level,platform,region,event_type,importance_level,sentiment_score,summary_generated_at';
  url.searchParams.set('select', select);
  if (dateFrom) {
    url.searchParams.set('publish_time', `gte.${dateFrom}T00:00:00+08:00`);
  } else if (recentDays && recentDays > 0) {
    const start = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString();
    url.searchParams.set('publish_time', `gte.${start}`);
  }
  if (dateTo) {
    url.searchParams.set('publish_time', `lte.${dateTo}T23:59:59+08:00`);
  }
  url.searchParams.set('order', 'publish_time.desc.nullslast,created_at.desc');
  url.searchParams.set('limit', String(limit));

  const res = await fetchWithTimeout(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!res.ok) {
    throw new Error(`supabase http ${res.status}`);
  }

  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  runtimeDataSource = 'supabase_direct';
  return dedupeNewsItems(rows.map(toNewsItem).filter((item) => Boolean(item.id)).filter((item) => !isClearlyIrrelevant(item)));
}

async function fetchFromServerProxyRaw(
  limit = SUPABASE_LIMIT,
  lite = true,
  recentDays: number | null = DEFAULT_RECENT_DAYS,
  dateFrom?: string,
  dateTo?: string
): Promise<NewsItem[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (lite) params.set('lite', '1');
  if (recentDays && recentDays > 0 && !dateFrom) params.set('recent_days', String(recentDays));
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  const res = await fetchWithTimeout(`/api/news_raw?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`proxy http ${res.status}`);
  }

  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  runtimeDataSource = 'server_proxy';
  return dedupeNewsItems(rows.map(toNewsItem).filter((item) => Boolean(item.id)).filter((item) => !isClearlyIrrelevant(item)));
}

async function getSupabaseNewsCached(
  force = false,
  limit = SUPABASE_LIMIT,
  lite = true,
  recentDays: number | null = DEFAULT_RECENT_DAYS,
  dateFrom?: string,
  dateTo?: string
): Promise<NewsItem[]> {
  if (limit !== SUPABASE_LIMIT || !lite || recentDays !== DEFAULT_RECENT_DAYS || dateFrom || dateTo) {
    return hasSupabaseConfig()
      ? fetchFromSupabaseRaw(limit, lite, recentDays, dateFrom, dateTo)
      : fetchFromServerProxyRaw(limit, lite, recentDays, dateFrom, dateTo);
  }
  const now = Date.now();
  if (!force && cache && now - cache.ts < 60_000) return cache.list;
  if (!force && cachePending) return cachePending;

  const task = (hasSupabaseConfig()
    ? fetchFromSupabaseRaw(SUPABASE_LIMIT, true, DEFAULT_RECENT_DAYS)
    : fetchFromServerProxyRaw(SUPABASE_LIMIT, true, DEFAULT_RECENT_DAYS))
    .then((list) => {
      cache = { ts: Date.now(), list };
      return list;
    })
    .finally(() => {
      cachePending = null;
    });

  cachePending = task;
  return task;
}

async function getMatrixNews(params: { dateFrom?: string; dateTo?: string; recentDays?: number }): Promise<NewsItem[]> {
  const { dateFrom, dateTo, recentDays = 7 } = params;
  const hasExplicitRange = Boolean(dateFrom || dateTo);

  if (!hasExplicitRange) {
    return getRealOrMockNews(false, SUPABASE_LIMIT, true, recentDays, dateFrom, dateTo);
  }

  const total = await api.getNewsTotal(dateFrom, dateTo);
  if (!Number.isFinite(total) || total <= 0) return [];

  const batchSize = 500;
  const offsets: number[] = [];
  for (let offset = 0; offset < total; offset += batchSize) {
    offsets.push(offset);
  }

  const batches = await Promise.all(
    offsets.map((offset) =>
      api.getNewsBatch({
        offset,
        limit: batchSize,
        dateFrom,
        dateTo
      })
    )
  );

  return dedupeNewsItems(batches.flatMap((batch) => batch.list));
}

function fallbackNews(): NewsItem[] {
  return [...mockNews];
}

function idsByRule(news: NewsItem[], rule: (item: NewsItem) => boolean, max = 8): NewsId[] {
  return news.filter(rule).slice(0, max).map((item) => item.id);
}

function trendFromScore(score: number, bias = 0): number[] {
  const start = Math.max(35, Math.min(85, score - 10 + bias));
  return Array.from({ length: 7 }, (_, i) => Math.round(start + i * 1.8));
}

function buildTrendFromNews(news: NewsItem[], newsIds: NewsId[], fallbackScore: number, bias = 0): number[] {
  if (!newsIds.length) return trendFromScore(fallbackScore, bias);

  const targetSet = new Set(newsIds);
  const rows = news.filter((item) => targetSet.has(item.id));
  const byDay = new Map<string, number[]>();

  rows.forEach((item) => {
    const day = String(item.publishDate || '').slice(0, 10);
    if (!day) return;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)?.push(item.impactScore);
  });

  const days = Array.from(byDay.keys()).sort();
  if (days.length < 2) return trendFromScore(fallbackScore, bias);

  return days.map((day, index) => {
    const list = byDay.get(day) || [];
    const avg = list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : fallbackScore;
    return Math.max(30, Math.min(98, Math.round(avg + bias + index * 0.5)));
  });
}

const lowConfidencePattern =
  /(信息不足|置信度较低|置信度极低|模型未返回合法 JSON|暂无法评估|正文严重不足|无法提取有效商业洞察|缺乏实质性战略内容|信息严重不匹配|与电商业务无关|无法进行有效战略分析)/i;

function isLowConfidenceInsight(item: NewsItem): boolean {
  const text = `${item.aiTldr || ''} ${item.summary || ''}`.trim();
  return lowConfidencePattern.test(text);
}

function truncate(text: string, length: number): string {
  const clean = String(text || '').trim();
  if (clean.length <= length) return clean || '—';
  return `${clean.slice(0, length)}…`;
}

const DIMENSION_LABELS: Record<string, string> = {
  订阅: '订阅',
  佣金: '佣金',
  支付: '支付',
  生态: '生态',
  subscription: '订阅',
  commission: '佣金',
  payment: '支付',
  ecosystem: '生态'
};

function toUtc8DateKey(timestamp: number) {
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const DIRECT_SIGNAL_KEYWORDS = [
  'ecommerce',
  'cross-border',
  'tariff',
  'customs',
  'vat',
  'de minimis',
  'payment',
  'stripe',
  'shopify',
  'amazon',
  'marketplace',
  'logistics',
  'fulfillment'
];

const HEADLINE_POOL_A = [
  '成本与履约信号走强，独立站SaaS短期承压',
  '支付与关税波动叠加，独立站SaaS进入再平衡期',
  '流量与成本双线变化，独立站SaaS结构正在重塑',
  '跨境变量升温，独立站SaaS需主动防守利润区间'
];

const HEADLINE_POOL_B = [
  '宏观风险升温，独立站SaaS暂未出现结构性冲击',
  '外部不确定性上行，独立站SaaS先进入预警观察期',
  '宏观信号偏紧，独立站SaaS当前以监测为主'
];

function hashIndex(text: string, size: number) {
  const base = Array.from(text).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return size > 0 ? base % size : 0;
}

function classifyDirectSignal(item: NewsItem) {
  const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  const matched = DIRECT_SIGNAL_KEYWORDS.filter((kw) => text.includes(kw));
  return { isDirect: matched.length > 0, matched };
}

function topDimensions(news: NewsItem[]) {
  const counter: Record<string, number> = {};
  news.forEach((item) => {
    const raw = (item.impactDimensions?.[0] || item.moduleTags?.[0] || '生态') as string;
    const key = DIMENSION_LABELS[raw] || '生态';
    counter[key] = (counter[key] || 0) + 1;
  });
  return Object.keys(counter).sort((a, b) => counter[b] - counter[a]).slice(0, 2);
}

function buildDailyStrategyBrief(news: NewsItem[], dayKey = utc8TodayKey()) {
  const todayNews = dedupeNewsItems(news)
    .filter((item) => {
      const created = Date.parse(item.createdAt || item.publishDate || '') || 0;
      return toUtc8DateKey(created) === dayKey;
    })
    .filter((item) => !isLowConfidenceInsight(item))
    .sort((a, b) => {
      const impactDiff = (b.impactScore || 0) - (a.impactScore || 0);
      if (impactDiff !== 0) return impactDiff;
      const riskOrder = { 高: 3, 中: 2, 低: 1 };
      return (riskOrder[b.riskLevel] || 1) - (riskOrder[a.riskLevel] || 1);
    })
    .slice(0, 30);

  const withSignalType = todayNews.map((item) => {
    const result = classifyDirectSignal(item);
    return { item, isDirect: result.isDirect, matched: result.matched };
  });
  const directSignals = withSignalType.filter((entry) => entry.isDirect);
  const macroSignals = withSignalType.filter((entry) => !entry.isDirect);
  const highQuality = withSignalType.filter((entry) => {
    const summary = String(entry.item.summary || entry.item.aiTldr || '').trim();
    return summary.length >= 12 && !isLowConfidenceInsight(entry.item);
  });
  const meta = {
    news_count_scanned: todayNews.length,
    news_count_used: highQuality.length,
    generated_at: new Date().toISOString(),
    data_source: 'news_raw',
    direct_signal_count: directSignals.length,
    macro_signal_count: macroSignals.length,
    only_news_raw: true
  } as StrategyBrief['meta'] & { data_source: string; direct_signal_count: number; macro_signal_count: number; only_news_raw: true };

  if (!highQuality.length) {
    console.log(
      `[daily-brief] scanned=${todayNews.length} classified={direct:${directSignals.length},macro:${macroSignals.length}} case=C`
    );
    return {
      headline: '今日未出现与跨境电商或独立站 SaaS 直接相关的结构性信号，建议维持当前节奏。',
      time_window: '今天',
      signal_case: 'C',
      top_drivers: [],
      top_news: [],
      citations: [],
      transmission_analysis: {
        macro: '今日宏观层未形成高质量可执行信号。',
        industry: '跨境电商行业层暂无可确认的直接冲击链路。',
        saas: '独立站 SaaS 层维持当前节奏，继续监测即可。'
      },
      actions: [
        { priority: 'P0', owner: '战略', action: '保持当日风险雷达巡检', expected_effect: '避免漏报', time_horizon: '本周' },
        { priority: 'P1', owner: '产品', action: '维持关键链路稳定性检查', expected_effect: '降低突发故障概率', time_horizon: '本月' },
        { priority: 'P2', owner: '商业化', action: '维持常规客户沟通节奏', expected_effect: '稳住续费预期', time_horizon: '本季度' }
      ],
      meta
    };
  }

  const dominantDimensions = topDimensions(highQuality.map((entry) => entry.item));
  const hasHighRisk = highQuality.some((entry) => entry.item.riskLevel === '高');
  const caseType: 'A' | 'B' = directSignals.length > 0 ? 'A' : 'B';
  const headlinePool = caseType === 'A' ? HEADLINE_POOL_A : HEADLINE_POOL_B;
  const headline = headlinePool[hashIndex(`${dayKey}-${dominantDimensions.join('-')}-${highQuality.length}`, headlinePool.length)];

  const sourceSet = caseType === 'A' ? directSignals : macroSignals;
  const driverSource = (sourceSet.length ? sourceSet : withSignalType).slice(0, 5);
  const topDrivers = driverSource.map(({ item, matched }) => ({
    title: item.title || '标题缺失',
    source: item.source || '未知来源',
    impact_score: Number.isFinite(item.impactScore) ? item.impactScore : 0,
    risk_level: item.riskLevel || '中',
    why: truncate(`${item.summary || item.aiTldr || '无摘要'}${matched.length ? `（关键词：${matched.join(', ')}）` : ''}`, 90)
  }));

  const topNews = driverSource.map(({ item, matched }) => ({
    id: item.id || '',
    title: item.title || '标题缺失',
    source: item.source || '未知来源',
    url: item.originalUrl || item.url || '',
    impact_score: Number.isFinite(item.impactScore) ? item.impactScore : 0,
    risk_level: item.riskLevel || '中',
    matched_keywords: matched.length ? matched : item.moduleTags || []
  }));

  const citations = driverSource.slice(0, 8).map(({ item, matched }) => ({
    id: item.id || '',
    title: item.title || '标题缺失',
    source: item.source || '未知来源',
    url: item.originalUrl || item.url || '',
    published_at: item.publishDate || item.createdAt || '',
    impact_score: Number.isFinite(item.impactScore) ? item.impactScore : 0,
    risk_level: item.riskLevel || '中',
    matched_keywords: matched.length ? matched : item.moduleTags || []
  }));

  const transmissionAnalysis =
    caseType === 'A'
      ? {
          macro: `宏观层：${hasHighRisk ? '风险升温' : '波动上行'}，政策/成本变量对跨境经营约束增强。`,
          industry: `行业层：卖家在履约、投放与支付策略上被迫再平衡，GMV与竞争结构短期波动。`,
          saas: `SaaS层：重点影响${dominantDimensions.join('、')}维度，需要同步调整产品与商业化节奏。`
        }
      : {
          macro: '宏观层：风险信号正在升温，外部环境不确定性增加。',
          industry: '行业层：当前仅见潜在传导路径（物流成本、消费信心、汇率），尚未形成直接冲击。',
          saas: 'SaaS层：尚未出现可确认的结构性冲击，建议以预警监测为主。'
        };

  const revenueImpact =
    caseType === 'A'
      ? {
          subscription: { direction: hasHighRisk ? '↓' : '→', note: '订阅续费面临波动，需要强化价值证明。' },
          commission: { direction: hasHighRisk ? '↓' : '→', note: '成交与佣金受成本/转化变化牵引。' },
          payment: { direction: hasHighRisk ? '↓' : '→', note: '支付链路需持续守住成功率与风控平衡。' },
          ecosystem: { direction: '→', note: '生态协同要跟随外部变化做快速响应。' }
        }
      : {
          subscription: { direction: '→', note: '暂无直接行业冲击，维持观察。' },
          commission: { direction: '→', note: '佣金结构短期保持稳定。' },
          payment: { direction: '→', note: '支付链路暂未见直接风险外溢。' },
          ecosystem: { direction: '→', note: '生态侧以预警为主。' }
        };

  const actions: StrategyAction[] =
    caseType === 'A'
      ? [
          { priority: 'P0', owner: '战略', action: `围绕${dominantDimensions.join('、')}制定本周风险应对清单`, expected_effect: '降低外部波动对收入冲击', time_horizon: '本周' },
          { priority: 'P1', owner: '产品', action: '优化支付/履约关键链路的监控与回滚预案', expected_effect: '减少转化损失', time_horizon: '本月' },
          { priority: 'P2', owner: '商业化', action: '将当日信号转化为客户沟通脚本并分层触达', expected_effect: '稳住续费与扩单预期', time_horizon: '本季度' }
        ]
      : [
          { priority: 'P0', owner: '战略', action: '建立宏观风险周跟踪与触发阈值', expected_effect: '提前预警', time_horizon: '本周' },
          { priority: 'P1', owner: '产品', action: '保持关键指标监测并预留弹性策略开关', expected_effect: '提高响应速度', time_horizon: '本月' },
          { priority: 'P2', owner: '商业化', action: '对大客户同步“暂无直接冲击、持续监测”结论', expected_effect: '稳定客户预期', time_horizon: '本季度' }
        ];

  console.log(
    `[daily-brief] scanned=${todayNews.length} classified={direct:${directSignals.length},macro:${macroSignals.length}} case=${caseType}`
  );

  return {
    headline,
    one_liner:
      caseType === 'A'
        ? `今日高影响信号集中在${dominantDimensions.join('、')}，建议先处理支付、履约与商业化链路中的直接传导风险。`
        : '今日以外围与观察型信号为主，建议先跟踪关键指标，再逐步验证是否需要放大动作。',
    time_window: toUtc8WindowLabel(dayKey),
    signal_case: caseType,
    top_drivers: topDrivers,
    top_news: topNews,
    citations,
    transmission_analysis: transmissionAnalysis,
    actions,
    impact_on_revenue_model: revenueImpact,
    meta
  };
}

function isFallbackLikeDailyBrief(brief: StrategyBrief | null | undefined): boolean {
  if (!brief) return false;
  const headline = String(brief.headline || '').trim();
  const oneLiner = String(brief.one_liner || '').trim();
  const topAction = String(brief.actions?.[0]?.action || '').trim();
  const merchantDemand = String(brief.impacts?.merchant_demand || '').trim();
  const paymentsRisk = String(brief.impacts?.payments_risk || '').trim();
  const competition = String(brief.impacts?.competition || '').trim();

  let hits = 0;
  if (/波动加剧，先做可逆验证与预案$/.test(headline)) hits += 2;
  if (oneLiner.startsWith('当日信号主要集中在')) hits += 1;
  if (topAction === '锁定高风险信号并启动跨团队应急同步。') hits += 1;
  if (merchantDemand.includes('无新增集中冲击')) hits += 1;
  if (paymentsRisk.includes('支付风险无新增高压事件')) hits += 1;
  if (competition.includes('竞争面暂未出现确定性变盘')) hits += 1;
  return hits >= 3;
}

async function buildRuleBasedBriefForDate(dayKey: string): Promise<StrategyBrief | null> {
  try {
    const news = await getRealOrMockNews(false, SUPABASE_LIMIT, true, null, dayKey, dayKey);
    if (!Array.isArray(news) || news.length === 0) return null;
    const brief = buildDailyStrategyBrief(news, dayKey);
    return brief.meta?.news_count_used ? brief : null;
  } catch (err) {
    console.warn('[api] buildRuleBasedBriefForDate failed.', err);
    return null;
  }
}
function buildDailyInsight(news: NewsItem[]): DailyInsight {
  if (news.length === 0) return mockDailyInsight;

  const policyIds = idsByRule(news, (n) => n.moduleTags.includes('政策') || n.riskLevel === '高');
  const aiThreatIds = idsByRule(news, (n) => n.moduleTags.includes('AI') || n.title.toLowerCase().includes('agent'));
  const competeIds = idsByRule(news, (n) => ['Shopify', 'Amazon', 'TikTok Shop', 'Temu', 'Shopline', 'Shoplazza'].includes(n.platform));
  const paymentIds = idsByRule(news, (n) => n.impactDimensions.includes('支付') || n.moduleTags.includes('支付'));
  const revenueIds = idsByRule(news, (n) => n.impactDimensions.includes('佣金') || n.impactDimensions.includes('订阅'));

  const avgImpact = Math.round(news.reduce((sum, item) => sum + item.impactScore, 0) / news.length);
  const highRiskRatio = news.filter((n) => n.riskLevel === '高').length / Math.max(news.length, 1);

  const growth = Math.max(45, Math.min(92, avgImpact - 6));
  const agent = Math.max(40, Math.min(95, Math.round((aiThreatIds.length / Math.max(news.length, 1)) * 200 + 55)));
  const compete = Math.max(45, Math.min(95, Math.round((competeIds.length / Math.max(news.length, 1)) * 180 + 50)));
  const stable = Math.max(30, Math.min(90, Math.round(75 - highRiskRatio * 30)));
  const policy = Math.max(35, Math.min(95, Math.round((policyIds.length / Math.max(news.length, 1)) * 220 + 45)));

  const strategyBrief = buildDailyStrategyBrief(news);
  const brief = strategyBrief.headline;

  return {
    brief,
    strategyBrief,
    indexes: [
      {
        id: 'growth',
        name: '行业增长动能指数',
        value: growth,
        delta: '+1.8',
        description: '由最新高影响新闻聚合得出，反映行业扩张与需求强度。',
        evidence: { id: 'ev-growth', title: '行业增长动能引用', newsIds: revenueIds }
      },
      {
        id: 'agent',
        name: 'AI Agent 威胁指数',
        value: agent,
        delta: '+2.9',
        description: '衡量 AI 自动化能力对传统 SaaS 价值链的替代压力。',
        evidence: { id: 'ev-agent', title: 'AI Agent 威胁引用', newsIds: aiThreatIds }
      },
      {
        id: 'compete',
        name: '竞争活跃度指数',
        value: compete,
        delta: '+2.1',
        description: '反映头部平台在产品、履约、AI 上的动作密度。',
        evidence: { id: 'ev-compete', title: '竞争活跃度引用', newsIds: competeIds }
      },
      {
        id: 'stable',
        name: '收入模型稳定度',
        value: stable,
        delta: '-1.4',
        description: '综合订阅/佣金/支付维度波动，越高代表越稳定。',
        evidence: { id: 'ev-stable', title: '收入稳定度引用', newsIds: revenueIds }
      },
      {
        id: 'policy',
        name: '政策风险指数',
        value: policy,
        delta: '+3.3',
        description: '衡量跨境监管、关税、合规事件对业务模型冲击。',
        evidence: { id: 'ev-policy', title: '政策风险引用', newsIds: policyIds }
      }
    ],
    reasoningNodes: [
      {
        id: 'r1',
        text: '政策/平台规则变化',
        explain: '监管与平台规则变化直接影响商家经营约束。',
        trend7d: buildTrendFromNews(news, policyIds, policy, -4),
        evidence: { id: 'ev-r1', title: '推理节点1引用', newsIds: policyIds }
      },
      {
        id: 'r2',
        text: '获客与运营效率波动',
        explain: '投放、履约和客服效率影响 ROI。',
        trend7d: buildTrendFromNews(news, competeIds, compete, -2),
        evidence: { id: 'ev-r2', title: '推理节点2引用', newsIds: competeIds }
      },
      {
        id: 'r3',
        text: 'GMV 增速变化',
        explain: 'ROI 与供给能力变化传导到成交增长。',
        trend7d: buildTrendFromNews(news, revenueIds, growth, 0),
        evidence: { id: 'ev-r3', title: '推理节点3引用', newsIds: revenueIds }
      },
      {
        id: 'r4',
        text: 'SaaS 收入结构影响',
        explain: '最终反映到订阅、佣金、支付与生态收益。',
        trend7d: buildTrendFromNews(news, [...new Set([...revenueIds, ...paymentIds])], stable, 1),
        evidence: { id: 'ev-r4', title: '推理节点4引用', newsIds: [...new Set([...revenueIds, ...paymentIds])] }
      }
    ],
    impactScore: Math.max(55, Math.min(95, avgImpact)),
    dimensions: [
      { name: '订阅', score: Math.round((growth + stable) / 2), evidence: { id: 'ev-dim-sub', title: '订阅影响引用', newsIds: revenueIds } },
      { name: '佣金', score: Math.round((growth + compete) / 2), evidence: { id: 'ev-dim-com', title: '佣金影响引用', newsIds: revenueIds } },
      { name: '支付', score: Math.round((policy + stable) / 2), evidence: { id: 'ev-dim-pay', title: '支付影响引用', newsIds: paymentIds } },
      { name: '生态', score: Math.round((agent + compete) / 2), evidence: { id: 'ev-dim-eco', title: '生态影响引用', newsIds: aiThreatIds } }
    ],
    priorities: [
      'P0：优先处理高风险政策与支付链路波动。',
      'P1：对 AI/自动化能力进行产品化升级并绑定订阅价值。',
      'P1：围绕重点平台建立周度竞争动作跟踪机制。'
    ],
    updatedAt: new Date().toLocaleString('zh-CN', { hour12: false })
  };
}

function buildMatrix(news: NewsItem[]): MatrixRow[] {
  if (news.length === 0) return mockMatrix;
  const targetPlatforms = ['Shopify', 'Amazon', 'TikTok Shop'];
  const normalize = (text: string) => String(text || '').replace(/\s+/g, '').trim();

  return targetPlatforms.map((platform) => {
    const rows = news
      .filter((item) => item.platform === platform)
      .filter((item) => (platform === 'Shopify' ? !isShopifyFalsePositive(item) : true))
      .filter((item) => !isLowConfidenceInsight(item))
      .sort((a, b) => b.impactScore - a.impactScore || new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
    const first = rows[0];
    const fallback = `暂无 ${platform} 最新事件，建议继续追踪。`;
    const evidenceIds = rows.map((item) => item.id);
    const usedRowIds = new Set<string>();
    const usedTexts = new Set<string>();

    const weeklyMove = pickChineseText([first?.aiTldr, first?.summary, first?.title], fallback);
    if (first?.id) usedRowIds.add(first.id);
    usedTexts.add(normalize(weeklyMove));

    const productRow = rows.find((n) => {
      if (usedRowIds.has(n.id)) return false;
      if (!(n.moduleTags.includes('平台') || n.moduleTags.includes('物流'))) return false;
      const candidate = pickChineseText([n.summary, n.aiTldr, n.title], '');
      return Boolean(candidate) && !usedTexts.has(normalize(candidate));
    });
    const productUpdate = productRow
      ? pickChineseText([productRow.summary, productRow.aiTldr, productRow.title], '暂无显著产品更新')
      : '暂无显著产品更新';
    if (productRow?.id) usedRowIds.add(productRow.id);
    usedTexts.add(normalize(productUpdate));

    const aiRow = rows.find((n) => {
      if (usedRowIds.has(n.id)) return false;
      if (!n.moduleTags.includes('AI')) return false;
      const candidate = pickChineseText([n.aiTldr, n.summary, n.title], '');
      return Boolean(candidate) && !usedTexts.has(normalize(candidate));
    });
    const aiUpdate = aiRow
      ? pickChineseText([aiRow.aiTldr, aiRow.summary, aiRow.title], '暂无明确 AI 动态')
      : '暂无明确 AI 动态';

    return {
      name: platform,
      weeklyMove,
      productUpdate,
      aiUpdate,
      evidence: {
        id: `ev-m-${platform.toLowerCase().replace(/\s+/g, '-')}`,
        title: `${platform} 竞争引用`,
        newsIds: evidenceIds,
        items: rows
      }
    };
  });
}

function enrichRevenueWithEvidence(base: RevenueImpactResult, news: NewsItem[]): RevenueImpactResult {
  if (news.length === 0) return base;
  const byDim = {
    subscription: idsByRule(news, (n) => n.impactDimensions.includes('订阅')),
    commission: idsByRule(news, (n) => n.impactDimensions.includes('佣金')),
    payment: idsByRule(news, (n) => n.impactDimensions.includes('支付')),
    ecosystem: idsByRule(news, (n) => n.impactDimensions.includes('生态'))
  };

  return {
    ...base,
    endpoint: '/rest/v1/news_raw',
    evidence: {
      id: 'ev-revenue-live',
      title: '收入沙盘引用新闻',
      newsIds: [...new Set([...byDim.subscription, ...byDim.commission, ...byDim.payment, ...byDim.ecosystem])].slice(0, 12)
    },
    dimensions: base.dimensions.map((dim) => ({
      ...dim,
      evidence: {
        ...dim.evidence,
        newsIds: byDim[dim.id as keyof typeof byDim] || []
      }
    }))
  };
}

function getDimensionScoreByName(insight: DailyInsight, name: string): number {
  return insight.dimensions.find((item) => item.name === name)?.score ?? 0;
}

function getDimensionDeltaById(revenue: RevenueImpactResult, id: string): number {
  return revenue.dimensions.find((item) => item.id === id)?.delta ?? 0;
}

function buildScoreBreakdown(news: NewsItem[], scenario: RevenueScenario): ScoreBreakdown {
  const insight = buildDailyInsight(news);
  const revenue = enrichRevenueWithEvidence(calculateRevenueImpact(scenario), news);

  const baseline = {
    subscription: getDimensionScoreByName(insight, '订阅'),
    commission: getDimensionScoreByName(insight, '佣金'),
    payment: getDimensionScoreByName(insight, '支付'),
    ecosystem: getDimensionScoreByName(insight, '生态'),
    overall: insight.impactScore
  };

  const delta = {
    subscription: getDimensionDeltaById(revenue, 'subscription'),
    commission: getDimensionDeltaById(revenue, 'commission'),
    payment: getDimensionDeltaById(revenue, 'payment'),
    ecosystem: getDimensionDeltaById(revenue, 'ecosystem'),
    overall: Math.round(
      (getDimensionDeltaById(revenue, 'subscription') +
        getDimensionDeltaById(revenue, 'commission') +
        getDimensionDeltaById(revenue, 'payment') +
        getDimensionDeltaById(revenue, 'ecosystem')) /
        4
    )
  };

  const final = combineFinalScore(baseline, delta);

  return {
    baseline,
    delta,
    final,
    explain: {
      baselineMethod: 'Baseline：外部态势（新闻驱动，leading indicator）。',
      deltaMethod: 'Δ：策略参数变化（沙盘仿真，what-if）。',
      notes: ['Final = clamp(Baseline + Δ, 0..100)', 'Final 用于策略优先级决策。']
    },
    evidence: {
      subscription: insight.dimensions.find((item) => item.name === '订阅')?.evidence.newsIds || [],
      commission: insight.dimensions.find((item) => item.name === '佣金')?.evidence.newsIds || [],
      payment: insight.dimensions.find((item) => item.name === '支付')?.evidence.newsIds || [],
      ecosystem: insight.dimensions.find((item) => item.name === '生态')?.evidence.newsIds || []
    }
  };
}

async function getRealOrMockNews(
  force = false,
  limit = SUPABASE_LIMIT,
  lite = true,
  recentDays: number | null = DEFAULT_RECENT_DAYS,
  dateFrom?: string,
  dateTo?: string
): Promise<NewsItem[]> {
  try {
    const list = await getSupabaseNewsCached(force, limit, lite, recentDays, dateFrom, dateTo);
    return list.length > 0 ? list : fallbackNews();
  } catch (err) {
    if (!ALLOW_MOCK_FALLBACK) {
      throw err;
    }
    console.warn('[api] live source unavailable, fallback to mock.', err);
    runtimeDataSource = 'mock';
    return fallbackNews();
  }
}

async function getDailyBriefFromData(news: NewsItem[], date?: string): Promise<StrategyBrief | null> {
  const dayKey = (date || utc8TodayKey()).slice(0, 10);
  try {
    const rows = await fetchDailyBriefRows(dayKey);
    if (!rows.length) return null;
    return mapDailyBriefToStrategyBrief(rows[0], news);
  } catch (err) {
    console.warn('[api] daily_brief unavailable, fallback to rule-based brief.', err);
    return null;
  }
}

export const api = {
  async getNews(query: NewsQuery = {}): Promise<PagedResult<NewsItem>> {
    await delay();
    const isLibraryHeavyQuery = (query.pageSize || 0) >= 1000;
    const requestedLimit = isLibraryHeavyQuery ? LIBRARY_FETCH_LIMIT : SUPABASE_LIMIT;
    let source: NewsItem[] = [];
    try {
      source = await Promise.race([
        getRealOrMockNews(
          false,
          requestedLimit,
          !isLibraryHeavyQuery,
          query.dateFrom || query.dateTo ? null : isLibraryHeavyQuery ? null : DEFAULT_RECENT_DAYS,
          query.dateFrom,
          query.dateTo
        ),
        delay(1800).then(() => [])
      ]);
    } catch (err) {
      console.warn('[api] getNews failed, return empty list.', err);
      source = [];
    }
    const list = filterNews(source, query);
    return paginate(list, query.page || 1, query.pageSize || 9);
  },

  async searchNews(query: NewsQuery = {}): Promise<PagedResult<NewsItem>> {
    return api.getNews(query);
  },

  async getNewsById(id: NewsId): Promise<NewsItem | null> {
    await delay(120);
    const list = await getRealOrMockNews();
    return list.find((item) => item.id === id) || null;
  },

  async getRelatedNews(newsId: NewsId): Promise<NewsItem[]> {
    await delay(120);
    const list = await getRealOrMockNews();
    const current = list.find((item) => item.id === newsId);
    if (!current) return [];

    return list
      .filter((item) => item.id !== newsId)
      .filter(
        (item) =>
          item.platform === current.platform ||
          item.region === current.region ||
          item.moduleTags.some((tag) => current.moduleTags.includes(tag))
      )
      .slice(0, 6);
  },

  async getDailyInsight(): Promise<DailyInsight> {
    await delay(180);
    const dayKey = utc8TodayKey();
    const newsPromise = getRealOrMockNews(false, SUPABASE_LIMIT, true, null, dayKey, dayKey).catch((err) => {
      console.warn('[api] getDailyInsight news fetch failed, fallback to brief-only path.', err);
      return [];
    });

    // First load daily_brief directly, do not block on news_raw latency.
    let brief = await getDailyBriefFromData([], dayKey);
    const news = await Promise.race([newsPromise, delay(1800).then(() => [])]);
    if (brief && isFallbackLikeDailyBrief(brief) && news.length > 0) {
      const ruleBased = buildDailyStrategyBrief(news, dayKey);
      if (ruleBased.meta?.news_count_used) {
        brief = ruleBased;
      }
    }
    const fallback = news.length > 0 ? buildDailyInsight(news) : mockDailyInsight;
    if (!brief) return fallback;
    return {
      ...fallback,
      brief: brief.headline,
      strategyBrief: brief,
      updatedAt: brief.meta.generated_at
        ? new Date(brief.meta.generated_at).toLocaleString('zh-CN', { hour12: false })
        : fallback.updatedAt
    };
  },

  async getDailyBrief(date?: string): Promise<StrategyBrief | null> {
    await delay(130);
    const dayKey = (date || utc8TodayKey()).slice(0, 10);
    const newsPromise = getRealOrMockNews(false, SUPABASE_LIMIT, true, null, dayKey, dayKey).catch((err) => {
      console.warn('[api] getDailyBrief news fetch failed, return brief without citation enrichment.', err);
      return [];
    });
    let brief = await getDailyBriefFromData([], dayKey);
    if (!brief) {
      const news = await newsPromise;
      const hydrated = await getDailyBriefFromData(news, dayKey);
      if (hydrated) return hydrated;
      return buildDailyStrategyBrief(news, dayKey);
    }
    if (brief.meta?.brief_source === 'daily_brief' && !hasReadableCitationTitles(brief.citations)) {
      const news = await newsPromise;
      if (news.length > 0) {
        const enriched = await getDailyBriefFromData(news, dayKey);
        if (enriched) brief = enriched;
      }
    }
    if (brief && isFallbackLikeDailyBrief(brief)) {
      const ruleBased = await buildRuleBasedBriefForDate(dayKey);
      if (ruleBased) return ruleBased;
    }
    return brief;
  },

  async getMatrix(params: { dateFrom?: string; dateTo?: string; recentDays?: number } = {}): Promise<MatrixRow[]> {
    await delay(150);
    try {
      return buildMatrix(await getMatrixNews(params));
    } catch (err) {
      console.warn('[api] getMatrix failed, fallback to mock matrix.', err);
      return mockMatrix;
    }
  },

  async getRevenueImpact(scenario: RevenueScenario): Promise<RevenueImpactResult> {
    await delay(160);
    const news = await Promise.race([
      getRealOrMockNews().catch(() => fallbackNews()),
      delay(1800).then(() => fallbackNews())
    ]);
    const result = calculateRevenueImpact(scenario);
    return enrichRevenueWithEvidence(result, news);
  },

  async getScoreBreakdown(scenario: RevenueScenario): Promise<ScoreBreakdown> {
    await delay(140);
    const news = await Promise.race([
      getRealOrMockNews().catch(() => fallbackNews()),
      delay(1800).then(() => fallbackNews())
    ]);
    return buildScoreBreakdown(news, scenario);
  },

  async getAppMeta() {
    await delay(120);
    return {
      assistant: mockAssistant,
      explainers: mockModelExplainers
    };
  },

  async getNewsTotal(
    dateFrom?: string,
    dateTo?: string,
    options?: { impactGt?: number; impactLte?: number }
  ): Promise<number> {
    await delay(60);
    const { total } = await fetchNewsRawPage({
      offset: 0,
      limit: 1,
      dateFrom,
      dateTo,
      includeTotal: true,
      lite: true,
      impactGt: options?.impactGt,
      impactLte: options?.impactLte
    });
    return total;
  },

  async getNewsBatch(params: {
    offset: number;
    limit: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ list: NewsItem[]; fetchedCount: number }> {
    await delay(80);
    const { rows } = await fetchNewsRawPage({
      offset: params.offset,
      limit: params.limit,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      includeTotal: false,
      lite: true
    });
    return {
      fetchedCount: rows.length,
      list: dedupeNewsItems(rows.map(toNewsItem).filter((item) => Boolean(item.id)))
    };
  },

  async getCompetitorUpdates(params: {
    offset?: number;
    limit?: number;
    platform?: string;
    sourceType?: string;
    eventType?: string;
    competitiveImpact?: string;
    keyword?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}) {
    await delay(80);
    const { rows, total } = await fetchCompetitorUpdatesPage({
      offset: params.offset || 0,
      limit: params.limit || 100,
      includeTotal: true,
      platform: params.platform,
      sourceType: params.sourceType,
      eventType: params.eventType,
      competitiveImpact: params.competitiveImpact,
      keyword: params.keyword,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    });
    const list = rows.map(toCompetitorUpdate).filter((item) => item.id);
    return { list, total, fetchedCount: rows.length };
  }
};
