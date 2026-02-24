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

说明：
- Python pipeline 与 Node AI 服务统一使用 `LLM_API_URL` / `LLM_API_KEY`。
- 代码层已兼容旧变量名 `CLAUDE_API_URL` / `CLAUDE_API_KEY`，但建议迁移后删除旧变量。

## 本地运行

```bash
pip install -r requirements.txt
python -m news_pipeline.main
```

## 后续计划

未来通过 GitHub Actions 定时运行该模块，实现：
1. 定时抓取 RSS
2. 调用 LLM 生成结构化摘要
3. 写入 Supabase 供前端消费

## 清理历史脏数据

如果 `news_raw` 已有无关或低质量新闻，可使用清理模式：

1. 打开 `news_pipeline/main.py`，设置：
   - `RUN_CLEANUP = True`
   - `CLEANUP_DRY_RUN = True`
2. 运行：
   - `python3 -m news_pipeline.main`
3. 检查日志中的 `[CLEANUP-MARK]` 是否符合预期。
4. 确认无误后，将 `CLEANUP_DRY_RUN = False` 再运行一次，执行真实删除。
