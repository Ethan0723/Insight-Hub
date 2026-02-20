import { RevenueImpactResult, RevenueScenario } from '../../types/domain';

const labels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'];
const baseTrend = [100, 103, 105, 108, 110, 113, 116];

const baseEvidence = { id: 'ev-revenue', title: '收入沙盘引用新闻', newsIds: [101, 102, 103, 104, 108, 112] };

export function calculateRevenueImpact(scenario: RevenueScenario): RevenueImpactResult {
  const arpuFactor = scenario.arpuDelta * 0.08;
  const commissionFactor = scenario.commissionDelta * 180;
  const payFactor = scenario.paymentSuccessDelta * 0.12;
  const totalFactor = arpuFactor + commissionFactor + payFactor;

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
        score: Math.round(58 + scenario.arpuDelta * 1.2),
        sensitivity: 'ARPU 变化直接影响 MRR，AI 高阶功能可缓冲价格压力。',
        evidence: { id: 'ev-re-sub', title: '订阅维度引用', newsIds: [101, 109] }
      },
      {
        id: 'commission',
        name: '佣金',
        score: Math.round(72 + scenario.commissionDelta * 50),
        sensitivity: '佣金率与 GMV 增速共同决定抽佣收入波动。',
        evidence: { id: 'ev-re-com', title: '佣金维度引用', newsIds: [103, 105, 107, 112] }
      },
      {
        id: 'payment',
        name: '支付',
        score: Math.round(66 + scenario.paymentSuccessDelta * 2.6),
        sensitivity: '支付成功率和拒付率对净收益影响显著。',
        evidence: { id: 'ev-re-pay', title: '支付维度引用', newsIds: [102, 104, 108, 110] }
      },
      {
        id: 'ecosystem',
        name: '生态',
        score: Math.round(69 + totalFactor * 3),
        sensitivity: '生态协同能力决定中长期留存和扩张效率。',
        evidence: { id: 'ev-re-eco', title: '生态维度引用', newsIds: [101, 106, 111] }
      }
    ]
  };
}
