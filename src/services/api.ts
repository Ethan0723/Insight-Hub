import {
  DailyInsight,
  MatrixRow,
  NewsId,
  NewsItem,
  NewsQuery,
  PagedResult,
  ScoreBreakdown,
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
const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE !== 'false';
const SUPABASE_LIMIT = Number(import.meta.env.VITE_SUPABASE_NEWS_LIMIT || 1000);
const ALLOW_MOCK_FALLBACK = import.meta.env.DEV || import.meta.env.VITE_ALLOW_MOCK_FALLBACK === 'true';

let cache: { ts: number; list: NewsItem[] } | null = null;
let runtimeDataSource: 'supabase_direct' | 'server_proxy' | 'mock' = 'mock';

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

  // Non-official sources: only map when platform is clearly headline subject and not negated.
  if (!hasNegatedShopify && /^(shopify|\[shopify\]|shopify[:：-])/.test(t)) return 'Shopify';
  if (/^(amazon|\[amazon\]|amazon[:：-])/.test(t)) return 'Amazon';
  if (/^(tiktok|tiktok shop|\[tiktok\]|tiktok[:：-])/.test(t)) return 'TikTok Shop';
  if (/^(temu|\[temu\]|temu[:：-])/.test(t)) return 'Temu';

  return 'Global';
}

function isNegatedShopifyTitle(title: string): boolean {
  const t = title.toLowerCase();
  const hasWooCommerceContrast =
    /(woocommerce|woo commerce)/.test(t) &&
    /shopify/.test(t) &&
    /(instead of|rather than|not|without|vs|versus|而非|不是|并非|转向|放弃|没有选择)/.test(title);
  return (
    hasWooCommerceContrast ||
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
  const titleZh = String(summaryObj?.title_zh || '').trim();
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
    String(summaryObj?.tldr || '').trim() ||
    String(summaryObj?.core_summary || '').trim() ||
    content.slice(0, 120) ||
    title;

  const summary =
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

function isClearlyIrrelevant(item: NewsItem): boolean {
  const lowConfidenceSignals = [
    '信息不足',
    '判断置信度较低',
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

async function fetchFromSupabaseRaw(): Promise<NewsItem[]> {
  if (!hasSupabaseConfig()) {
    throw new Error('missing supabase config');
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/news_raw`);
  url.searchParams.set(
    'select',
    'id,title,content,source,url,publish_time,created_at,summary,impact_score,risk_level,platform,region,event_type,importance_level,sentiment_score,summary_generated_at'
  );
  url.searchParams.set('order', 'publish_time.desc');
  url.searchParams.set('limit', String(SUPABASE_LIMIT));

  const res = await fetch(url.toString(), {
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
  return rows.map(toNewsItem).filter((item) => Boolean(item.id)).filter((item) => !isClearlyIrrelevant(item));
}

async function fetchFromServerProxyRaw(): Promise<NewsItem[]> {
  const res = await fetch('/api/news_raw');
  if (!res.ok) {
    throw new Error(`proxy http ${res.status}`);
  }

  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  runtimeDataSource = 'server_proxy';
  return rows.map(toNewsItem).filter((item) => Boolean(item.id)).filter((item) => !isClearlyIrrelevant(item));
}

async function getSupabaseNewsCached(force = false): Promise<NewsItem[]> {
  const now = Date.now();
  if (!force && cache && now - cache.ts < 60_000) return cache.list;
  const list = hasSupabaseConfig() ? await fetchFromSupabaseRaw() : await fetchFromServerProxyRaw();
  cache = { ts: now, list };
  return list;
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

function buildStrategicBrief(news: NewsItem[]): string {
  const today = utc8TodayKey();
  const todayPool = news.filter((item) => toUtc8DayKey(item.createdAt) === today);
  const scoped = todayPool.length > 0 ? todayPool : news;

  const sortedByImpact = [...scoped]
    .sort((a, b) => b.impactScore - a.impactScore);

  const highQuality = sortedByImpact
    .filter((item) => !isLowConfidenceInsight(item) && item.impactScore >= 25)
    .slice(0, 1);

  const pool = (highQuality.length > 0 ? highQuality : sortedByImpact.slice(0, 1));

  if (pool.length === 0) {
    return [
      '【核心判断】',
      '今日暂无可用高影响信号，建议维持观望并持续跟踪政策与平台动态。',
      '',
      '【关键影响】',
      '1. 有效样本不足，暂不建议调整核心经营参数。',
      '',
      '【建议动作】',
      '1. 优先补充高质量情报源并复核当日抓取结果。'
    ].join('\n');
  }

  const top = pool[0];
  const riskHighCount = pool.filter((item) => item.riskLevel === '高').length;
  const focusDimensions = Array.from(new Set(pool.flatMap((item) => item.impactDimensions))).slice(0, 3).join('、') || '订阅、佣金、支付';
  const averageImpact = Math.round(pool.reduce((sum, item) => sum + item.impactScore, 0) / pool.length);
  const signalText = (top.aiTldr || top.summary || top.title || '').replace(/\s+/g, ' ').trim();

  const headline = `${top.titleZh || top.title}（影响评分 ${top.impactScore}）`;
  const riskSentence =
    riskHighCount > 0
      ? `样本中高风险信号 ${riskHighCount} 条，重点暴露在 ${focusDimensions} 维度。`
      : `当前样本以中低风险为主，但 ${focusDimensions} 维度仍需持续监控。`;

  return [
    '【核心判断】',
    `今日信号以“${headline}”为主导，平均影响评分 ${averageImpact}。${riskSentence}`,
    '',
    '【关键影响】',
    `1. ${signalText}`,
    '',
    '【建议动作】',
    `1. 先围绕 ${focusDimensions} 做参数敏感度复盘，验证是否触发成本或转化波动。`,
    '2. 对高风险或高影响新闻补做证据链复核，避免基于单条异常信号做过度决策。'
  ].join('\n');
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

  const brief = buildStrategicBrief(news);

  return {
    brief,
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

  return targetPlatforms.map((platform) => {
    const rows = news
      .filter((item) => item.platform === platform)
      .filter((item) => (platform === 'Shopify' ? !isShopifyFalsePositive(item) : true))
      .filter((item) => !isLowConfidenceInsight(item))
      .sort((a, b) => b.impactScore - a.impactScore || new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
      .slice(0, 4);
    const first = rows[0];
    const fallback = `暂无 ${platform} 最新事件，建议继续追踪。`;
    const evidenceIds = rows.map((item) => item.id);

    return {
      name: platform,
      weeklyMove: pickChineseText([first?.title, first?.aiTldr], fallback),
      productUpdate: pickChineseText(
        [
          rows.find((n) => n.moduleTags.includes('平台') || n.moduleTags.includes('物流'))?.summary,
          rows.find((n) => n.moduleTags.includes('平台') || n.moduleTags.includes('物流'))?.aiTldr
        ],
        '暂无显著产品更新'
      ),
      aiUpdate: pickChineseText([rows.find((n) => n.moduleTags.includes('AI'))?.aiTldr], '暂无明确 AI 动态'),
      evidence: {
        id: `ev-m-${platform.toLowerCase().replace(/\s+/g, '-')}`,
        title: `${platform} 竞争引用`,
        newsIds: evidenceIds
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

async function getRealOrMockNews(force = false): Promise<NewsItem[]> {
  try {
    const list = await getSupabaseNewsCached(force);
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

export const api = {
  async getNews(query: NewsQuery = {}): Promise<PagedResult<NewsItem>> {
    await delay();
    const list = filterNews(await getRealOrMockNews(), query);
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
    return buildDailyInsight(await getRealOrMockNews());
  },

  async getMatrix(): Promise<MatrixRow[]> {
    await delay(150);
    return buildMatrix(await getRealOrMockNews());
  },

  async getRevenueImpact(scenario: RevenueScenario): Promise<RevenueImpactResult> {
    await delay(160);
    const news = await getRealOrMockNews();
    const result = calculateRevenueImpact(scenario);
    return enrichRevenueWithEvidence(result, news);
  },

  async getScoreBreakdown(scenario: RevenueScenario): Promise<ScoreBreakdown> {
    await delay(140);
    return buildScoreBreakdown(await getRealOrMockNews(), scenario);
  },

  async getAppMeta() {
    await delay(120);
    return {
      assistant: mockAssistant,
      explainers: mockModelExplainers
    };
  }
};
