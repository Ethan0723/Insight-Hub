import { DailyInsight, MatrixRow } from '../../types/domain';

export const mockDailyInsight: DailyInsight = {
  brief:
    'AI Agent 建站与运营工具正在重塑 SaaS 价值链。政策与广告规则升级将抬高合规与获客成本，收入结构短期波动上升。建议优先布局 AI 工作流与合规能力产品化。',
  indexes: [
    {
      id: 'growth',
      name: '行业增长动能指数',
      value: 73,
      delta: '+2.4',
      description: '头部平台增长仍在持续，但区域差异加剧。',
      evidence: { id: 'ev-growth', title: '行业增长动能引用', newsIds: [103, 104, 106, 107, 110, 111] }
    },
    {
      id: 'agent',
      name: 'AI Agent 威胁指数',
      value: 81,
      delta: '+6.2',
      description: '自动化建站与运营能力正在蚕食传统模板价值。',
      evidence: { id: 'ev-agent', title: 'AI Agent 威胁引用', newsIds: [101, 109] }
    },
    {
      id: 'compete',
      name: '竞争活跃度指数',
      value: 76,
      delta: '+3.1',
      description: '平台在物流、广告、AI 方向持续高频更新。',
      evidence: { id: 'ev-compete', title: '竞争活跃度引用', newsIds: [101, 103, 106, 107, 109, 111] }
    },
    {
      id: 'stable',
      name: '收入模型稳定度',
      value: 58,
      delta: '-4.7',
      description: '佣金与支付收入对政策和投放波动敏感度提升。',
      evidence: { id: 'ev-stable', title: '收入稳定度引用', newsIds: [102, 103, 104, 108, 112] }
    },
    {
      id: 'policy',
      name: '政策风险指数',
      value: 69,
      delta: '+5.3',
      description: '欧美监管升级推动跨境运营合规成本抬升。',
      evidence: { id: 'ev-policy', title: '政策风险引用', newsIds: [102, 105, 108, 112] }
    }
  ],
  reasoningNodes: [
    {
      id: 'r1',
      text: '广告 API / 政策变化',
      explain: '平台规则与监管变化首先影响投放与合规门槛。',
      trend7d: [44, 45, 46, 48, 50, 52, 55],
      evidence: { id: 'ev-r1', title: '推理节点1引用', newsIds: [102, 103, 112] }
    },
    {
      id: 'r2',
      text: '商家 ROI 波动',
      explain: '投放与履约成本变化导致商家 ROI 与预算策略调整。',
      trend7d: [46, 47, 49, 51, 53, 54, 56],
      evidence: { id: 'ev-r2', title: '推理节点2引用', newsIds: [103, 105, 108, 112] }
    },
    {
      id: 'r3',
      text: 'GMV 增速变化',
      explain: 'ROI 波动与履约效率共同决定成交增速和结构。',
      trend7d: [53, 52, 53, 54, 56, 57, 58],
      evidence: { id: 'ev-r3', title: '推理节点3引用', newsIds: [101, 103, 105, 107] }
    },
    {
      id: 'r4',
      text: 'SaaS 收入结构影响',
      explain: '最终传导至订阅续费、佣金增速和支付成本。',
      trend7d: [49, 50, 50, 52, 53, 55, 57],
      evidence: { id: 'ev-r4', title: '推理节点4引用', newsIds: [101, 102, 104, 108] }
    }
  ],
  impactScore: 84,
  dimensions: [
    { name: '订阅', score: 62, evidence: { id: 'ev-dim-sub', title: '订阅影响引用', newsIds: [101, 109] } },
    { name: '佣金', score: 87, evidence: { id: 'ev-dim-com', title: '佣金影响引用', newsIds: [103, 105, 107, 112] } },
    { name: '支付', score: 74, evidence: { id: 'ev-dim-pay', title: '支付影响引用', newsIds: [102, 104, 108, 110] } },
    { name: '生态', score: 79, evidence: { id: 'ev-dim-eco', title: '生态影响引用', newsIds: [101, 106, 107, 109, 112] } }
  ],
  priorities: [
    'P0：将 AI 运营能力产品化并绑定高阶套餐',
    'P1：建设政策与广告规则变化的自动预警层',
    'P1：以支付成功率和拒付率为核心建立利润护栏',
    'P2：按区域重构物流与投放协同策略'
  ],
  updatedAt: '2026-02-20 14:30'
};

export const mockMatrix: MatrixRow[] = [
  {
    name: 'Shopify',
    weeklyMove: 'AI Agent 工作流接入商家后台核心流程',
    earningsHighlight: '商户解决方案增长继续领先',
    productUpdate: 'Checkout 与自动化营销协同升级',
    aiUpdate: 'Agent 编排 + 内容生成融合',
    evidence: { id: 'ev-m-shopify', title: 'Shopify 竞争引用', newsIds: [101, 110] }
  },
  {
    name: 'Shopline',
    weeklyMove: '强化 SEA 服务商和本地化支付合作',
    earningsHighlight: '区域新增商家增长稳定',
    productUpdate: 'AI 客服工作流上线',
    aiUpdate: '知识库驱动自动回复增强',
    evidence: { id: 'ev-m-shopline', title: 'Shopline 竞争引用', newsIds: [102, 109] }
  },
  {
    name: 'Shoplazza',
    weeklyMove: '聚焦中小商家投放效率工具',
    earningsHighlight: '营销 SaaS 收入占比提升',
    productUpdate: '广告归因看板优化',
    aiUpdate: 'PMax 适配能力增强',
    evidence: { id: 'ev-m-shoplazza', title: 'Shoplazza 竞争引用', newsIds: [111] }
  },
  {
    name: 'Amazon',
    weeklyMove: 'FBA 入仓与库存权重策略更新',
    earningsHighlight: '物流服务收入延续增长',
    productUpdate: '补货建议模型优化',
    aiUpdate: '运营问答智能化覆盖扩大',
    evidence: { id: 'ev-m-amz', title: 'Amazon 竞争引用', newsIds: [104, 106] }
  },
  {
    name: 'TikTok Shop',
    weeklyMove: '英国站履约规则收紧',
    earningsHighlight: '短视频成交仍然强势',
    productUpdate: '跨店投放联动升级',
    aiUpdate: '选品推荐模型扩容',
    evidence: { id: 'ev-m-tiktok', title: 'TikTok 竞争引用', newsIds: [103, 105, 112] }
  },
  {
    name: 'Temu',
    weeklyMove: '欧洲本地仓覆盖继续扩大',
    earningsHighlight: '价格驱动增长但合规压力上升',
    productUpdate: '履约时效看板升级',
    aiUpdate: '智能定价策略持续迭代',
    evidence: { id: 'ev-m-temu', title: 'Temu 竞争引用', newsIds: [107, 108] }
  }
];

export const mockModelExplainers = [
  { title: '情报结构化标签抽取', text: '将原始新闻映射为平台、区域、风险、收入维度与证据权重。' },
  { title: '多维影响评分算法', text: '结合事件强度、覆盖范围、时效性与历史弹性得到影响评分。' },
  { title: '战略指数计算逻辑', text: '按主题分桶并依据证据权重聚合为五大战略指数。' },
  { title: '收入模型映射规则', text: '将事件映射到订阅/佣金/支付/生态四条收入路径并给出动作优先级。' }
];

export const mockAssistant = {
  samples: [
    '如果 AI Agent 建站工具成熟，对传统 SaaS 平台威胁有多大？',
    '政策风险指数继续上升时，先优化订阅还是佣金？',
    '竞争活跃度高位时，增长预算如何分配？'
  ],
  response: {
    threatLevel: '高（81/100）',
    timeWindow: '12-18 个月进入替代加速期',
    affectedModules: ['模板订阅', '商家运营服务', '广告增值包'],
    strategy: [
      '将模板产品升级为 AI 运营工作台',
      '提升支付/广告/物流生态耦合深度',
      '建立面向中大型客户的数据合规壁垒'
    ]
  }
};
