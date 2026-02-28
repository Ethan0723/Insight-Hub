import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContext, searchNewsRaw } from './news_search.mjs';
import { generateDbOnlyAnswer, splitIntoStreamTokens } from './rag_chat.mjs';

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.LLM_MODEL || 'bedrock-claude-4-5-sonnet';
const API_URL = process.env.LLM_API_URL || 'https://litellm.shoplazza.site/chat/completions';
const API_KEY = process.env.LLM_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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

function buildSummaryPrompt(payload) {
  const items = Array.isArray(payload?.newsItems) ? payload.newsItems.slice(0, 12) : [];
  const fallbackTitles = Array.isArray(payload?.newsTitles) ? payload.newsTitles.slice(0, 12) : [];
  const lines =
    items.length > 0
      ? items.map((item, idx) => {
          const title = String(item?.title || '').trim();
          const summary = String(item?.summary || '').trim();
          return `${idx + 1}. 标题: ${title}\n   摘要: ${summary || '（无）'}`;
        })
      : fallbackTitles.map((title, idx) => `${idx + 1}. 标题: ${title}`);
  return `
你是跨境 SaaS 战略顾问。
请基于以下新闻标题和摘要，输出一段 100 字左右中文战略摘要，强调：
1) 外部风险信号
2) 对收入结构潜在影响
3) 优先关注方向

新闻输入：
${lines.join('\n')}
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

function startSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
}

function emitSse(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function endSse(res) {
  res.write('data: [DONE]\n\n');
  res.end();
}

async function streamNewsSummary(prompt, res) {
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

  startSse(res);
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const tokens = parseUpstreamChunk(chunk);
    for (const token of tokens) {
      emitSse(res, { token });
    }
  }

  endSse(res);
}

async function streamDbOnlyChat(question, res) {
  const docs = await searchNewsRaw(question, {
    supabaseUrl: SUPABASE_URL,
    supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    days: 30,
    limit: 8,
    timeoutMs: 8000
  });

  const sources = docs.map((doc, idx) => ({
    doc: idx + 1,
    id: doc.id,
    title: doc.title,
    url: doc.url,
    published_at: doc.published_at,
    source: doc.source
  }));

  startSse(res);
  emitSse(res, { sources });

  if (docs.length === 0) {
    const answer = '新闻库中未找到相关条目（最近30/180天），请换关键词或先补充RSS源。';
    emitSse(res, { token: answer });
    emitSse(res, { result: { answer, sources: [] } });
    endSse(res);
    return;
  }

  const context = buildContext(docs, 6000);
  const answer = await generateDbOnlyAnswer({
    question,
    context,
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: MODEL,
    timeoutMs: 45000
  });

  const tokens = splitIntoStreamTokens(answer, 72);
  for (const token of tokens) {
    emitSse(res, { token });
  }
  emitSse(res, { result: { answer, sources } });
  endSse(res);
}

async function handleAiChat(req, res) {
  if (!API_KEY) {
    sendJson(res, 500, { error: 'LLM_API_KEY missing on server.' });
    return;
  }

  const body = await readJsonBody(req);
  const mode = body?.task === 'news_summary' ? 'news_summary' : 'chat';
  if (mode === 'news_summary') {
    const prompt = buildSummaryPrompt(body);
    await streamNewsSummary(prompt, res);
    return;
  }

  const question = String(body?.userQuestion || '').trim();
  if (!question) {
    sendJson(res, 400, { error: 'userQuestion is required' });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    sendJson(res, 500, {
      error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing on server for DB-only assistant.'
    });
    return;
  }

  await streamDbOnlyChat(question, res);
}

async function handleNewsRaw(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    sendJson(res, 500, { error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing on server.' });
    return;
  }

  const upstreamUrl = new URL(`${SUPABASE_URL}/rest/v1/news_raw`);
  upstreamUrl.searchParams.set(
    'select',
    'id,title,content,source,url,publish_time,created_at,summary,impact_score,risk_level,platform,region,event_type,importance_level,sentiment_score,summary_generated_at'
  );
  upstreamUrl.searchParams.set('order', 'publish_time.desc');
  upstreamUrl.searchParams.set('limit', '1000');

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    sendJson(res, upstream.status || 502, { error: text || 'Supabase request failed' });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(text);
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

    if (method === 'GET' && pathname === '/api/news_raw') {
      await handleNewsRaw(req, res);
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
