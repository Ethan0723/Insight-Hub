# Insight-Hub

AI SaaS Strategic Intelligence Engine（战略决策中枢）

一个“战略输入 -> 结论输出 -> 行动优先级”系统：
- 自动抓取外部新闻并结构化入库（`news_raw`）
- 定时生成公司级决策简报（`daily_brief`）
- 前端优先展示 `daily_brief`，缺失时回退规则版
- 提供 AI 助手问答、证据追溯、收入影响沙盘

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

### 2.2 新闻管道（news pipeline）
- RSS/网页抓取 -> LLM结构化摘要 -> Supabase 写入 `news_raw`
- `daily_brief` 依赖 `news_raw`，同一任务内串行执行（先 main 再 daily_brief）
- 生产调度：服务器 `systemd timer` 每 6 小时触发一次（UTC+8 的 00/06/12/18 点）
- GitHub Actions 仅保留 `workflow_dispatch` 手动兜底，不承担定时任务

### 2.3 AI 助手
- 示例问题：基于最新一条 `daily_brief` 生成三段式回答
- 自由问答：走 `/api/ai_chat`（DB-RAG）
- 新闻总结问答：取近7天新闻（默认上限12条）生成摘要
- 输出做纯文本结构化渲染，支持可点击证据链接

### 2.4 收入影响沙盘
- 评分口径：`Final = clamp(Baseline + Delta, 0..100)`
- Baseline 来自外部态势，Delta 来自策略参数模拟
- 暴露指数用于优先级排序（P0/P1/P2/P3）

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
4. 无数据时回退规则引擎（`src/services/api.ts`）

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
│   ├── index.mjs                # /api/ai_chat /api/news_raw /api/daily_brief
│   ├── rag_chat.mjs
│   └── news_search.mjs
├── news_pipeline/
│   ├── main.py                  # 新闻抓取主流程 -> news_raw
│   ├── daily_brief.py           # 生成并写入 daily_brief
│   ├── ai_client.py
│   ├── supabase_client.py
│   └── ...
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
python -m news_pipeline.main
python -m news_pipeline.daily_brief
```

---

## 7. API 端点（Node 服务）

- `GET /health`：健康检查
- `GET /api/news_raw`：代理读取 news_raw
- `GET /api/daily_brief`：代理读取 latest daily_brief
- `POST /api/ai_chat`：AI 助手问答/新闻总结（SSE流式）

---

## 8. 关键配置项

### 8.1 前端（Vite）
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_USE_SUPABASE`
- `VITE_SUPABASE_NEWS_LIMIT`
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

---

## 10. 已知行为与排查

### 10.1 为什么新闻库有新新闻，但“AI 今日战略判断”稍后才更新？
- 新闻库读的是 `news_raw`（准实时）
- 战略判断读的是 `daily_brief`（批处理快照）
- 当前生产调度每 6 小时一次，通常会有“分钟级~6小时”更新延迟

### 10.2 为什么会出现平台误归类（例如提到 Shopify 但主体不是 Shopify）？
- 平台识别基于标题/来源规则，已加入 WooCommerce-迁移语义修正
- 若发现误判，优先完善 `inferPlatform` 和 `isNegatedShopifyTitle` 规则

### 10.3 为什么有时会出现英文标题？
- 上游新闻可能为英文，历史 `daily_brief` 可能保留英文
- 当前已增加中文兜底（生成侧 + 展示侧）

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

## 12. 竞赛交付映射（便于提交）

本仓库可直接支撑以下提交项：
1. 项目说明文档：本 README + 竞赛版项目文档
2. 产品演示：在线系统可现场演示（非PPT）
3. 上线证明：可访问 URL + 截图
4. 价值估算：可基于 `actions/stats` 与沙盘指标输出
5. 代码仓库：本仓库（建议附路演专用 README 小节）

---

## 13. 版本与最近更新

近期关键更新：
- 生产调度统一为服务器 `systemd` 每 6 小时（`main -> daily_brief` 串行）
- AI 助手总结输出改为结构化可读格式
- 示例问题证据支持可点击链接
- 英文标题/驱动增加中文兜底
- 平台归类规则修复（WooCommerce/Shopify 场景）
