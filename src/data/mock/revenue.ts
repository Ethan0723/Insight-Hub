import { RevenueImpactResult, RevenueScenario } from '../../types/domain';

const baseEvidence = { id: 'ev-revenue', title: '收入沙盘引用新闻', newsIds: [101, 102, 103, 104, 108, 112] };

function formatDateLabel(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function buildTimelineFromNews(
  news: Array<{ publishDate?: string; impactScore?: number }>
): { labels: string[]; baseTrend: number[] } {
  const scoresByDay = new Map<string, number[]>();

  news.forEach((item) => {
    const raw = String(item.publishDate || '').trim();
    if (!raw) return;
    const day = raw.slice(0, 10);
    if (!scoresByDay.has(day)) scoresByDay.set(day, []);
    const score = Number(item.impactScore);
    scoresByDay.get(day)?.push(Number.isFinite(score) ? score : 60);
  });

  const days = Array.from(scoresByDay.keys()).sort();
  if (days.length === 0) {
    return {
      labels: ['1/1', '1/2', '1/3', '1/4', '1/5', '1/6', '1/7'],
      baseTrend: [98, 101, 103, 105, 108, 110, 112]
    };
  }

  const labels = days.map(formatDateLabel);
  const baseTrend = days.map((day, index) => {
    const list = scoresByDay.get(day) || [];
    const avg = list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : 60;
    return Math.max(35, Math.min(95, Math.round(avg - 8 + index * 0.35)));
  });

  return { labels, baseTrend };
}

export function calculateRevenueImpact(
  scenario: RevenueScenario,
  news: Array<{ publishDate?: string; impactScore?: number }> = []
): RevenueImpactResult {
  const arpuFactor = scenario.arpuDelta * 0.08;
  const commissionFactor = scenario.commissionDelta * 180;
  const payFactor = scenario.paymentSuccessDelta * 0.12;
  const totalFactor = arpuFactor + commissionFactor + payFactor;
  const { labels, baseTrend } = buildTimelineFromNews(news);

  const subscriptionDelta = scenario.arpuDelta * 20;
  const commissionDelta = scenario.commissionDelta * 25;
  const paymentDelta = scenario.paymentSuccessDelta * 20;
  const ecosystemDelta = totalFactor * 10;

  const adjustedTrend = baseTrend.map((value, index) => {
    const step = totalFactor * (0.6 + index * 0.08);
    return Number((value + step).toFixed(2));
  });

  const gmv = `${(totalFactor * 1.9).toFixed(1)}%`;
  const subscription = `${(scenario.arpuDelta * 0.85 + scenario.paymentSuccessDelta * 0.2).toFixed(1)}%`;
  const commission = `${(scenario.commissionDelta * 320 + totalFactor * 0.6).toFixed(1)}%`;
  const paymentCost = `${(-scenario.paymentSuccessDelta * 0.07 + 0.18).toFixed(2)}pp`;

  return {
    endpoint: '/api/revenue-impact',
    labels,
    baseTrend,
    adjustedTrend,
    outputs: { gmv, subscription, commission, paymentCost },
    explanation: `在当前参数下，GMV 与佣金弹性最敏感，建议优先关注投放效率和支付成功率联动。`,
    evidence: baseEvidence,
    dimensions: [
      {
        id: 'subscription',
        name: '订阅',
        delta: Math.round(subscriptionDelta),
        sensitivity: 'ARPU 变化直接影响 MRR，AI 高阶功能可缓冲价格压力。',
        evidence: { id: 'ev-re-sub', title: '订阅维度引用', newsIds: [101, 109] }
      },
      {
        id: 'commission',
        name: '佣金',
        delta: Math.round(commissionDelta),
        sensitivity: '佣金率与 GMV 增速共同决定抽佣收入波动。',
        evidence: { id: 'ev-re-com', title: '佣金维度引用', newsIds: [103, 105, 107, 112] }
      },
      {
        id: 'payment',
        name: '支付',
        delta: Math.round(paymentDelta),
        sensitivity: '支付成功率和拒付率对净收益影响显著。',
        evidence: { id: 'ev-re-pay', title: '支付维度引用', newsIds: [102, 104, 108, 110] }
      },
      {
        id: 'ecosystem',
        name: '生态',
        delta: Math.round(ecosystemDelta),
        sensitivity: '生态协同能力决定中长期留存和扩张效率。',
        evidence: { id: 'ev-re-eco', title: '生态维度引用', newsIds: [101, 106, 111] }
      }
    ]
  };
}
