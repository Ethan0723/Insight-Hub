# Insight-Hub

AI SaaS Strategic Intelligence Engine（战略决策中枢）

一个“战略输入 -> 结论输出 -> 行动优先级”系统：
- 自动抓取外部新闻并结构化入库（`news_raw`）
- 定时生成公司级决策简报（`daily_brief`）
- 前端优先展示 `daily_brief`，缺失时回退规则版
- 提供 AI 助手问答（`ai_chat_v2`：Hybrid 检索 + LLM 决策生成）、证据追溯、收入影响沙盘
- 竞争动态矩阵支持按自定义时间范围聚合并追溯平台证据
- 生成质量防护：低质量模板句拦截、重试与主题强制改写（避免“空泛结论”覆盖有效结论）

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

### 2.5 竞争矩阵与证据溯源
- 竞争动态矩阵支持近 7 天 / 15 天 / 自定义日期范围
- 平台聚合按所选时间窗分页拉取新闻，不再受首页默认缓存数量限制
- 证据溯源抽屉按时间倒序展示新闻
- 从证据溯源进入新闻详情后，关闭详情可返回上一级证据列表
- 证据追溯与“去新闻库”共用同一批新闻 ID / 明细，避免计数与展示不一致

### 2.6 数据分析埋点（GA）
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
  - `python -m news_pipeline.daily_brief`

这保证了 `daily_brief` 不会在 `news_raw` 尚未完成时提前执行。  
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

### 9.2 战略评分口径
- `Baseline = 外部态势`
- `Delta = 策略模拟`
- `Final = clamp(Baseline + Delta, 0..100)`

### 9.3 证据链
- `daily_brief.citations` + `top_drivers.signals`
- 前端展示支持链接跳转，保证可追溯

### 9.4 high_impact 统计口径
- `high_impact` 统计规则：`impact_score >= DAILY_BRIEF_HIGH_IMPACT_THRESHOLD`
- 当前默认阈值为 `60`（即 `>=60`）
- 说明：如果当天是 `72/72/65/55`，则 `high_impact = 3`

---

## 10. 已知行为与排查

### 10.1 为什么新闻库有新新闻，但“AI 今日战略判断”稍后才更新？
- 新闻库读的是 `news_raw`（准实时）
- 战略判断读的是 `daily_brief`（批处理快照）
- 当前生产调度每 6 小时一次，通常会有“分钟级~6小时”更新延迟

### 10.5 为什么会出现“明明有新闻但结论太泛”？
- 这通常是 LLM 输出质量波动，不是“未命中新闻”
- 当前已加反模板保护：
  - 命中新闻充足时拦截泛化句式
  - 自动重试并切换风格
  - 必要时按当日主题强制改写后再写入
- 如仍异常，可手动执行 `python -m news_pipeline.daily_brief` 立即重生当天结论

### 10.2 为什么会出现平台误归类（例如提到 Shopify 但主体不是 Shopify）？
- 平台识别基于标题/来源规则，已加入 WooCommerce-迁移语义修正
- 若发现误判，优先完善 `inferPlatform` 和 `isNegatedShopifyTitle` 规则

### 10.3 为什么有时会出现英文标题？
- 上游新闻可能为英文，历史 `daily_brief` 可能保留英文
- 当前已增加中文兜底（生成侧 + 展示侧）

### 10.4 为什么 AI 助手会提示“未检索到符合条件的新闻”？
- `ai_chat_v2` 是严格基于数据库检索结果生成
- 如果给定时间窗（如 `range_days=1`）内没有命中，就会明确提示未命中并建议扩大窗口（如 7 天/30 天）
- 这属于“可追溯优先”的设计，避免无依据编造

### 10.5 为什么竞争矩阵在扩大时间范围后会出现平台新闻不全？
- 旧版本曾受默认拉取上限影响，大时间范围下可能只看到较新的一部分新闻
- 当前版本已改为按所选时间范围分页拉全量，再做平台聚合与证据抽屉展示

### 10.6 为什么证据溯源里点“查看详情”会感觉没反应或无法返回？
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
- 执行链路：`main && daily_brief`（严格依赖）

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
- 生产调度统一为服务器 `systemd` 每 6 小时（`main -> daily_brief` 串行）
- AI 助手升级为 `ai_chat_v2`（Hybrid 检索 + LLM 结构化决策生成）
- AI 助手新增自然语言时间窗推断（近 N 天 / 近 N 月 / 本月以来 / 3 月以来）
- 所有 AI 回答统一绑定 `sources`（news_id/url/domain/published_at/score）
- “查看推理结构”改为展示 `reasoning_view`（意图、时间窗、检索命中、聚类、生成步骤）
- 示例问题与快捷问题统一走同一 LLM+检索链路
- 英文标题/驱动增加中文兜底
- 平台归类规则修复（WooCommerce/Shopify 场景）
- 竞争矩阵支持自定义时间窗全量聚合，证据溯源与新闻库口径统一
- 证据溯源支持时间倒序、稳定打开详情、详情关闭后返回证据列表
- `daily_brief` 增加反模板拦截 + 重试 + 主题强制改写，减少空泛结论
- `daily_brief` 增加输入新闻去重、历史目标日期补跑、`max_impact_score` 质量守卫
- 新增 `scripts/audit_daily_brief.mjs` 用于排查 citations 是否遗漏高影响新闻
- `high_impact` 口径更新为 `impact_score >= 60`
