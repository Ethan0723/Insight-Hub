export const strategicBrief =
  'Shopify AI 能力持续增强，AI Agent 建站工具对传统 SaaS 模板价值形成中期威胁。欧盟合规政策强化可能推高商家运营成本，从而影响 GMV 增速与佣金收入。建议强化 AI 运营能力与生态整合。';

export const strategicIndexes = [
  {
    id: 'growth',
    name: '行业增长动能指数',
    value: 73,
    delta: '+2.4',
    description: '平台流量保持增长，但区域分化加剧。'
  },
  {
    id: 'agent-threat',
    name: 'AI Agent 威胁指数',
    value: 81,
    delta: '+6.2',
    description: '低代码建站与自动运营能力正在蚕食模板溢价。'
  },
  {
    id: 'competition',
    name: '竞争活跃度指数',
    value: 76,
    delta: '+3.1',
    description: '头部平台连续更新广告、物流与 AI 工具。'
  },
  {
    id: 'revenue-stability',
    name: '收入模型稳定度',
    value: 58,
    delta: '-4.7',
    description: '佣金与支付收入对政策和投放波动更敏感。'
  },
  {
    id: 'policy-risk',
    name: '政策风险指数',
    value: 69,
    delta: '+5.3',
    description: '欧盟与英国披露要求升级，合规成本上行。'
  }
];

export const reasoningEngine = {
  chain: [
    'Meta API 更新',
    '广告投放结构变化',
    '商家 ROI 波动',
    'GMV 增速变化',
    'SaaS 佣金收入影响'
  ],
  impactScore: 84,
  dimensions: [
    { name: '订阅', score: 62 },
    { name: '佣金', score: 87 },
    { name: '支付', score: 74 },
    { name: '生态', score: 79 }
  ],
  priority: [
    'P1：调整商家分层激励，降低 ROI 下滑商家流失率',
    'P1：上线 AI 投放诊断助手，缩短优化闭环',
    'P2：重估高广告依赖类目佣金策略与支付补贴',
    'P3：建设政策预警到收入模型联动看板'
  ]
};

export const revenueAnalysis = {
  subscriptionRiskTrend: [38, 40, 42, 49, 53, 57, 61],
  commissionSensitivity: [62, 66, 70, 74, 79, 83, 86],
  paymentRateSimulation: [2.9, 2.95, 3.02, 3.08, 3.15, 3.2, 3.26],
  churnPrediction: [4.8, 5.1, 5.2, 5.6, 6.0, 6.3, 6.7],
  labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7']
};

export const intelligenceFeed = [
  {
    id: 1,
    source: 'EU Commission Brief',
    title: '欧盟强化跨境电商数据监管与合规披露要求',
    dimensionTag: '合规成本',
    impactScore: 88,
    riskLevel: '高',
    referencedIndex: '政策风险 +4',
    revenueImpact: '支付分成利润压缩'
  },
  {
    id: 2,
    source: 'Shopify IR',
    title: 'Shopify 财报显示商户解决方案收入占比继续提升',
    dimensionTag: '佣金结构',
    impactScore: 79,
    riskLevel: '中',
    referencedIndex: '收入模型稳定度 -3',
    revenueImpact: '佣金收入波动放大'
  },
  {
    id: 3,
    source: 'Meta for Business',
    title: 'Meta 调整广告 API 素材评分，首帧权重提升',
    dimensionTag: '投放效率',
    impactScore: 84,
    riskLevel: '中高',
    referencedIndex: '竞争活跃度 +2',
    revenueImpact: 'GMV 转化弹性变大'
  },
  {
    id: 4,
    source: 'TikTok Shop Seller Center',
    title: 'TikTok Shop 英国站收紧物流 SLA 与晚到赔付规则',
    dimensionTag: '履约成本',
    impactScore: 72,
    riskLevel: '中',
    referencedIndex: '行业增长动能 -1',
    revenueImpact: '订阅升级转化受压'
  },
  {
    id: 5,
    source: 'Stripe Docs Update',
    title: 'Stripe 上线多币种智能路由，支付成功率优化',
    dimensionTag: '支付费率',
    impactScore: 75,
    riskLevel: '低',
    referencedIndex: '收入模型稳定度 +2',
    revenueImpact: '支付收入边际改善'
  },
  {
    id: 6,
    source: 'AI Industry Watch',
    title: 'AI Agent 建站工具进入批量商家试用阶段',
    dimensionTag: '产品替代',
    impactScore: 91,
    riskLevel: '高',
    referencedIndex: 'AI Agent 威胁 +6',
    revenueImpact: '模板订阅价值下滑'
  },
  {
    id: 7,
    source: 'Google Ads Blog',
    title: 'Performance Max 新增品类信号标签，学习期缩短',
    dimensionTag: '增长效率',
    impactScore: 70,
    riskLevel: '中',
    referencedIndex: '行业增长动能 +1',
    revenueImpact: '佣金增长节奏前移'
  },
  {
    id: 8,
    source: 'CBP Notice',
    title: '美国海关提高低申报抽检频率并扩展重点类目',
    dimensionTag: '关税合规',
    impactScore: 77,
    riskLevel: '中高',
    referencedIndex: '政策风险 +3',
    revenueImpact: '跨境履约成本抬升'
  }
];

export const competitors = [
  {
    name: 'Shopify',
    weeklyMove: '推出 AI 商家经营助手测试版，覆盖客服与营销自动化',
    earningsHighlight: '商户解决方案收入同比增长，GMV 质量改善',
    productUpdate: 'Checkout 体验升级，Agent 协同任务流上线',
    aiUpdate: 'AI 建站与内容生成并入核心后台'
  },
  {
    name: 'Shopline',
    weeklyMove: '加码东南亚本地化服务商合作',
    earningsHighlight: '区域商户增长稳定，ARPU 提升缓慢',
    productUpdate: '营销自动化模板扩充，支付路由优化',
    aiUpdate: '上线基础 AI 商品文案助手'
  },
  {
    name: 'TikTok Shop',
    weeklyMove: '英国站履约规则升级并强化惩罚机制',
    earningsHighlight: '高互动类目成交提升明显',
    productUpdate: '直播电商工具链增强，跨店投放联动',
    aiUpdate: 'AI 选品推荐能力内测'
  },
  {
    name: 'Amazon',
    weeklyMove: 'FBA 入仓策略调整，优先高周转品类',
    earningsHighlight: '广告与物流服务收入继续增长',
    productUpdate: '卖家后台补货建议模型升级',
    aiUpdate: '生成式客服与运营问答能力扩大覆盖'
  },
  {
    name: 'Temu',
    weeklyMove: '欧洲本地仓覆盖范围继续扩大',
    earningsHighlight: '价格驱动增长，但补贴压力仍高',
    productUpdate: '履约时效看板升级，商家评分体系细化',
    aiUpdate: 'AI 智能定价模型投入实战'
  }
];

export const aiAssistantData = {
  samples: [
    '如果 AI Agent 建站工具成熟，对传统 SaaS 平台的威胁有多大？',
    '政策风险指数继续上升时，先优化订阅还是佣金？',
    '竞争活跃度指数高位时，增长策略如何分配资源？'
  ],
  response: {
    threatLevel: '高（81/100）',
    timeWindow: '12-18 个月进入加速替代期',
    affectedModules: ['模板订阅', '商家运营服务', '广告增值包'],
    strategy: [
      '将模板产品升级为 AI 运营工作台，强化自动化闭环价值',
      '提高生态插件与支付、广告、物流的联动粘性',
      '建立企业级数据与合规能力，形成中大型客户护城河'
    ]
  }
};

export const modelExplainers = [
  {
    title: '情报结构化标签抽取',
    text: '对新闻源进行实体识别与策略标签映射，统一到平台、政策、财务、支付、AI 能力等多维标签。'
  },
  {
    title: '多维影响评分算法',
    text: '结合事件强度、覆盖范围、时间敏感度与历史波动弹性，计算 0-100 影响评分并产出风险等级。'
  },
  {
    title: '战略指数计算逻辑',
    text: '将事件分桶后映射到增长、威胁、竞争、稳定度、政策风险五大指数，按权重形成周度趋势。'
  },
  {
    title: '收入模型映射规则',
    text: '通过订阅、佣金、支付、生态四条收入路径进行敏感度映射，输出风险预警与优先级建议。'
  }
];
