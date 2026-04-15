# Insight-Hub

AI SaaS Strategic Intelligence Engine（战略决策中枢）

一个“战略输入 -> 结论输出 -> 行动优先级”系统：
- 自动抓取外部新闻并结构化入库（`news_raw`）
- 定时生成公司级决策简报（`daily_brief`）
- 前端优先展示 `daily_brief`，缺失时回退规则版
- 新闻库支持服务端平台筛选、分页统计与详情抽屉联动
- 提供 AI 助手问答（`ai_chat_v2`：Hybrid 检索 + LLM 决策生成）、证据追溯、收入影响沙盘
- 竞争动态矩阵支持按自定义时间范围聚合并追溯平台证据
- 生成质量防护：低质量模板句拦截、截断重试、主题强制改写与行动项 KPI 防编造（避免“空泛结论”或未经验证的数字承诺覆盖有效结论）

---

## 1. 项目目标

解决两个核心问题：
1. 外部信号分散、更新快，难以快速形成“可执行结论”
2. 传统汇报偏信息罗列，缺少“结论-证据-行动”的闭环

本项目把“新闻流”转成“行动流”：
- 今日结论（headline）
- 关键驱动（drivers）
- 业务影响（impacts）
- 优先行动（P0/P1/P2）
- 可追溯证据（citations）

---

## 2. 当前功能清单

### 2.1 AI 今日战略判断
- 前端优先读取 `daily_brief`（UTC+8 当日）
- 若 `daily_brief` 不可用，自动回退到规则版（不阻断页面）
- 展示结构：结论、驱动、SaaS影响拆解、优先行动、证据
- 生成侧质量控制：
  - 模板句拦截（命中新闻充足时禁止写入“外部冲击尚不集中/外部信号分散”等泛化句）
  - 多次重试（默认最多 3 次，切换写作风格后重生）
  - 仍命中模板时，按当日主题强制改写 headline/one_liner
  - 同日质量守卫（低质量结果不会覆盖明显更高质量结果）
  - 支持按目标日期重生与强制覆盖（用于补跑历史简报）
  - 输入新闻去重与 `max_impact_score` 守卫，减少重复新闻干扰和低质量覆盖
  - LLM 输出被截断时自动提高 token budget 后重试，避免半截 JSON 或兜底结论写入
  - 禁止在 `actions` / `success_metric` 中编造线索数、转化率、增长率等具体 KPI；只有新闻事实数字可进入驱动或影响解释

### 2.1.1 线上内容审计状态（2026-04-15）
- 已对线上 `daily_brief` 全量 53 条记录做质量审计
- 已重生成明显兜底、低质或与高影响新闻不匹配的历史简报
- 已批量清理历史行动项中的模型自拟 KPI，统一改为“证据清单 / 演示链路 / 客户反馈 / 话术沉淀”等可解释交付物
- 2026-04-15 路演版本已人工校正并保持线上生效：
  - headline：`Amazon卖家成本承压，独立站需抓住迁移窗口`
  - 核心口径：平台成本与现金流压力上升，独立站 SaaS 应突出卖家迁移、成本透明和多渠道经营

### 2.2 新闻管道（news pipeline）
- RSS/网页抓取 -> LLM结构化摘要 -> Supabase 写入 `news_raw`
- `daily_brief` 依赖 `news_raw`，同一任务内串行执行（先 main 再 daily_brief）
- 生产调度：服务器 `systemd timer` 每 6 小时触发一次（UTC+8 的 00/06/12/18 点）
- GitHub Actions 仅保留 `workflow_dispatch` 手动兜底，不承担定时任务

### 2.3 AI 助手
- 统一入口：`POST /api/ai_chat_v2`
- 所有问题（示例问题 / 快捷按钮 / 自由提问）统一走“数据库检索 + LLM 生成”，不再走前端模板回答
- 支持意图识别：`news_summary` / `brief_today` / `qa`
- 支持从自然语言自动推断时间窗口（如“近7天 / 近3个月 / 3月以来 / 本月以来”）
- 检索策略：关键词 + 扩展词 + 时间衰减 + 去重（Hybrid），按 `range_days/top_k` 控制窗口与返回量
- 输出为结构化 JSON：
  - `answer`
  - `cards`（headline/key_drivers/impacts/actions）
  - `sources`（含 `news_id/title/url/domain/published_at/score`）
  - `reasoning_view`（intent/time_range/retrieval/synthesis_steps/clusters）
- 前端以段落卡片渲染并保留可点击证据链接

### 2.4 收入影响沙盘
- 评分口径：`Final = clamp(Baseline + Delta, 0..100)`
- Baseline 来自外部态势，Delta 来自策略参数模拟
- 暴露指数用于优先级排序（P0/P1/P2/P3）
- 单条新闻影响分、四维 Baseline、沙盘 Delta、Final 分数均有独立口径，可拆解解释

### 2.5 竞争矩阵与证据溯源
- 竞争动态矩阵支持近 7 天 / 15 天 / 自定义日期范围
- 平台聚合按所选时间窗分页拉取新闻，不再受首页默认缓存数量限制
- 证据溯源抽屉按时间倒序展示新闻
- 从证据溯源进入新闻详情后，关闭详情可返回上一级证据列表
- 证据追溯与“去新闻库”共用同一批新闻 ID / 明细，避免计数与展示不一致

### 2.6 新闻库
- 新闻库按时间、影响分、风险、地区、平台等条件筛选
- 平台筛选已下沉到 API / Supabase 查询层，不再只在前端已加载批次内过滤
- `GET /api/news_raw` 支持 `platform=Amazon` 或逗号分隔多平台筛选，并可配合 `include_total=1` 返回服务端总数
- 分页加载使用请求版本号与游标锁，避免切换筛选条件后旧请求覆盖新结果
- 新闻详情按钮直接携带当前卡片对象打开详情，解决筛选/分页后的新闻不在默认缓存中导致点击无反应的问题
- Daily brief 的“今天”按钮会触发刷新 key，即使日期未变化也会重新拉取线上最新 brief

### 2.7 数据分析埋点（GA）
- 已接入 Google Analytics 4（GA4），Measurement ID 由 `VITE_GA_ID` 提供。
- SPA 手动上报 `page_view`（`send_page_view=false`），避免重复统计。
- 事件封装位于 `src/lib/analytics.ts`，未配置 `VITE_GA_ID` 时自动 no-op，不影响页面功能。
- 当前事件清单（用于“可量化运营闭环”）：
  - `ai_panel_open`：AI 助手打开入口（button/hotkey/auto）
  - `ai_example_click`：固定示例问题点击（q1/q2/q3）
  - `ai_ask_submit`：自由提问提交（仅上报 `input_len`）
  - `evidence_open`：证据抽屉打开（来源 + 引用数量）
  - `citation_click`：引用链接点击（`news_id/domain`）
  - `action_board_open`：行动板进入视图（行动条数）
  - `action_item_click`：行动项点击（priority/owner/timeframe）
  - `section_view`：核心模块曝光（overview/drivers/impacts/actions/kpi/sandbox）
- 隐私约束：不上传用户原始提问、不上传新闻正文，仅上传长度、枚举、计数等非敏感字段。

GA Realtime 验证步骤：
1. 本地或测试环境设置 `.env`：`VITE_GA_ID=<你的 GA4 Measurement ID>`。
2. 启动前端并访问页面，打开 GA4 `Reports -> Realtime`。
3. 在页面执行一次完整链路：
   - 打开 AI 助手 -> 点击示例问题 -> 提交自由问题
   - 打开“查看证据”并点击一条引用链接
   - 滚动浏览总览模块（drivers/impacts/actions/kpi）与收入沙盘
4. 在 Realtime 的 `Event count by Event name` 确认出现上述事件名。
5. 点进单个事件，核对参数是否符合预期（如 `q_id`、`input_len`、`section`、`priority`）。

---

## 3. 技术架构

### 3.1 主要模块
- 前端：React + Vite + Tailwind
- API/静态服务：Node（`server/index.mjs`）
- 数据管道：Python（`news_pipeline/*`）
- 数据存储：Supabase（`news_raw`, `daily_brief`）

### 3.2 数据流
1. `news_pipeline.main` 抓取并更新 `news_raw`
2. `news_pipeline.daily_brief` 基于当日窗口生成 `daily_brief`
3. 前端 `getDailyBrief()` 读取 `daily_brief`
4. AI 助手调用 `POST /api/ai_chat_v2`：
   - 先识别意图与时间窗口
   - 再从 `news_raw` 检索候选并排序
   - LLM 基于检索上下文生成 `answer/cards/sources/reasoning_view`

### 3.3 调度与依赖
生产环境见服务器 `insight-news-pipeline.service/.timer`：
- timer：`OnCalendar=*-*-* 00,06,12,18:00:00`（6 小时一次）
- service：同一进程串行执行
  - `python -m news_pipeline.main`
  - `python -m news_pipeline.competitor_updates`
  - `python -m news_pipeline.daily_brief`

这保证了 `daily_brief` 不会在 `news_raw` 和 `competitor_updates` 尚未完成时提前执行。
GitHub Actions 的 `.github/workflows/news-pipeline.yml` 仅用于手动补跑（`workflow_dispatch`）。

---

## 4. 仓库结构

```text
.
├── src/                         # React 前端
│   ├── components/
│   ├── pages/
│   ├── services/api.ts          # 前端数据聚合与回退逻辑
│   └── ...
├── server/
│   ├── index.mjs                # /api/ai_chat_v2 /api/ai_chat /api/news_raw /api/daily_brief
│   ├── rag_chat.mjs
│   └── news_search.mjs
├── news_pipeline/
│   ├── main.py                  # 新闻抓取主流程 -> news_raw
│   ├── daily_brief.py           # 生成并写入 daily_brief
│   ├── ai_client.py
│   ├── supabase_client.py
│   └── ...
├── scripts/
│   ├── verify_db_rag.mjs
│   └── audit_daily_brief.mjs    # 审计 daily_brief 引用是否漏掉高影响新闻
├── .github/workflows/
│   └── news-pipeline.yml        # 手动补跑（workflow_dispatch）
├── tests/
├── README_PIPELINE.md
└── README.md
```

---

## 5. 快速启动（本地）

### 5.1 前置要求
- Node.js 18+
- Python 3.11+
- 可访问 Supabase 与 LLM 网关

### 5.2 安装依赖

```bash
npm install
pip install -r requirements.txt
```

### 5.3 配置环境变量
复制 `.env.example` 为 `.env` 并填写关键值：

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LLM_API_URL=
LLM_API_KEY=
```

### 5.4 启动方式

终端 A（API 服务）：
```bash
npm run dev:api
```

终端 B（前端）：
```bash
npm run dev
```

可选：手动跑数据管道
```bash
python -m news_pipeline.main
python -m news_pipeline.daily_brief
```

---

## 6. 常用命令

```bash
npm run dev          # 前端开发
npm run dev:api      # Node API服务
npm run build        # 前端构建
npm run test         # Node tests
npm run verify:db-rag
node scripts/audit_daily_brief.mjs 30
python -m news_pipeline.main
python -m news_pipeline.daily_brief
```

---

## 7. API 端点（Node 服务）

- `GET /health`：健康检查
- `GET /api/news_raw`：代理读取 news_raw
- `GET /api/news_raw?platform=Amazon&impact_gt=20&include_total=1`：按平台与影响分筛选新闻并返回服务端总数
- `GET /api/daily_brief`：代理读取 latest daily_brief
- `POST /api/ai_chat_v2`：AI 助手统一问答入口（结构化 JSON，推荐）
- `POST /api/ai_chat`：历史兼容接口（SSE 流式）

`/api/ai_chat_v2` 请求示例：
```json
{
  "query": "帮我总结近3天新闻",
  "mode": "auto",
  "range_days": 3,
  "top_k": 12,
  "timezone": "+08:00",
  "debug": true
}
```

`/api/ai_chat_v2` 响应结构（摘要）：
```json
{
  "answer": "...",
  "cards": {
    "headline": "...",
    "key_drivers": ["..."],
    "impacts": ["..."],
    "actions": [
      { "priority": "P0", "title": "...", "why": "...", "owner_suggest": "...", "timeframe": "7d" }
    ]
  },
  "sources": [
    { "news_id": "...", "title": "...", "url": "...", "domain": "...", "published_at": "...", "score": 0.83 }
  ],
  "reasoning_view": {
    "intent": "news_summary",
    "time_range": "3d (+08:00)",
    "retrieval": { "total_candidates": 0, "returned": 0, "strategy": "hybrid" },
    "synthesis_steps": ["识别问题类型", "检索时间窗口内容", "主题聚类", "生成决策结构"],
    "clusters": ["..."]
  }
}
```

---

## 8. 关键配置项

### 8.1 前端（Vite）
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_USE_SUPABASE`
- `VITE_SUPABASE_NEWS_LIMIT`
- `VITE_GA_ID`（GA4 Measurement ID）
- `VITE_AI_API_BASE`（前后端分域部署时必填）

### 8.2 Node 服务
- `PORT`
- `STATIC_BASE`
- `CORS_ALLOW_ORIGINS`
- `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### 8.3 Python pipeline
- `ENABLE_SUMMARY`
- `MAX_ENTRIES_PER_FEED`
- `GOOGLE_WINDOW_DAYS`
- `DAILY_BRIEF_MAX_TOKENS`
- `DAILY_BRIEF_RETRY_TOKEN_STEP`（默认 `1000`，LLM 截断后逐次增加输出 token）
- `DAILY_BRIEF_PROMPT_VERSION`
- `DAILY_BRIEF_MAX_NEWS`
- `DAILY_BRIEF_HIGH_IMPACT_THRESHOLD`（默认 `60`，统计口径：`impact_score >= 60`）
- `DAILY_BRIEF_RETRY_MAX`（默认 `3`，生成重试次数）
- `DAILY_BRIEF_RETRY_TRIGGER_USED`（默认 `3`，命中新闻达到阈值时启用反模板强拦截）
- `DAILY_BRIEF_QUALITY_GUARD_DELTA`（默认 `5`，同日覆盖质量差阈值）

---

## 9. 数据口径说明

### 9.1 daily_brief 时间窗口
- 按 UTC+8 切日
- 查询窗口：`[当天 00:00+8, 次日 00:00+8)`

### 9.1.1 daily_brief 质量护栏
- 生成侧会优先使用高业务相关性、高影响分和高风险新闻，过滤明显无关噪声
- 当高影响新闻存在明确主体（如 Amazon、Shopify、TikTok Shop、Temu）时，结论至少在 headline 或 one_liner 中点名主体，避免只写“外部变量”
- `finish_reason=length` 时视为截断失败，不写入数据库，并在下一次重试提高 token budget
- 历史质量守卫会阻止低质量结果覆盖高质量结果；但若旧记录被识别为泛化兜底，新结果达到基本质量线即可替换
- `actions` 和 `success_metric` 只允许写可验证交付物，不允许编造具体线索数、转化率、增长率、签约数量等 KPI

### 9.2 新闻影响评分（单条新闻）

定义：
- `impact_score` 用于衡量单条新闻对跨境电商 SaaS 业务的潜在影响强度，范围 `0~100`

来源：
- 由 LLM 在新闻结构化摘要阶段输出
- 系统再做规则化约束和兜底

当前规则：
- 最终分数强制限制在 `0~100`
- 若模型输出缺失或非法，走默认兜底分 `25`
- 若正文过短（当前规则为 `<120` 字符），会将分数压低到最多 `30`
- 若内容不足，`tldr` 会附加“信息不足，判断置信度较低”类提示

理解建议：
- `0~30`：信息不足 / 低置信度 / 短讯
- `30~60`：有业务相关性，但影响有限或不确定
- `60~80`：对一个或多个业务维度存在明确影响
- `80~100`：高确定性、高传导性、可能影响战略或收入结构

### 9.3 Baseline（外部基线）

定义：
- Baseline 表示“外部环境本身”对业务的压力或机会，不考虑内部策略调节

输入来源：
- 近期新闻集合
- 新闻先被映射到若干主题集合：
  - `policyIds`：政策标签或高风险新闻
  - `aiThreatIds`：AI 标签或标题含 `agent` 的新闻
  - `competeIds`：平台竞争相关新闻
  - `paymentIds`：支付维度相关新闻
  - `revenueIds`：订阅 / 佣金相关新闻

基础中间量：
- `avgImpact = 所有新闻 impact_score 平均值`
- `highRiskRatio = 高风险新闻占比`

五个基础指数：
- 行业增长动能：`growth = clamp(avgImpact - 6, 45, 92)`
- AI Agent 威胁：`agent = clamp((aiThreatIds.length / news.length) * 200 + 55, 40, 95)`
- 竞争活跃度：`compete = clamp((competeIds.length / news.length) * 180 + 50, 45, 95)`
- 收入稳定度：`stable = clamp(75 - highRiskRatio * 30, 30, 90)`
- 政策风险：`policy = clamp((policyIds.length / news.length) * 220 + 45, 35, 95)`

四个业务维度 Baseline：
- 订阅：`(growth + stable) / 2`
- 佣金：`(growth + compete) / 2`
- 支付：`(policy + stable) / 2`
- 生态：`(agent + compete) / 2`

整体 Baseline：
- `overall = clamp(avgImpact, 55, 95)`

解释：
- 单条新闻越“重”，整体外部基线越高
- 某类新闻越密集，对应维度 Baseline 越高
- 高风险新闻越多，稳定度越低

### 9.4 Delta（内部策略模拟）

定义：
- Delta 表示你在收入影响沙盘中调整内部参数后，对四个维度造成的增减影响

输入参数：
- `arpuDelta`：订阅 ARPU 调整
- `commissionDelta`：佣金率调整
- `paymentSuccessDelta`：支付成功率调整

当前模拟公式：
- 订阅 Delta：`subscriptionDelta = arpuDelta * 20`
- 佣金 Delta：`commissionDelta = commissionDelta * 25`
- 支付 Delta：`paymentDelta = - paymentSuccessDelta * 20`
- 生态 Delta：`ecosystemDelta = (arpuDelta * 0.08 + commissionDelta * 180 + paymentSuccessDelta * 0.12) * 10`

整体 Delta：
- 四个维度 Delta 的平均值后四舍五入

解释：
- 提升 ARPU 会推高订阅维度 Delta
- 提升佣金率会推高佣金维度 Delta
- 提升支付成功率被视作风险缓释，因此支付风险分下降
- 生态维度反映多个参数联动后的综合影响

### 9.5 Final（最终分）

定义：
- Final 是最终用于风险展示、优先级排序和决策参考的分数

公式：
- `Final = clamp(Baseline + Delta, 0, 100)`

解释：
- `Baseline` 代表外部环境
- `Delta` 代表内部策略变化
- `Final` 代表两者叠加后的业务风险 / 优先级结果

### 9.6 收入影响沙盘字段解释

收入结构暴露矩阵中的字段：
- `外部风险 = Baseline / 100`
- `内部敏感度 = min(abs(Delta) / 100, 1)`
- `综合暴露 = Baseline * abs(Delta) / 10000`

用途：
- `综合暴露` 越高，说明该维度同时具备“外部信号强”和“内部参数敏感”两个特征
- 前端按该值排序，用于 `P0 / P1 / P2 / P3` 优先级展示

“可解释因果链”面板字段：
- `政策/新闻信号数量`：当前维度绑定的证据新闻数量
- `Baseline`：当前维度的外部基线分
- `内部敏感度`：当前维度对内部参数变化的敏感程度
- `Δ 影响`：当前维度的 Delta 分值
- `Final`：当前维度最终分数

### 9.7 证据链
- `daily_brief.citations` + `top_drivers.signals`
- 前端展示支持链接跳转，保证可追溯
- 竞争矩阵、证据溯源抽屉、新闻库过滤共用同一批 `newsIds/items`，尽量保持计数与内容一致

### 9.8 high_impact 统计口径
- `high_impact` 统计规则：`impact_score >= DAILY_BRIEF_HIGH_IMPACT_THRESHOLD`
- 当前默认阈值为 `60`（即 `>=60`）
- 说明：如果当天是 `72/72/65/55`，则 `high_impact = 3`

---

## 10. 已知行为与排查

### 10.1 为什么新闻库有新新闻，但“AI 今日战略判断”稍后才更新？
- 新闻库读的是 `news_raw`（准实时）
- 战略判断读的是 `daily_brief`（批处理快照）
- 当前生产调度每 6 小时一次，通常会有“分钟级~6小时”更新延迟
- 若需要立即看今天线上最新 brief，可以点击“今天”按钮触发重新拉取

### 10.2 为什么会出现“明明有新闻但结论太泛”？
- 这通常是 LLM 输出质量波动，不是“未命中新闻”
- 当前已加反模板保护：
  - 命中新闻充足时拦截泛化句式
  - 自动重试并切换风格
  - 截断时提高 token budget 重新生成
  - 必要时按当日主题强制改写后再写入
  - action / success_metric 禁止未经验证的数字 KPI
- 如仍异常，可手动执行 `python -m news_pipeline.daily_brief` 立即重生当天结论

### 10.3 为什么会出现平台误归类（例如提到 Shopify 但主体不是 Shopify）？
- 平台识别基于标题/来源规则，已加入 WooCommerce-迁移语义修正
- 若发现误判，优先完善 `inferPlatform` 和 `isNegatedShopifyTitle` 规则

### 10.4 为什么有时会出现英文标题？
- 上游新闻可能为英文，历史 `daily_brief` 可能保留英文
- 当前已增加中文兜底（生成侧 + 展示侧）

### 10.5 为什么 AI 助手会提示“未检索到符合条件的新闻”？
- `ai_chat_v2` 是严格基于数据库检索结果生成
- 如果给定时间窗（如 `range_days=1`）内没有命中，就会明确提示未命中并建议扩大窗口（如 7 天/30 天）
- 这属于“可追溯优先”的设计，避免无依据编造

### 10.6 为什么竞争矩阵在扩大时间范围后会出现平台新闻不全？
- 旧版本曾受默认拉取上限影响，大时间范围下可能只看到较新的一部分新闻
- 当前版本已改为按所选时间范围分页拉全量，再做平台聚合与证据抽屉展示

### 10.7 为什么新闻库按 Amazon 筛选后数量不对？
- 旧版本是在前端已加载批次内做平台过滤，所以只会显示当前缓存里的 Amazon 新闻
- 当前版本已把平台筛选传入 `/api/news_raw` 和 Supabase 查询，统计数量、主新闻区、低影响区和加载更多都使用同一筛选条件
- 可用 `/api/news_raw?platform=Amazon&impact_gt=20&include_total=1` 直接核验服务端数量

### 10.8 为什么证据溯源里点“查看详情”会感觉没反应或无法返回？
- 当前版本会保留证据抽屉并在其上层打开新闻详情
- 关闭新闻详情会回到原来的证据列表，不需要重新打开证据抽屉
- 若详情接口暂时没补全该条新闻，也不会把已打开的详情内容直接清空

---

## 11. 部署建议

### 11.1 推荐部署形态（前后端同域）
- Node 服务托管静态资源 + API
- 避免 GitHub Pages 无法承载 `/api/*` 的问题

### 11.3 生产调度（当前）
- 仅保留服务器 `systemd` 调度（不依赖 GitHub cron）
- 定时器：`insight-news-pipeline.timer`
- 服务：`insight-news-pipeline.service`
- 执行链路：`main && competitor_updates && daily_brief`（严格依赖）

可用以下命令核验：
```bash
systemctl status insight-news-pipeline.timer --no-pager
systemctl cat insight-news-pipeline.service
journalctl -u insight-news-pipeline.service -n 100 --no-pager
```

### 11.2 若前端静态托管（如 GitHub Pages）
- 必须额外部署 Node API 服务
- 构建前设置：`VITE_AI_API_BASE=https://<your-api-domain>`

---

## 12. 版本与最近更新

近期关键更新：
- 生产调度统一为服务器 `systemd` 每 6 小时（`main -> competitor_updates -> daily_brief` 串行）
- AI 助手升级为 `ai_chat_v2`（Hybrid 检索 + LLM 结构化决策生成）
- AI 助手新增自然语言时间窗推断（近 N 天 / 近 N 月 / 本月以来 / 3 月以来）
- 所有 AI 回答统一绑定 `sources`（news_id/url/domain/published_at/score）
- “查看推理结构”改为展示 `reasoning_view`（意图、时间窗、检索命中、聚类、生成步骤）
- 示例问题与快捷问题统一走同一 LLM+检索链路
- 英文标题/驱动增加中文兜底
- 平台归类规则修复（WooCommerce/Shopify 场景）
- 竞争矩阵支持自定义时间窗全量聚合，证据溯源与新闻库口径统一
- 证据溯源支持时间倒序、稳定打开详情、详情关闭后返回证据列表
- 新闻库平台筛选下沉到服务端查询，修复 Amazon 筛选只显示当前缓存批次的问题
- 新闻详情打开改为直接传递当前新闻对象，修复筛选/分页后部分卡片点击无反应的问题
- 今日 brief 按钮支持同日期强制刷新，便于生产数据刚更新后立即查看
- `daily_brief` 增加反模板拦截 + 重试 + 主题强制改写，减少空泛结论
- `daily_brief` 增加截断重试、输入新闻去重、历史目标日期补跑、`max_impact_score` 质量守卫和行动项 KPI 防编造
- 2026-04-15 已完成线上 `daily_brief` 全量 53 条审计与历史行动项口径清理
- 新增 `scripts/audit_daily_brief.mjs` 用于排查 citations 是否遗漏高影响新闻
- `high_impact` 口径更新为 `impact_score >= 60`
