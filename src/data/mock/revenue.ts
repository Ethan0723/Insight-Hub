import { RevenueImpactResult, RevenueScenario } from '../../types/domain';

const baseEvidence = { id: 'ev-revenue', title: '收入沙盘引用新闻', newsIds: [101, 102, 103, 104, 108, 112] };

export function calculateRevenueImpact(scenario: RevenueScenario): RevenueImpactResult {
  const arpuFactor = scenario.arpuDelta * 0.08;
  const commissionFactor = scenario.commissionDelta * 180;
  const payFactor = scenario.paymentSuccessDelta * 0.12;
  const totalFactor = arpuFactor + commissionFactor + payFactor;
  const subscriptionDelta = scenario.arpuDelta * 20;
  const commissionDelta = scenario.commissionDelta * 25;
  const paymentDelta = scenario.paymentSuccessDelta * 20;
  const ecosystemDelta = totalFactor * 10;

  const gmv = `${(totalFactor * 1.9).toFixed(1)}%`;
  const subscription = `${(scenario.arpuDelta * 0.85 + scenario.paymentSuccessDelta * 0.2).toFixed(1)}%`;
  const commission = `${(scenario.commissionDelta * 320 + totalFactor * 0.6).toFixed(1)}%`;
  const paymentCost = `${(-scenario.paymentSuccessDelta * 0.07 + 0.18).toFixed(2)}pp`;

  return {
    endpoint: '/api/revenue-impact',
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
