export const newsData = [
  {
    id: 1,
    title: '欧盟强化跨境数据监管，平台需补充 AI 可解释性披露',
    source: 'EU Commission Brief',
    publish_date: '2026-02-18',
    ai_summary:
      '欧盟监管草案提高对数据溯源、AI 自动决策透明度与平台责任边界的要求，商家合规运营成本将上升。',
    platform: 'Shopify',
    impact_dimension: ['政策', '支付', '生态'],
    impact_score: 92,
    risk_level: '高',
    original_url: 'https://example.com/eu-ai-compliance-1',
    full_analysis:
      '该政策将直接推高欧盟地区商家审计、日志留存与支付风控投入，短期会压缩中小商家利润空间并降低扩张速度。对 SaaS 平台而言，若缺少合规模块和风险解释能力，商户留存将受影响。',
    revenue_path: '合规成本上升 -> 商家投放收缩 -> GMV 增速放缓 -> 佣金与支付抽成增速承压',
    referenced_indexes: ['policy-risk', 'revenue-stability'],
    referenced_competitors: ['Shopify', 'Shopline']
  },
  {
    id: 2,
    title: 'Shopify 发布 AI Agent 建站与运营编排能力',
    source: 'Shopify IR',
    publish_date: '2026-02-19',
    ai_summary:
      'Shopify 将 AI Agent 纳入商家后台主流程，覆盖建站、内容生成、营销任务编排，进一步降低运营门槛。',
    platform: 'Shopify',
    impact_dimension: ['AI威胁', '订阅', '生态'],
    impact_score: 95,
    risk_level: '高',
    original_url: 'https://example.com/shopify-agent-2',
    full_analysis:
      'AI Agent 工具将模板类 SaaS 的基础能力快速商品化，平台竞争壁垒从功能数量转向模型质量、生态连接和数据资产。中期可能导致低端订阅套餐 ARPU 下滑。',
    revenue_path: 'AI Agent 普及 -> 模板能力价格压缩 -> 订阅 ARPU 下滑 -> 高阶增值服务成为主要增长项',
    referenced_indexes: ['agent-threat', 'competition', 'revenue-stability'],
    referenced_competitors: ['Shopify', 'Temu']
  },
  {
    id: 3,
    title: 'Meta Ads API 更新首帧权重，广告素材策略重排',
    source: 'Meta for Business',
    publish_date: '2026-02-17',
    ai_summary:
      'Meta 对创意评分机制做结构调整，广告团队需要重做前 2 秒叙事和素材批量测试策略。',
    platform: 'TikTok Shop',
    impact_dimension: ['佣金', '生态'],
    impact_score: 84,
    risk_level: '中',
    original_url: 'https://example.com/meta-api-3',
    full_analysis:
      '投放效率波动会传导到商家 ROI，ROI 不稳会直接影响 GMV 与抽佣收入。平台需快速提供 AI 创意优化与预算建议模块。',
    revenue_path: '投放结构变化 -> ROI 波动 -> GMV 变化 -> 佣金收入波动',
    referenced_indexes: ['competition', 'growth'],
    referenced_competitors: ['TikTok Shop']
  },
  {
    id: 4,
    title: 'Stripe 多币种智能路由上线，跨境支付成功率提升',
    source: 'Stripe Docs Update',
    publish_date: '2026-02-16',
    ai_summary:
      '智能路由降低拒付与汇损，跨境平台可在低毛利市场获得更稳定的支付利润率。',
    platform: 'Amazon',
    impact_dimension: ['支付', '佣金'],
    impact_score: 76,
    risk_level: '低',
    original_url: 'https://example.com/stripe-routing-4',
    full_analysis:
      '支付成功率每提升 1-2%，会直接改善 GMV 完成率与支付费收入，对高频低客单市场效果更明显。',
    revenue_path: '支付通过率提升 -> 订单完成率提升 -> GMV 增长 -> 支付抽成收益改善',
    referenced_indexes: ['revenue-stability', 'growth'],
    referenced_competitors: ['Amazon', 'Shopline']
  },
  {
    id: 5,
    title: 'TikTok Shop 英国站履约 SLA 收紧，违规赔付规则升级',
    source: 'TikTok Shop Seller Center',
    publish_date: '2026-02-18',
    ai_summary:
      '履约门槛提高将抬升跨境商家履约成本，短期对中小卖家在英区扩张形成压力。',
    platform: 'TikTok Shop',
    impact_dimension: ['政策', '佣金'],
    impact_score: 81,
    risk_level: '中',
    original_url: 'https://example.com/tiktok-sla-5',
    full_analysis:
      '时效考核趋严将推高海外仓和售后投入，平台若未同步提供运营工具会出现商家流失与活动参与率下降。',
    revenue_path: '履约成本上升 -> 商家利润压缩 -> 投放下降 -> GMV 增速放缓 -> 佣金压力增加',
    referenced_indexes: ['policy-risk', 'growth'],
    referenced_competitors: ['TikTok Shop', 'Temu']
  },
  {
    id: 6,
    title: 'Amazon FBA 入仓策略调整，库存周转成核心评分因子',
    source: 'Marketplace Pulse',
    publish_date: '2026-02-14',
    ai_summary:
      '新规则将促使商家缩短库存周期并提高补货精度，利于平台运营效率但增加卖家预测压力。',
    platform: 'Amazon',
    impact_dimension: ['生态', '佣金'],
    impact_score: 72,
    risk_level: '中',
    original_url: 'https://example.com/amazon-fba-6',
    full_analysis:
      '中长期会筛选出供应链更强的商家，平台整体履约体验改善，但弱运营商家可能迁移至更低门槛渠道。',
    revenue_path: '库存策略重构 -> 履约效率提升 -> 用户体验提升 -> GMV 结构优化',
    referenced_indexes: ['competition', 'growth'],
    referenced_competitors: ['Amazon']
  },
  {
    id: 7,
    title: 'Google PMax 引入新品类信号，广告学习周期缩短',
    source: 'Google Ads Blog',
    publish_date: '2026-02-13',
    ai_summary:
      '更细粒度信号能更快匹配目标受众，缩短冷启动期，利好跨境新品牌投放。',
    platform: 'Shopline',
    impact_dimension: ['佣金', '生态'],
    impact_score: 69,
    risk_level: '低',
    original_url: 'https://example.com/google-pmax-7',
    full_analysis:
      '效率提升将放大高质量素材价值，SaaS 平台需提供素材洞察与归因工具，避免广告价值链被外部平台主导。',
    revenue_path: '投放效率提升 -> 新商家增长加快 -> GMV 增速改善 -> 佣金收入改善',
    referenced_indexes: ['growth', 'competition'],
    referenced_competitors: ['Shopline', 'Shopify']
  },
  {
    id: 8,
    title: '美国海关扩大低申报抽检类目，电子配件风险升高',
    source: 'CBP Notice',
    publish_date: '2026-02-12',
    ai_summary:
      '抽检频率提升导致清关延迟与罚款风险上升，跨境卖家需提升报关规范。',
    platform: 'Temu',
    impact_dimension: ['政策', '支付'],
    impact_score: 83,
    risk_level: '高',
    original_url: 'https://example.com/cbp-risk-8',
    full_analysis:
      '海关风险会传导到物流时效和资金周转，影响商家现金流和投放预算，平台需提供清关风控提示与运费方案。',
    revenue_path: '清关风险上升 -> 物流延迟与退款提升 -> 用户转化下降 -> GMV 下滑 -> 支付收益承压',
    referenced_indexes: ['policy-risk', 'revenue-stability'],
    referenced_competitors: ['Temu', 'Amazon']
  },
  {
    id: 9,
    title: 'Shopline 发布 AI 客服工作流，缩短跨时区响应时长',
    source: 'Shopline Product Update',
    publish_date: '2026-02-20',
    ai_summary:
      '自动客服流程可覆盖夜间高峰，提升响应效率并降低人力成本。',
    platform: 'Shopline',
    impact_dimension: ['AI威胁', '订阅', '生态'],
    impact_score: 78,
    risk_level: '中',
    original_url: 'https://example.com/shopline-ai-cs-9',
    full_analysis:
      'AI 客服能力正在成为商家选型关键因素，会推动 SaaS 由建站工具升级为经营操作系统。',
    revenue_path: '客服效率提升 -> 转化率提升 -> 续费率提升 -> 订阅与增值收入提升',
    referenced_indexes: ['agent-threat', 'competition'],
    referenced_competitors: ['Shopline']
  },
  {
    id: 10,
    title: 'Temu 强化欧洲本地仓合作，物流时效持续优化',
    source: 'Retail Global Watch',
    publish_date: '2026-02-15',
    ai_summary:
      '本地仓布局提升履约体验，低价策略与时效优势组合对其他平台形成压力。',
    platform: 'Temu',
    impact_dimension: ['生态', '佣金'],
    impact_score: 74,
    risk_level: '中',
    original_url: 'https://example.com/temu-eu-warehouse-10',
    full_analysis:
      '履约能力增强将持续提升用户复购，竞争将进一步转向供应链与本地化运营效率。',
    revenue_path: '本地仓优化 -> 履约提速 -> 转化率提升 -> GMV 增加 -> 佣金收益提升',
    referenced_indexes: ['competition', 'growth'],
    referenced_competitors: ['Temu']
  },
  {
    id: 11,
    title: 'PayPal 推出东南亚钱包聚合方案，结算链路缩短',
    source: 'PayPal Newsroom',
    publish_date: '2026-02-11',
    ai_summary:
      '本地钱包直连提升支付成功率和到账效率，跨境商家在东南亚市场的转化将受益。',
    platform: 'Shopify',
    impact_dimension: ['支付', '生态'],
    impact_score: 73,
    risk_level: '低',
    original_url: 'https://example.com/paypal-wallet-11',
    full_analysis:
      '支付体验改善可扩大新兴市场订单规模，平台可借机推动支付增值服务与风控产品渗透。',
    revenue_path: '本地支付成功率提升 -> 订单增长 -> 支付抽成扩大 -> 收入稳定度提升',
    referenced_indexes: ['revenue-stability', 'growth'],
    referenced_competitors: ['Shopify', 'Amazon']
  },
  {
    id: 12,
    title: '英国拟加强在线广告透明度披露，跨境素材审核收紧',
    source: 'UK Regulator Draft',
    publish_date: '2026-02-10',
    ai_summary:
      '广告披露规则趋严，品牌需要建立可追溯素材链路与投放证据体系。',
    platform: 'TikTok Shop',
    impact_dimension: ['政策', '生态'],
    impact_score: 82,
    risk_level: '高',
    original_url: 'https://example.com/uk-ads-policy-12',
    full_analysis:
      '广告规则升级将提高投放合规门槛，平台需建设审核中台和智能合规模块，降低商家进入门槛。',
    revenue_path: '合规门槛提升 -> 投放效率下降 -> 商家扩张变慢 -> 佣金收入增长受限',
    referenced_indexes: ['policy-risk', 'competition'],
    referenced_competitors: ['TikTok Shop', 'Shopify']
  }
];
