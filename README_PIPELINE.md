# News Pipeline

`news_pipeline/` 是自动新闻抓取与处理模块的基础框架。

当前阶段仅提供模板结构：
- RSS 抓取入口（待实现）
- Claude 总结入口（待实现）
- Supabase 写入入口（待实现）
- 主流程编排与运行入口

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
- `CLAUDE_API_URL`
- `CLAUDE_API_KEY`

## 本地运行（模板）

```bash
pip install -r requirements.txt
python -m news_pipeline.main
```

## 后续计划

未来通过 GitHub Actions 定时运行该模块，实现：
1. 定时抓取 RSS
2. 调用 Claude 生成结构化摘要
3. 写入 Supabase 供前端消费
