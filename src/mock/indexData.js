export const indexData = {
  strategicBrief:
    'Shopify AI 能力持续增强，AI Agent 建站工具对传统 SaaS 模板价值形成中期威胁。欧盟合规政策强化可能推高商家运营成本，从而影响 GMV 增速与佣金收入。建议强化 AI 运营能力与生态整合。',
  strategicBriefNewsIds: [1, 2, 8, 12],
  strategicIndexes: [
    {
      id: 'growth',
      name: '行业增长动能指数',
      value: 73,
      delta: '+2.4',
      description: '平台流量保持增长，但区域分化加剧。',
      citedNewsIds: [3, 4, 6, 7, 10, 11]
    },
    {
      id: 'agent-threat',
      name: 'AI Agent 威胁指数',
      value: 81,
      delta: '+6.2',
      description: '低代码建站与自动运营能力正在蚕食模板溢价。',
      citedNewsIds: [2, 9]
    },
    {
      id: 'competition',
      name: '竞争活跃度指数',
      value: 76,
      delta: '+3.1',
      description: '头部平台连续更新广告、物流与 AI 工具。',
      citedNewsIds: [2, 3, 6, 7, 10, 12]
    },
    {
      id: 'revenue-stability',
      name: '收入模型稳定度',
      value: 58,
      delta: '-4.7',
      description: '佣金与支付收入对政策和投放波动更敏感。',
      citedNewsIds: [1, 2, 4, 8, 11]
    },
    {
      id: 'policy-risk',
      name: '政策风险指数',
      value: 69,
      delta: '+5.3',
      description: '欧盟与英国披露要求升级，合规成本上行。',
      citedNewsIds: [1, 5, 8, 12]
    }
  ],
  reasoningEngine: {
    chain: [
      { id: 'node-1', text: 'Meta API 更新', citedNewsIds: [3, 7] },
      { id: 'node-2', text: '广告投放结构变化', citedNewsIds: [3, 7, 12] },
      { id: 'node-3', text: '商家 ROI 波动', citedNewsIds: [3, 5, 12] },
      { id: 'node-4', text: 'GMV 增速变化', citedNewsIds: [2, 3, 5, 10] },
      { id: 'node-5', text: 'SaaS 佣金收入影响', citedNewsIds: [2, 3, 5, 8] }
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
  },
  competitors: [
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
  ],
  aiInterpretation:
    'Shopify 强化 AI 商家运营工具，意味着 SaaS 平台竞争将转向 AI 自动化能力。未来 2-3 个季度，平台差异化将从模板功能转向 AI 协同效率与生态整合速度。',
  aiAssistant: {
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
  },
  modelExplainers: [
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
  ]
};
