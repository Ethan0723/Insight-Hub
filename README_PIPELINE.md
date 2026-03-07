# News Pipeline

`news_pipeline/` 是自动新闻抓取与处理模块的基础框架。

当前阶段已支持：
- RSS 抓取与正文提取
- LLM 结构化摘要生成
- Supabase 写入与回填
- 主流程编排与增量运行

## 目录说明

- `news_pipeline/config.py`: 环境变量配置加载
- `news_pipeline/fetcher.py`: RSS 抓取模板
- `news_pipeline/ai_client.py`: AI 总结模板
- `news_pipeline/supabase_client.py`: 数据写入模板
- `news_pipeline/processor.py`: 处理流程编排模板
- `news_pipeline/main.py`: 命令行入口

## 环境变量

请复制 `.env.example` 并填写：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LLM_API_URL`
- `LLM_API_KEY`
- （可选）`LLM_PROVIDER=auto|compatible|zhipu`
- （可选）`LLM_MODEL`（按提供商切换）

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

## 生产运行方式（当前）

当前生产环境使用服务器 `systemd` 定时，而非 GitHub cron：
1. `insight-news-pipeline.timer` 每 6 小时触发（UTC+8 的 00/06/12/18 点）
2. `insight-news-pipeline.service` 串行执行：
   - `python -m news_pipeline.main`
   - `python -m news_pipeline.daily_brief`
3. 通过同一服务内 `main && daily_brief` 保证依赖顺序：先写 `news_raw`，再生成 `daily_brief`

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
