export const revenueImpactData = {
  endpoint: '/api/revenue-impact',
  labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
  trends: {
    subscriptionRiskTrend: [38, 40, 42, 49, 53, 57, 61],
    commissionSensitivity: [62, 66, 70, 74, 79, 83, 86],
    paymentRateSimulation: [2.9, 2.95, 3.02, 3.08, 3.15, 3.2, 3.26],
    churnPrediction: [4.8, 5.1, 5.2, 5.6, 6.0, 6.3, 6.7]
  },
  dimensions: [
    {
      id: 'subscription',
      name: '订阅',
      score: 61,
      sensitivity: '模板产品价格弹性上升，高阶 AI 功能可缓冲流失。',
      citedNewsIds: [2, 9]
    },
    {
      id: 'commission',
      name: '佣金',
      score: 78,
      sensitivity: '投放效率与履约规则变化会直接传导至 GMV 与佣金。',
      citedNewsIds: [3, 5, 6, 10, 12]
    },
    {
      id: 'payment',
      name: '支付',
      score: 66,
      sensitivity: '支付路由和监管变化共同决定费率与成功率。',
      citedNewsIds: [1, 4, 8, 11]
    },
    {
      id: 'ecosystem',
      name: '生态',
      score: 72,
      sensitivity: '插件与数据联动能力将决定平台长期留存与扩张效率。',
      citedNewsIds: [2, 6, 7, 10]
    }
  ]
};
