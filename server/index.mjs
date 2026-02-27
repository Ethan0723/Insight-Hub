import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.LLM_MODEL || 'bedrock-claude-4-5-sonnet';
const API_URL = process.env.LLM_API_URL || 'https://litellm.shoplazza.site/chat/completions';
const API_KEY = process.env.LLM_API_KEY || '';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const STATIC_BASE = (process.env.STATIC_BASE || '/Insight-Hub').replace(/\/+$/, '');
const CORS_ALLOW_ORIGINS = (process.env.CORS_ALLOW_ORIGINS || '*')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const MAX_BODY_BYTES = 1024 * 1024;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function resolveAllowedOrigin(req) {
  const origin = req.headers.origin || '';
  if (CORS_ALLOW_ORIGINS.includes('*')) return '*';
  if (!origin) return CORS_ALLOW_ORIGINS[0] || '*';
  if (CORS_ALLOW_ORIGINS.includes(origin)) return origin;
  return CORS_ALLOW_ORIGINS[0] || '*';
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(data));
}

function sendStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
  });
  res.end(data);
}

function serveFrontend(pathname, res) {
  if (!fs.existsSync(DIST_DIR)) {
    sendJson(res, 503, { error: 'Frontend build not found. Please run npm run build first.' });
    return true;
  }

  if (pathname === '/') {
    res.writeHead(302, { Location: `${STATIC_BASE}/` });
    res.end();
    return true;
  }

  if (pathname === STATIC_BASE) {
    res.writeHead(302, { Location: `${STATIC_BASE}/` });
    res.end();
    return true;
  }

  if (!pathname.startsWith(`${STATIC_BASE}/`)) {
    return false;
  }

  const relative = pathname.slice(`${STATIC_BASE}/`.length);
  const requested = relative ? path.join(DIST_DIR, relative) : path.join(DIST_DIR, 'index.html');
  const normalized = path.normalize(requested);
  if (!normalized.startsWith(DIST_DIR)) {
    sendJson(res, 400, { error: 'Invalid path' });
    return true;
  }

  if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) {
    sendStaticFile(res, normalized);
    return true;
  }

  const fallback = path.join(DIST_DIR, 'index.html');
  sendStaticFile(res, fallback);
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      body += chunk.toString('utf8');
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function buildChatPrompt(payload) {
  const {
    userQuestion,
    baseline = 0,
    delta = 0,
    finalScore = 0,
    exposureMatrix = [],
    priorityRanking = []
  } = payload;

  return `
你是跨境 SaaS 战略顾问。
用户问题基于以下数据：

- Baseline: ${baseline}
- Delta: ${delta}
- Final: ${finalScore}
- 暴露矩阵: ${JSON.stringify(exposureMatrix)}
- 优先级排序: ${JSON.stringify(priorityRanking)}

要求：
1. 给出自然语言战略判断
2. 不编造数据
3. 不重新计算分数
4. 强调外部风险与内部敏感度关系
5. 语气专业但不模板化

输出结构：
【战略判断】
简洁 2-3 行结论

【关键影响因素】
条列 2-4 点

【建议行动】
条列 2-3 点

用户问题：
${userQuestion}
`.trim();
}

function buildSummaryPrompt(payload) {
  const titles = Array.isArray(payload?.newsTitles) ? payload.newsTitles.slice(0, 12) : [];
  return `
你是跨境 SaaS 战略顾问。
请基于以下新闻标题，输出一段 100 字左右中文战略摘要，强调：
1) 外部风险信号
2) 对收入结构潜在影响
3) 优先关注方向

新闻标题：
${titles.map((title, idx) => `${idx + 1}. ${title}`).join('\n')}
`.trim();
}

function parseUpstreamChunk(chunkText) {
  const tokens = [];
  for (const rawLine of chunkText.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) continue;

    const payload = line.replace(/^data:\s*/, '');
    if (payload === '[DONE]') continue;

    try {
      const parsed = JSON.parse(payload);
      const token = parsed?.choices?.[0]?.delta?.content;
      if (token) tokens.push(token);
    } catch {
      continue;
    }
  }
  return tokens;
}

async function handleAiChat(req, res) {
  if (!API_KEY) {
    sendJson(res, 500, { error: 'LLM_API_KEY missing on server.' });
    return;
  }

  const body = await readJsonBody(req);
  const mode = body?.task === 'news_summary' ? 'news_summary' : 'chat';
  const prompt = mode === 'news_summary' ? buildSummaryPrompt(body) : buildChatPrompt(body);

  const upstream = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      temperature: 0.5,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: '你是跨境 SaaS 战略顾问。请严格基于输入数据，不编造。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text();
    sendJson(res, upstream.status || 502, { error: errorText || 'Upstream LLM request failed' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const tokens = parseUpstreamChunk(chunk);
    for (const token of tokens) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
}

const server = http.createServer(async (req, res) => {
  try {
    const { method = 'GET', url = '/' } = req;
    const { pathname = '/' } = new URL(url, `http://${req.headers.host || 'localhost'}`);
    const allowOrigin = resolveAllowedOrigin(req);
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'POST' && pathname === '/api/ai_chat') {
      await handleAiChat(req, res);
      return;
    }

    if (method === 'GET' || method === 'HEAD') {
      const handled = serveFrontend(pathname, res);
      if (handled) return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, 500, { error: String(error?.message || error) });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, () => {
  console.log(`[ai-server] listening on http://localhost:${PORT}`);
});
