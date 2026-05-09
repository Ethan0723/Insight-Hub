# Insight Hub Server Migration Checklist

本文档基于 2026-05-09 当前线上服务器状态整理，目标是把 `Insight-Hub` 从旧服务器迁移到新服务器，并尽量保持现有运行方式不变。

## 1. 当前线上运行方式

- 代码目录：`/opt/Insight-Hub`
- Web/API 服务：`insight-ai-api.service`
- 定时任务：`insight-news-pipeline.timer`
- 定时任务对应服务：`insight-news-pipeline.service`
- Web/API 启动命令：`/usr/bin/node /opt/Insight-Hub/server/index.mjs`
- Pipeline 执行链路：
  - `python -m news_pipeline.main`
  - `python -m news_pipeline.competitor_updates`
  - `python -m news_pipeline.daily_brief`

## 2. 建议迁移代码版本

优先使用 GitHub 分支：

- `codex/server-sync-20260509`

该分支是按当前服务器 `/opt/Insight-Hub` 实际运行代码同步出来的快照。

## 3. 新服务器前置条件

- Linux 服务器
- Node.js 18+
- Python 3.11+
- `git`
- `systemd`

## 4. 拉取代码

```bash
mkdir -p /opt
cd /opt
git clone -b codex/server-sync-20260509 git@github.com:Ethan0723/Insight-Hub.git Insight-Hub
cd /opt/Insight-Hub
```

如果后续你已经把该分支合并回 `main`，也可以直接拉 `main`。

## 5. 安装依赖

### Node 依赖

```bash
cd /opt/Insight-Hub
npm install
```

### Python 依赖

```bash
cd /opt/Insight-Hub
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

当前 `requirements.txt` 包含：

- `feedparser`
- `requests`
- `python-dotenv`
- `supabase`
- `trafilatura`
- `certifi`
- `beautifulsoup4`

## 6. 环境变量

在新服务器创建：

- `/opt/Insight-Hub/.env`

最少需要确认以下变量：

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LLM_PROVIDER=
LLM_API_URL=
LLM_API_KEY=
LLM_MODEL=
GOOGLE_WINDOW_DAYS=
MAX_GOOGLE_WINDOWS=
MAX_ENTRIES_PER_FEED=
ENABLE_SUMMARY=
LLM_MAX_TOKENS=
CORS_ALLOW_ORIGINS=
PORT=
VITE_GA_ID=
DAILY_BRIEF_MAX_TOKENS=
DAILY_BRIEF_RETRY_TOKEN_STEP=
```

如需重新构建前端，还应补齐这些 Vite 变量：

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_USE_SUPABASE=true
VITE_SUPABASE_NEWS_LIMIT=1000
VITE_AI_API_BASE=
```

说明：

- `SUPABASE_SERVICE_ROLE_KEY` 给 Python pipeline 和部分服务端 API 使用。
- `VITE_*` 变量在前端构建时注入，修改后需要重新执行 `npm run build`。
- 当前线上 Node 服务监听 `PORT=80`。

## 7. 构建前端

```bash
cd /opt/Insight-Hub
npm run build
```

构建产物会写入 `dist/`，由 `server/index.mjs` 统一托管静态资源和 `/api/*`。

## 8. systemd 配置

### Web/API 服务

文件：

- `/etc/systemd/system/insight-ai-api.service`

内容：

```ini
[Unit]
Description=Insight Hub AI API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/Insight-Hub
EnvironmentFile=/opt/Insight-Hub/.env
ExecStart=/usr/bin/node /opt/Insight-Hub/server/index.mjs
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
```

### Pipeline 定时服务

文件：

- `/etc/systemd/system/insight-news-pipeline.service`

内容：

```ini
[Unit]
Description=Insight Hub News Pipeline
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/Insight-Hub
EnvironmentFile=/opt/Insight-Hub/.env
ExecStart=/bin/bash -lc "set -e; /opt/Insight-Hub/venv/bin/python -m news_pipeline.main; /opt/Insight-Hub/venv/bin/python -m news_pipeline.competitor_updates; /opt/Insight-Hub/venv/bin/python -m news_pipeline.daily_brief"
Nice=10

[Install]
WantedBy=multi-user.target
```

### Pipeline 定时器

文件：

- `/etc/systemd/system/insight-news-pipeline.timer`

内容：

```ini
[Unit]
Description=Run Insight Hub News Pipeline every 6 hours (UTC+8)

[Timer]
OnCalendar=*-*-* 00,06,12,18:00:00
Persistent=true
Unit=insight-news-pipeline.service

[Install]
WantedBy=timers.target
```

## 9. 启用服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now insight-ai-api.service
sudo systemctl enable --now insight-news-pipeline.timer
```

如果你想先手动验证 pipeline，可先只启动 Web/API，再单独跑一次：

```bash
cd /opt/Insight-Hub
source venv/bin/activate
python -m news_pipeline.main
python -m news_pipeline.competitor_updates
python -m news_pipeline.daily_brief
```

## 10. 迁移后校验

### 服务状态

```bash
systemctl status insight-ai-api.service --no-pager
systemctl status insight-news-pipeline.timer --no-pager
systemctl status insight-news-pipeline.service --no-pager
```

### 日志

```bash
journalctl -u insight-ai-api.service -n 100 --no-pager
journalctl -u insight-news-pipeline.service -n 100 --no-pager
```

### 接口自检

```bash
curl -sS http://127.0.0.1:${PORT}/api/news_raw?limit=1
curl -sS http://127.0.0.1:${PORT}/api/daily_brief
curl -sS http://127.0.0.1:${PORT}/api/competitor_updates?limit=1
```

### 前端自检

- 打开首页
- 检查战略总览是否加载
- 检查新闻库是否可翻页
- 检查“竞品官方动态”页是否有数据
- 检查 AI 助手是否能返回结果

## 11. 推荐迁移顺序

1. 在新服务器拉取 `codex/server-sync-20260509`
2. 写入 `.env`
3. 安装 Node 和 Python 依赖
4. 执行 `npm run build`
5. 写入两个 `service` 和一个 `timer`
6. 启动 `insight-ai-api.service`
7. 手动跑一遍 pipeline
8. 确认接口、页面、日志正常
9. 启动 `insight-news-pipeline.timer`

## 12. 风险提醒

- 如果只复制源码但没有复制 `.env`，Node API 和 pipeline 都会缺关键密钥。
- 如果变更了任何 `VITE_*` 变量但没有重新 `npm run build`，前端会继续使用旧值。
- 目前服务以 `root` 运行，迁移时如果要切换成普通用户，需要同步调整目录权限和 `systemd` 配置。
