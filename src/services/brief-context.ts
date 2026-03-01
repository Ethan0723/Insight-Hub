import { StrategyBrief } from '../types/domain';

const DEFAULT_TIME_WINDOW_HOURS = 72;
const DEFAULT_LIMIT = 50;
const THEME_BUCKETS = [
  { name: '政策/关税/合规', keywords: ['tariff', 'customs', 'vat', 'de minimis', 'duty', 'regulation', 'compliance'] },
  { name: '支付与风控', keywords: ['payment', 'checkout', 'chargeback', 'card', 'fraud', 'risk'] },
  { name: '流量与渠道平台', keywords: ['marketplace', 'amazon', 'tiktok', 'temu', 'shopify', 'channel'] },
  { name: '物流与供应链', keywords: ['logistics', 'fulfillment', 'freight', 'supply chain', 'shipping'] }
];

const RISK_WEIGHT = { 高: 15, 中: 8, 低: 0 };
const HISTORY_KEY = 'daily_strategy_headlines';

export interface BriefContextResult {
  headline: string;
  one_liner: string;
  confidence: number;
  citations: Array<{ id: string; title: string; source: string; url: string; published_at: string; impact_score: number; risk_level: string; matched_keywords: string[] }>;
  actions: StrategyBrief['actions'];
  time_window: string;
  meta: StrategyBrief['meta'];
  top_drivers: Array<{ theme: string; bucket_score: number; why_it_matters: string; mechanism: string; evidence_ids: string[] }>;
  impact_on_revenue_model: StrategyBrief['impact_on_revenue_model'];
}

function detectTheme(text: string) {
  const lower = text.toLowerCase();
  for (const bucket of THEME_BUCKETS) {
    for (const keyword of bucket.keywords) {
      if (lower.includes(keyword)) {
        return bucket.name;
      }
    }
  }
  return '流量与渠道平台';
}

function bucketScore(bucket: { avgImpact: number; recencyBonus: number; riskScore: number; lowQualityPenalty: number }) {
  return bucket.avgImpact + bucket.recencyBonus + bucket.riskScore - bucket.lowQualityPenalty;
}

const TEMPLATES = [
  { id: 'risk', render: (theme: string) => `${theme}进入拉高风险，独立站SaaS需提前布局成本弹性。` },
  { id: 'opportunity', render: (theme: string) => `${theme}带来窗口，提前部署可以加速接入新流量。` },
  { id: 'structural', render: (theme: string) => `${theme}变化正在改写收入结构，请同步调整订阅与佣金策略。` },
  { id: 'action', render: (theme: string) => `${theme}信号明确，立即拉通风控与定价响应。` },
  { id: 'cost', render: (theme: string) => `${theme}波动推高成本，独立站SaaS需要再三验证可定价空间。` },
  { id: 'momentum', render: (theme: string) => `${theme}演进加快，把握先行优势提升平台黏性。` }
];

function selectTemplate(theme: string, history: string[]) {
  const filtered = TEMPLATES.filter((template) => template.render(theme).length < 28);
  for (const attempt of filtered.length ? filtered : TEMPLATES) {
    const headline = attempt.render(theme);
    if (!history.some((item) => item === headline)) {
      history.push(headline);
      return headline;
    }
  }
  return `关注${theme}变化`; 
}

function loadHeadlineHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function persistHeadline(headline: string) {
  if (typeof window === 'undefined') return;
  const history = loadHeadlineHistory();
  history.push(headline);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-20)));
}

export function buildDailyBriefContext(rawNews: any[], options: { timeWindowHours?: number; limit?: number } = {}) {
  const timeWindow = options.timeWindowHours || DEFAULT_TIME_WINDOW_HOURS;
  const limit = options.limit || DEFAULT_LIMIT;
  const now = Date.now();
  const threshold = now - timeWindow * 3600 * 1000;
  const filtered = rawNews
    .map((item) => {
      const published = Date.parse(item.publishDate || item.createdAt || '') || 0;
      return { ...item, publishedAt: published };
    })
    .filter((item) => item.publishedAt >= threshold)
    .sort((a, b) => {
      const impactDiff = (b.impactScore || 0) - (a.impactScore || 0);
      if (impactDiff !== 0) return impactDiff;
      const riskOrder = { 高: 3, 中: 2, 低: 1 };
      return (riskOrder[b.riskLevel || '中'] || 1) - (riskOrder[a.riskLevel || '中'] || 1);
    })
    .slice(0, limit);

  const bucketMap = new Map<string, any>();
  const citations: BriefContextResult['citations'] = [];
  filtered.forEach((item) => {
    const theme = detectTheme(item.title + ' ' + item.summary + ' ' + (item.moduleTags || []).join(' '));
    if (!bucketMap.has(theme)) bucketMap.set(theme, { name: theme, items: [] });
    bucketMap.get(theme).items.push(item);
  });

  const drivers = Array.from(bucketMap.values()).map((bucket) => {
    const avgImpact = bucket.items.reduce((sum: number, news: any) => sum + (news.impactScore || 0), 0) / bucket.items.length;
    const riskScore = bucket.items.reduce((sum: number, news: any) => sum + (RISK_WEIGHT[news.riskLevel] || 0), 0);
    const recencyBonus = bucket.items.reduce((sum: number, news: any) => sum + (Date.now() - news.publishedAt < 24 * 3600 * 1000 ? 8 : 3), 0);
    const lowQualityPenalty = bucket.items.filter((news: any) => !news.summary || news.summary.includes('信息不足')).length * 10;
    return { theme: bucket.name, items: bucket.items, avgImpact, riskScore, recencyBonus, lowQualityPenalty, bucketScore: bucketScore({ avgImpact, recencyBonus, riskScore, lowQualityPenalty }) };
  }).sort((a, b) => b.bucketScore - a.bucketScore).slice(0, 2);

  filtered.forEach((item) => {
    if (citations.length >= 8) return;
    citations.push({
      id: item.id,
      title: item.title || item.aiTldr || '标题缺失',
      source: item.source || '未知',
      url: item.originalUrl || item.url || '#',
      published_at: item.publishDate || item.createdAt || '',
      impact_score: item.impactScore || 0,
      risk_level: item.riskLevel || '中',
      matched_keywords: THEME_BUCKETS.flatMap((bucket) => bucket.keywords.filter((kw) => (item.title + ' ' + item.summary).toLowerCase().includes(kw)))
    });
  });

  const primary = drivers[0];
  const history = loadHeadlineHistory();
  const headline = persistHeadline(selectTemplate(primary.theme, history));
  persistHeadline(headline);

  const actions = [
    { priority: 'P0', owner: '战略', action: '复盘主驱动', expected_effect: '降风险', time_horizon: '本周' },
    { priority: 'P1', owner: '产品', action: '调整功能/风控', expected_effect: '提升稳定', time_horizon: '本月' },
    { priority: 'P2', owner: '商业化', action: '同步客户沟通', expected_effect: '巩固信任', time_horizon: '本季度' }
  ];

  return {
    headline,
    one_liner: `${primary.theme}是主驱动，${primary.bucketScore.toFixed(0)}分；${primary.theme}变动通过成本/流量影响商家行为并传导到 SaaS 收入。`,
    confidence: Math.min(95, Math.round(primary.bucketScore)),
    time_window: '近72小时',
    top_drivers: drivers.map((driver) => ({
      theme: driver.theme,
      bucket_score: Math.round(driver.bucketScore),
      why_it_matters: `${driver.theme}的变化会影响客户运营成本`,
      mechanism: `${driver.theme} -> 商家行为 -> SaaS 收入`,
      evidence_ids: driver.items.slice(0, 3).map((item: any) => item.id)
    })),
    impact_on_revenue_model: {
      subscription: { direction: '→', note: '持续观察' },
      commission: { direction: '→', note: '待评估' },
      payment: { direction: '→', note: '待观察' },
      ecosystem: { direction: '→', note: '回补' }
    },
    actions,
    citations,
    meta: {
      news_count_scanned: filtered.length,
      news_count_used: filtered.length,
      low_quality_count: filtered.filter((news) => !news.summary).length
    }
  };
}
