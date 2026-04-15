# News Pipeline

`news_pipeline/` 是自动新闻抓取与处理模块的基础框架。

当前阶段已支持：
- RSS 抓取与正文提取
- LLM 结构化摘要生成
- Supabase 写入与回填
- 主流程编排与增量运行
- Daily brief 生成质量护栏、历史补跑与线上审计

## 目录说明

- `news_pipeline/config.py`: 环境变量配置加载
- `news_pipeline/fetcher.py`: RSS 抓取模板
- `news_pipeline/ai_client.py`: AI 总结模板
- `news_pipeline/supabase_client.py`: 数据写入模板
- `news_pipeline/processor.py`: 处理流程编排模板
- `news_pipeline/main.py`: 命令行入口
- `news_pipeline/daily_brief.py`: 基于 `news_raw` 生成公司级战略简报并写入 `daily_brief`
- `news_pipeline/competitor_updates.py`: 抓取竞品官方产品动态并写入 `competitor_updates`

## 环境变量

请复制 `.env.example` 并填写：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_API_URL`
- `LLM_API_KEY`
- （可选）`LLM_PROVIDER=auto|compatible|zhipu`
- （可选）`LLM_MODEL`（按提供商切换）
- （可选）`DAILY_BRIEF_MAX_TOKENS=4000`
- （可选）`DAILY_BRIEF_RETRY_TOKEN_STEP=1000`

说明：
- Python pipeline 与 Node AI 服务统一使用 `LLM_API_URL` / `LLM_API_KEY`。
- 代码层已兼容旧变量名 `CLAUDE_API_URL` / `CLAUDE_API_KEY`，但建议迁移后删除旧变量。
- 已兼容两类 LLM 接口：
  - `compatible`：OpenAI 兼容 chat/completions（如 LiteLLM 代理）
  - `zhipu`：BigModel 平台（如 `https://open.bigmodel.cn/api/paas/v4/chat/completions`）

## 本地运行

```bash
pip install -r requirements.txt
python -m news_pipeline.main
```

手动生成或补跑 daily brief：

```bash
python -m news_pipeline.daily_brief
DAILY_BRIEF_TARGET_DATE=2026-04-15 DAILY_BRIEF_FORCE_OVERWRITE=true python -m news_pipeline.daily_brief
```

`daily_brief` 生成侧当前包含以下防护：
- 优先选择高业务相关性、高影响分、高风险新闻，并过滤明显无关噪声
- 高影响新闻有明确平台/公司主体时，headline 或 one_liner 必须点名主体
- LLM 输出被截断时不写入数据库，并在下一次重试提高 token budget
- 历史质量守卫会避免低质量结果覆盖高质量结果；明显泛化兜底的旧记录允许被更稳的新结果替换
- `actions` / `success_metric` 禁止编造线索数、转化率、增长率、签约数量等 KPI，只保留可解释交付物
- 2026-04-15 已对线上 53 条 `daily_brief` 做全量审计，并清理历史行动项中的模型自拟 KPI

## 竞品官方动态

`competitor_updates` 使用独立数据表，不写入 `news_raw`。

```bash
python -m news_pipeline.competitor_updates
```

默认从 `2026-01-01` 抓取 Shopify / SHOPLINE 官方产品动态，并为政策页写入当前版本快照。可用环境变量：

增量策略：每次仍会拉取官网候选列表，但会先按 `canonical_key` 与 `content_hash` 检查既有记录；内容未变化时只刷新 `last_checked_at`、官方时间与原始字段，跳过 LLM 分析，只有新记录或正文变化才重新生成中文摘要与影响判断。

- `COMPETITOR_UPDATES_START_DATE=2026-01-01`
- `COMPETITOR_UPDATES_MAX_PRODUCT_ITEMS=80`
- `COMPETITOR_UPDATES_ENABLE_LLM=true`
- `COMPETITOR_UPDATES_DRY_RUN=false`
- `COMPETITOR_UPDATES_NORMALIZE_ONLY=false`
- `COMPETITOR_UPDATES_NORMALIZE_LIMIT=300`

## 生产运行方式（当前）

当前生产环境使用服务器 `systemd` 定时，而非 GitHub cron：
1. `insight-news-pipeline.timer` 每 6 小时触发（UTC+8 的 00/06/12/18 点）
2. `insight-news-pipeline.service` 串行执行：
   - `python -m news_pipeline.main`
   - `python -m news_pipeline.competitor_updates`
   - `python -m news_pipeline.daily_brief`
3. 通过同一服务内 `main && competitor_updates && daily_brief` 保证依赖顺序：先写 `news_raw` 与 `competitor_updates`，再生成 `daily_brief`

GitHub Actions 仅保留手动补跑入口（`workflow_dispatch`）。

## 清理历史脏数据

如果 `news_raw` 已有无关或低质量新闻，可使用清理模式：

1. 打开 `news_pipeline/main.py`，设置：
   - `RUN_CLEANUP = True`
   - `CLEANUP_DRY_RUN = True`
2. 运行：
   - `python3 -m news_pipeline.main`
3. 检查日志中的 `[CLEANUP-MARK]` 是否符合预期。
4. 确认无误后，将 `CLEANUP_DRY_RUN = False` 再运行一次，执行真实删除。
