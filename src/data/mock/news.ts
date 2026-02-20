import { NewsItem } from '../../types/domain';

export const mockNews: NewsItem[] = [
  {
    id: 101,
    title: 'Shopify 上线 AI Agent 商家工作流编排能力',
    source: 'Shopify IR',
    publishDate: '2026-02-20',
    platform: 'Shopify',
    region: 'Global',
    moduleTags: ['平台', 'AI'],
    riskLevel: '高',
    impactScore: 95,
    impactDimensions: ['订阅', '生态', '佣金'],
    aiTldr: 'AI Agent 将建站与运营能力商品化，模板型 SaaS 订阅溢价受压。',
    summary: 'Shopify 将 AI Agent 深度并入后台主流程，覆盖建站、营销和客服协同。',
    entities: ['Shopify', 'AI Agent', 'GMV'],
    originalUrl: 'https://example.com/news/101',
    why: {
      subscription: '低端模板价值下降，高阶能力将成为订阅核心。',
      commission: '运营效率提升会加速 GMV 扩大，佣金弹性增强。',
      ecosystem: '生态插件与工作流编排绑定更深，平台粘性提升。'
    },
    actions: [
      { priority: 'P0', owner: '产品', text: '优先建设 AI 运营工作台，提升高阶订阅价值。' },
      { priority: 'P1', owner: '运营', text: '围绕 Agent 场景重构商家成功体系。' },
      { priority: 'P2', owner: '市场', text: '更新价值叙事，强调自动化 ROI。' }
    ]
  },
  {
    id: 102,
    title: '欧盟拟强化 AI 决策透明度与跨境数据披露',
    source: 'EU Commission Brief',
    publishDate: '2026-02-19',
    platform: 'Shopline',
    region: 'EU',
    moduleTags: ['政策', '宏观'],
    riskLevel: '高',
    impactScore: 91,
    impactDimensions: ['支付', '生态'],
    aiTldr: '欧盟新规抬升审计与合规成本，跨境商家利润率与扩张节奏承压。',
    summary: '监管草案要求平台提升 AI 决策可解释性和数据处理透明度。',
    entities: ['EU', 'Compliance', 'Data Governance'],
    originalUrl: 'https://example.com/news/102',
    why: {
      payment: '额外合规验证流程可能降低支付转化效率。',
      ecosystem: '合规中台能力将成为平台选型关键。'
    },
    actions: [
      { priority: 'P0', owner: '合规', text: '建立欧盟政策映射清单与审计证据模板。' },
      { priority: 'P1', owner: '支付', text: '评估支付风控策略在 EU 的误杀与通过率。' },
      { priority: 'P2', owner: '产品', text: '预埋合规模块配置化能力。' }
    ]
  },
  {
    id: 103,
    title: 'Meta Ads API 更新首帧权重，创意冷启动规则变化',
    source: 'Meta for Business',
    publishDate: '2026-02-18',
    platform: 'TikTok Shop',
    region: 'Global',
    moduleTags: ['广告', '平台'],
    riskLevel: '中',
    impactScore: 84,
    impactDimensions: ['佣金', '生态'],
    aiTldr: '创意机制改版导致 ROI 波动，短期将放大 GMV 与佣金不确定性。',
    summary: '广告平台提高素材首帧质量权重，创意策略需重新分配预算。',
    entities: ['Meta', 'ROI', 'Creative'],
    originalUrl: 'https://example.com/news/103',
    why: {
      commission: '投放效率波动将直接影响 GMV 与佣金。',
      ecosystem: '需要更强投放工具链与归因能力。'
    },
    actions: [
      { priority: 'P0', owner: '运营', text: '建立创意实验库，缩短学习周期。' },
      { priority: 'P1', owner: '市场', text: '提升多素材并行测试比例。' }
    ]
  },
  {
    id: 104,
    title: 'Stripe 智能路由覆盖多币种，拒付率下降',
    source: 'Stripe Docs',
    publishDate: '2026-02-18',
    platform: 'Amazon',
    region: 'Global',
    moduleTags: ['支付'],
    riskLevel: '低',
    impactScore: 73,
    impactDimensions: ['支付', '佣金'],
    aiTldr: '支付成功率提升可直接改善订单完成与支付抽成表现。',
    summary: 'Stripe 扩大智能收单路由覆盖，支持区域化通道策略。',
    entities: ['Stripe', 'Authorization Rate'],
    originalUrl: 'https://example.com/news/104',
    why: {
      payment: '通过率改善带来稳定费率收益。',
      commission: '订单完成率提升可带动抽佣基数增长。'
    },
    actions: [{ priority: 'P1', owner: '支付', text: '同步评估高拒付市场路由策略。' }]
  },
  {
    id: 105,
    title: 'TikTok Shop 英国站升级履约 SLA 与赔付规则',
    source: 'TikTok Seller Center',
    publishDate: '2026-02-17',
    platform: 'TikTok Shop',
    region: 'UK',
    moduleTags: ['物流', '政策'],
    riskLevel: '中',
    impactScore: 80,
    impactDimensions: ['佣金', '生态'],
    aiTldr: '履约门槛上调将压缩商家利润，短期影响投放和 GMV 增速。',
    summary: '新的履约 KPI 和赔付机制提高时效与签收要求。',
    entities: ['TikTok Shop', 'SLA'],
    originalUrl: 'https://example.com/news/105',
    why: {
      commission: '利润承压会降低投放，佣金增速受影响。',
      ecosystem: '海外仓和服务商能力变成核心竞争点。'
    },
    actions: [{ priority: 'P1', owner: '运营', text: '按类目重估履约方案与活动策略。' }]
  },
  {
    id: 106,
    title: 'Amazon FBA 入仓规则调整，库存周转权重提高',
    source: 'Marketplace Pulse',
    publishDate: '2026-02-16',
    platform: 'Amazon',
    region: 'US',
    moduleTags: ['平台', '物流'],
    riskLevel: '中',
    impactScore: 76,
    impactDimensions: ['生态', '佣金'],
    aiTldr: '库存效率要求提高，弱供应链商家可能失去流量权益。',
    summary: '新机制根据周转与履约表现分配入仓优先级。',
    entities: ['Amazon', 'FBA', 'Inventory'],
    originalUrl: 'https://example.com/news/106',
    why: {
      ecosystem: '将加速供应链能力分层。',
      commission: '流量向高效率商家集中，佣金结构变化。'
    },
    actions: [{ priority: 'P2', owner: '产品', text: '补充库存预测与补货策略工具。' }]
  },
  {
    id: 107,
    title: 'Temu 扩展欧洲本地仓网络，交付体验提速',
    source: 'Retail Watch',
    publishDate: '2026-02-15',
    platform: 'Temu',
    region: 'EU',
    moduleTags: ['物流', '平台'],
    riskLevel: '中',
    impactScore: 74,
    impactDimensions: ['生态', '佣金'],
    aiTldr: '本地仓提速将强化价格+时效双重竞争，挤压同类平台空间。',
    summary: 'Temu 在欧洲扩大本地仓合作和配送能力。',
    entities: ['Temu', 'EU Fulfillment'],
    originalUrl: 'https://example.com/news/107',
    why: {
      ecosystem: '履约体验提升会增强复购。',
      commission: '成交效率提升会扩大量化佣金基数。'
    },
    actions: [{ priority: 'P1', owner: '市场', text: '加强高时效品类的差异化价值沟通。' }]
  },
  {
    id: 108,
    title: '美国海关扩大低申报抽检范围至电子配件',
    source: 'CBP Notice',
    publishDate: '2026-02-14',
    platform: 'Temu',
    region: 'US',
    moduleTags: ['政策', '物流'],
    riskLevel: '高',
    impactScore: 86,
    impactDimensions: ['支付', '佣金'],
    aiTldr: '清关不确定性提高将拖累履约与退款表现，现金流和利润承压。',
    summary: '低申报与归类异常的抽检频次显著提升。',
    entities: ['CBP', 'Tariff'],
    originalUrl: 'https://example.com/news/108',
    why: {
      payment: '退款/拒付风险提升会抬高支付成本。',
      commission: '交付延迟影响转化与佣金。'
    },
    actions: [{ priority: 'P0', owner: '合规', text: '更新报关规则库并增加异常预警。' }]
  },
  {
    id: 109,
    title: 'Shopline 推出 AI 客服自动化工作流',
    source: 'Shopline Update',
    publishDate: '2026-02-20',
    platform: 'Shopline',
    region: 'SEA',
    moduleTags: ['AI', '平台'],
    riskLevel: '中',
    impactScore: 79,
    impactDimensions: ['订阅', '生态'],
    aiTldr: 'AI 客服可改善夜间转化与留存，运营效率成为订阅续费关键。',
    summary: '新功能支持知识库驱动的客服自动回复与工单分流。',
    entities: ['Shopline', 'AI客服'],
    originalUrl: 'https://example.com/news/109',
    why: {
      subscription: '高阶自动化能力将提升续费意愿。',
      ecosystem: '知识库与插件生态会增强粘性。'
    },
    actions: [{ priority: 'P1', owner: '产品', text: '对标 AI 客服能力并补齐知识库治理。' }]
  },
  {
    id: 110,
    title: 'PayPal 本地钱包聚合扩展东南亚通道',
    source: 'PayPal Newsroom',
    publishDate: '2026-02-13',
    platform: 'Shopify',
    region: 'SEA',
    moduleTags: ['支付'],
    riskLevel: '低',
    impactScore: 71,
    impactDimensions: ['支付', '生态'],
    aiTldr: '本地支付体验改善有助于提升转化并降低跨境收款摩擦。',
    summary: '新增本地钱包直连后，结算链路进一步缩短。',
    entities: ['PayPal', 'SEA'],
    originalUrl: 'https://example.com/news/110',
    why: {
      payment: '成功率提升将降低支付流失。',
      ecosystem: '本地支付接入提升市场扩张效率。'
    },
    actions: [{ priority: 'P2', owner: '支付', text: '评估钱包聚合在重点市场的收益。' }]
  },
  {
    id: 111,
    title: 'Google PMax 新增品类信号，学习期缩短',
    source: 'Google Ads Blog',
    publishDate: '2026-02-12',
    platform: 'Shoplazza',
    region: 'Global',
    moduleTags: ['广告', 'AI'],
    riskLevel: '低',
    impactScore: 68,
    impactDimensions: ['佣金', '生态'],
    aiTldr: '更快的投放学习将提升新商家增长效率，但也提高素材质量门槛。',
    summary: 'PMax 提供更细颗粒度的品类反馈信号。',
    entities: ['Google Ads', 'PMax'],
    originalUrl: 'https://example.com/news/111',
    why: {
      commission: '增长提速会增强抽佣增长节奏。',
      ecosystem: '归因与素材工具重要性上升。'
    },
    actions: [{ priority: 'P2', owner: '市场', text: '扩展广告素材评估指标看板。' }]
  },
  {
    id: 112,
    title: '英国在线广告透明度指引进入征询阶段',
    source: 'UK Regulator Draft',
    publishDate: '2026-02-11',
    platform: 'TikTok Shop',
    region: 'UK',
    moduleTags: ['政策', '广告'],
    riskLevel: '高',
    impactScore: 83,
    impactDimensions: ['生态', '佣金'],
    aiTldr: '广告披露规则趋严，素材审核与证据链建设将成为平台基础能力。',
    summary: '监管要求提升素材来源、赞助与受众定向披露透明度。',
    entities: ['UK', 'Ads Compliance'],
    originalUrl: 'https://example.com/news/112',
    why: {
      ecosystem: '审核系统复杂度上升，能力不足平台风险增大。',
      commission: '投放受限可能抑制 GMV 与佣金表现。'
    },
    actions: [{ priority: 'P0', owner: '合规', text: '建设广告披露校验规则与审计台账。' }]
  }
];
