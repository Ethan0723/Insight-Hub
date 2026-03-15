import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchNewsRaw } from './news_search.mjs';

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

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
你是跨境 SaaS 公司管理层顾问。
请基于以下新闻标题和摘要，输出“管理层长摘要版”，要求：
1) 输出总字数控制在 100-500 字；信息不够时可写得更短，但不要硬凑字数。
2) 严格使用纯文本，不要 Markdown（不要 ##、**、- 列表）。
3) 固定 3 段结构，并在段与段之间空一行：
   第1段【结论】：1-2句，直接给判断。
   第2段【依据】：2-4句，说明关键外部信号及其影响链路（可引用数据点）。
   第3段【建议】：1-3句，给出可执行的优先动作与观察指标。
4) 语言要紧凑清晰，避免把所有信息堆在一个长段里。
5) 在“外部风险信号/收入结构影响/优先方向”三个部分中，每个编号项只表达一个独立要点，不要把多个事件合并到同一条。

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

function safeJsonParse(text, fallback = null) {
  try {
    const parsed = JSON.parse(String(text || ''));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function tryExtractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const parsedFenced = safeJsonParse(fenced[1], null);
    if (parsedFenced && typeof parsedFenced === 'object') return parsedFenced;
  }
  const direct = safeJsonParse(raw, null);
  if (direct && typeof direct === 'object') return direct;
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const sliced = raw.slice(first, last + 1);
    const parsedSliced = safeJsonParse(sliced, null);
    if (parsedSliced && typeof parsedSliced === 'object') return parsedSliced;
  }
  return null;
}

function sanitizeLine(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[#*`>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDomain(url) {
  try {
    return new URL(String(url || '')).hostname || '';
  } catch {
    return '';
  }
}

function clamp(num, min, max) {
  return Math.min(Math.max(Number(num) || 0, min), max);
}

function dedupeByUrl(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const url = String(row?.url || '').trim();
    const key = url || `id:${String(row?.id || '')}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      return;
    }
    const prevTs = Date.parse(prev.published_at || prev.created_at || '') || 0;
    const curTs = Date.parse(row.published_at || row.created_at || '') || 0;
    if (curTs > prevTs) map.set(key, row);
  });
  return Array.from(map.values());
}

function detectIntentByRule(query) {
  const q = String(query || '').toLowerCase();
  if (/近3天|最近3天|过去3天|三天|总结|汇总|扫描|盘点/.test(q)) return 'news_summary';
  if (/近7天|最近7天|过去7天|一周|7天/.test(q)) return 'news_summary';
  if (/今天|今日/.test(q)) return 'brief_today';
  return 'qa';
}

async function callLlmOnce({ messages, temperature = 0.2, maxTokens = 1200 }) {
  const upstream = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      temperature,
      max_tokens: maxTokens,
      messages
    })
  });
  const text = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`llm failed ${upstream.status}: ${text.slice(0, 220)}`);
  }
  const parsed = safeJsonParse(text, {});
  const content = String(parsed?.choices?.[0]?.message?.content || '').trim();
  if (!content) {
    throw new Error('llm returned empty content');
  }
  return content;
}

function heuristicRoute(question) {
  const q = String(question || '').toLowerCase();
  const dailyBriefPatterns = [
    '最值得质疑', '只能保留一个行动', '低估的风险', '假设', '质疑', '行动', '为什么'
  ];
  if (dailyBriefPatterns.some((p) => q.includes(p))) return 'DAILY_BRIEF_QA';
  const topicPatterns = [
    '支付', '合规', '物流', '关税', 'shopify', 'amazon', 'tiktok', 'temu', '佣金', '转化', '履约'
  ];
  if (topicPatterns.some((p) => q.includes(p))) return 'NEWS_SEARCH';
  return 'TOP_N_FALLBACK';
}

async function planQuery(question) {
  const plannerPrompt = `
你是 Query Planner。请根据用户问题输出严格 JSON，不要 Markdown。
输出结构：
{
  "route":"DAILY_BRIEF_QA|NEWS_SEARCH|TOP_N_FALLBACK",
  "time_window":"7d|30d|180d",
  "topic_tags":["..."],
  "query_expansion":["..."],
  "top_n":8
}
判定规则：
- 战略反思/质疑/只保留一个行动/低估风险 => DAILY_BRIEF_QA
- 主题检索（支付/合规/物流/关税/平台等）=> NEWS_SEARCH
- 泛问（今天关注什么/总结重点）或高概率低命中 => TOP_N_FALLBACK
只返回 JSON。
用户问题：${question}
`.trim();
  try {
    const content = await callLlmOnce({
      messages: [
        { role: 'system', content: '你是严格JSON输出器。' },
        { role: 'user', content: plannerPrompt }
      ],
      temperature: 0.1,
      maxTokens: 320
    });
    const parsed = tryExtractJsonObject(content);
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid planner json');
    const route = ['DAILY_BRIEF_QA', 'NEWS_SEARCH', 'TOP_N_FALLBACK'].includes(String(parsed.route))
      ? String(parsed.route)
      : heuristicRoute(question);
    const timeWindow = ['7d', '30d', '180d'].includes(String(parsed.time_window))
      ? String(parsed.time_window)
      : '30d';
    const topN = Math.min(Math.max(Number(parsed.top_n) || 8, 3), 12);
    const topicTags = Array.isArray(parsed.topic_tags) ? parsed.topic_tags.map((s) => sanitizeLine(s)).filter(Boolean).slice(0, 8) : [];
    const queryExpansion = Array.isArray(parsed.query_expansion)
      ? parsed.query_expansion.map((s) => sanitizeLine(s)).filter(Boolean).slice(0, 6)
      : [];
    return { route, time_window: timeWindow, topic_tags: topicTags, query_expansion: queryExpansion, top_n: topN };
  } catch {
    return { route: heuristicRoute(question), time_window: '30d', topic_tags: [], query_expansion: [], top_n: 8 };
  }
}

async function fetchLatestDailyBrief() {
  const upstreamUrl = new URL(`${SUPABASE_URL}/rest/v1/daily_brief`);
  upstreamUrl.searchParams.set(
    'select',
    'id,brief_date,headline,one_liner,top_drivers,impacts,actions,citations,generated_at'
  );
  upstreamUrl.searchParams.set('order', 'generated_at.desc');
  upstreamUrl.searchParams.set('limit', '1');
  let upstream;
  try {
    upstream = await fetchWithTimeout(upstreamUrl.toString(), {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
  } catch (error) {
    const msg = String(error?.name || error?.message || '');
    if (msg.includes('AbortError')) {
      sendJson(res, 504, { error: 'Upstream news_raw timeout' });
      return;
    }
    sendJson(res, 502, { error: 'Upstream news_raw request failed' });
    return;
  }
  const text = await upstream.text();
  if (!upstream.ok) throw new Error(`daily_brief failed ${upstream.status}: ${text.slice(0, 160)}`);
  const rows = safeJsonParse(text, []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function normalizeCitationsFromBrief(brief, allDocs = []) {
  const ids = [];
  if (Array.isArray(brief?.citations)) {
    brief.citations.forEach((c) => {
      const v = String(c || '').trim();
      if (v) ids.push(v);
    });
  }
  const byId = new Map(allDocs.map((d) => [String(d.id || '').trim(), d]));
  const output = [];
  ids.forEach((id) => {
    const hit = byId.get(id);
    if (hit) {
      output.push({
        id: String(hit.id || ''),
        title: sanitizeLine(hit.title),
        url: String(hit.url || ''),
        source: sanitizeLine(hit.source),
        published_at: String(hit.published_at || '')
      });
    } else if (/^https?:\/\//i.test(id)) {
      output.push({
        id: '',
        title: extractDomain(id) || '来源链接',
        url: id,
        source: extractDomain(id),
        published_at: ''
      });
    }
  });
  return output.slice(0, 10);
}

async function fetchTopNews({ days = 7, limit = 8 }) {
  const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
  const upstreamUrl = new URL(`${SUPABASE_URL}/rest/v1/news_raw`);
  upstreamUrl.searchParams.set('select', 'id,title,url,source,publish_time,created_at,summary,impact_score,risk_level');
  upstreamUrl.searchParams.set('or', `(publish_time.gte.${cutoff},created_at.gte.${cutoff})`);
  upstreamUrl.searchParams.set('order', 'impact_score.desc.nullslast,publish_time.desc.nullslast,created_at.desc');
  upstreamUrl.searchParams.set('limit', String(Math.min(Math.max(limit, 3), 12)));
  const upstream = await fetch(upstreamUrl.toString(), {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  const text = await upstream.text();
  if (!upstream.ok) throw new Error(`top news failed ${upstream.status}: ${text.slice(0, 160)}`);
  const rows = safeJsonParse(text, []);
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: r.id,
    title: sanitizeLine(r.title),
    url: String(r.url || ''),
    source: sanitizeLine(r.source || 'Unknown'),
    published_at: String(r.publish_time || r.created_at || ''),
    description: sanitizeLine(typeof r.summary === 'string' ? r.summary : ''),
    score: Number(r.impact_score || 0)
  }));
}

async function detectIntentByLlm(query, mode = 'auto') {
  if (mode && mode !== 'auto') return mode;
  const prompt = `
你是意图分类器。只输出严格 JSON：{"intent":"news_summary|brief_today|qa"}。
规则：
- 包含“近3天/最近7天/总结/盘点/扫描新闻” => news_summary
- 包含“今天/今日” => brief_today
- 其它 => qa
用户问题：${query}
`.trim();
  try {
    const content = await callLlmOnce({
      messages: [
        { role: 'system', content: '你是严格JSON输出器。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.0,
      maxTokens: 120
    });
    const parsed = tryExtractJsonObject(content);
    const intent = String(parsed?.intent || '').trim();
    return ['news_summary', 'brief_today', 'qa'].includes(intent) ? intent : detectIntentByRule(query);
  } catch {
    return detectIntentByRule(query);
  }
}

async function buildQueryExpansion(query, intent) {
  const prompt = `
你是检索扩展器。只输出严格 JSON：
{"topic_tags":[""],"query_expansion":[""],"clusters":[""]}。
要求：topic_tags 最多8个，query_expansion 最多6个，clusters 最多4个；只输出短词组。
意图：${intent}
问题：${query}
`.trim();
  try {
    const content = await callLlmOnce({
      messages: [
        { role: 'system', content: '你是严格JSON输出器。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      maxTokens: 260
    });
    const parsed = tryExtractJsonObject(content) || {};
    const topic_tags = Array.isArray(parsed.topic_tags) ? parsed.topic_tags.map((v) => sanitizeLine(v)).filter(Boolean).slice(0, 8) : [];
    const query_expansion = Array.isArray(parsed.query_expansion)
      ? parsed.query_expansion.map((v) => sanitizeLine(v)).filter(Boolean).slice(0, 6)
      : [];
    const clusters = Array.isArray(parsed.clusters) ? parsed.clusters.map((v) => sanitizeLine(v)).filter(Boolean).slice(0, 4) : [];
    return { topic_tags, query_expansion, clusters };
  } catch {
    return { topic_tags: [], query_expansion: [], clusters: [] };
  }
}

async function fetchNewsCandidatesV2({ days = 7, limit = 200 }) {
  const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
  const queryWithEmbedding = new URL(`${SUPABASE_URL}/rest/v1/news_raw`);
  queryWithEmbedding.searchParams.set(
    'select',
    'id,title,url,source,publish_time,created_at,summary,content,impact_score,risk_level,embedding'
  );
  queryWithEmbedding.searchParams.set('or', `(publish_time.gte.${cutoff},created_at.gte.${cutoff})`);
  queryWithEmbedding.searchParams.set('order', 'publish_time.desc.nullslast,created_at.desc');
  queryWithEmbedding.searchParams.set('limit', String(clamp(limit, 30, 500)));

  const requestHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  };

  let text = '';
  let res = await fetch(queryWithEmbedding.toString(), { headers: requestHeaders });
  text = await res.text();
  if (!res.ok) {
    const fallbackUrl = new URL(`${SUPABASE_URL}/rest/v1/news_raw`);
    fallbackUrl.searchParams.set(
      'select',
      'id,title,url,source,publish_time,created_at,summary,content,impact_score,risk_level'
    );
    fallbackUrl.searchParams.set('or', `(publish_time.gte.${cutoff},created_at.gte.${cutoff})`);
    fallbackUrl.searchParams.set('order', 'publish_time.desc.nullslast,created_at.desc');
    fallbackUrl.searchParams.set('limit', String(clamp(limit, 30, 500)));
    res = await fetch(fallbackUrl.toString(), { headers: requestHeaders });
    text = await res.text();
  }
  if (!res.ok) throw new Error(`news candidate query failed ${res.status}: ${text.slice(0, 180)}`);
  const rows = safeJsonParse(text, []);
  return Array.isArray(rows) ? rows : [];
}

function rankNewsHybrid({ query, candidates, expansion }) {
  const now = Date.now();
  const terms = [
    sanitizeLine(query).toLowerCase(),
    ...(Array.isArray(expansion?.topic_tags) ? expansion.topic_tags : []).map((v) => sanitizeLine(v).toLowerCase()),
    ...(Array.isArray(expansion?.query_expansion) ? expansion.query_expansion : []).map((v) => sanitizeLine(v).toLowerCase())
  ].filter(Boolean);

  const scored = candidates.map((row) => {
    const title = String(row?.title || '');
    const summary = typeof row?.summary === 'string' ? row.summary : JSON.stringify(row?.summary || '');
    const content = String(row?.content || '');
    const text = `${title}\n${summary}\n${content}`.toLowerCase();

    let keywordScore = 0;
    terms.forEach((term) => {
      if (!term) return;
      if (text.includes(term)) keywordScore += 1.2;
      term.split(/\s+/).forEach((token) => {
        if (token && token.length >= 2 && text.includes(token)) keywordScore += 0.35;
      });
    });

    const impact = Number(row?.impact_score || 0);
    const riskRaw = String(row?.risk_level || '').toLowerCase();
    const riskScore = /high|高/.test(riskRaw) ? 1.2 : /mid|中/.test(riskRaw) ? 0.7 : 0.2;
    const ts = Date.parse(row?.publish_time || row?.created_at || '') || now;
    const daysAgo = Math.max(0, (now - ts) / (1000 * 60 * 60 * 24));
    const timeDecay = Math.max(0.2, 1 - daysAgo / 14);
    const semanticProxy = keywordScore > 0 ? Math.min(2.2, keywordScore * 0.6) : 0;
    const total = keywordScore * 1.8 + semanticProxy + timeDecay + impact * 0.02 + riskScore;

    return {
      news_id: String(row?.id || ''),
      title: sanitizeLine(title) || 'Untitled',
      url: String(row?.url || ''),
      domain: extractDomain(row?.url) || sanitizeLine(row?.source) || 'unknown',
      published_at: String(row?.publish_time || row?.created_at || ''),
      source: sanitizeLine(row?.source || ''),
      summary: sanitizeLine(typeof row?.summary === 'string' ? row.summary : ''),
      content: sanitizeLine(content).slice(0, 500),
      score: Number(total.toFixed(3))
    };
  });

  return dedupeByUrl(scored)
    .sort((a, b) => b.score - a.score || (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0));
}

function buildContextFromSources(sources, maxN = 12) {
  return (Array.isArray(sources) ? sources : []).slice(0, maxN).map((item, idx) => ({
    news_id: item.news_id,
    title: item.title,
    url: item.url,
    domain: item.domain || extractDomain(item.url),
    published_at: item.published_at,
    summary: item.summary || item.content || '',
    score: item.score
  }));
}

async function generateAssistantAnswer({ query, intent, contextSources, briefContext, retrieval, timeRangeText }) {
  const prompt = `
你是战略分析师。请仅基于提供的数据库新闻内容生成回答。
所有结论必须来自 context。
不要编造信息。
若 context 不足，请说明信息不足。

请输出严格 JSON：
{
  "answer":"...",
  "cards":{
    "headline":"...",
    "key_drivers":["..."],
    "impacts":["..."],
    "actions":[{"priority":"P0","title":"...","why":"...","owner_suggest":"...","timeframe":"7d"}]
  }
}
要求：
- answer 用中文，聚焦管理层决策，可执行。
- actions 1-3条，优先级用 P0/P1/P2。
- 不要 Markdown。

用户问题：${query}
意图：${intent}
时间窗口：${timeRangeText}
检索统计：${JSON.stringify(retrieval)}
daily_brief 上下文：${JSON.stringify(briefContext || {})}
context 新闻：${JSON.stringify(contextSources)}
`.trim();

  const content = await callLlmOnce({
    messages: [
      { role: 'system', content: '你是严格JSON输出器。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.25,
    maxTokens: 1500
  });
  const parsed = tryExtractJsonObject(content);
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid ai_chat_v2 json');

  const cards = parsed.cards && typeof parsed.cards === 'object' ? parsed.cards : {};
  return {
    answer: sanitizeLine(parsed.answer || ''),
    cards: {
      headline: sanitizeLine(cards.headline || ''),
      key_drivers: Array.isArray(cards.key_drivers) ? cards.key_drivers.map((v) => sanitizeLine(v)).filter(Boolean).slice(0, 5) : [],
      impacts: Array.isArray(cards.impacts) ? cards.impacts.map((v) => sanitizeLine(v)).filter(Boolean).slice(0, 5) : [],
      actions: Array.isArray(cards.actions)
        ? cards.actions.map((a) => ({
            priority: ['P0', 'P1', 'P2'].includes(String(a?.priority || '').toUpperCase())
              ? String(a.priority).toUpperCase()
              : 'P1',
            title: sanitizeLine(a?.title || ''),
            why: sanitizeLine(a?.why || ''),
            owner_suggest: sanitizeLine(a?.owner_suggest || '待定'),
            timeframe: sanitizeLine(a?.timeframe || '7d')
          })).filter((a) => a.title).slice(0, 3)
        : []
    }
  };
}

async function handleAiChatV2(req, res) {
  if (!API_KEY) return sendJson(res, 500, { error: 'LLM_API_KEY missing on server.' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return sendJson(res, 500, { error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing on server.' });
  }

  const body = await readJsonBody(req);
  const query = sanitizeLine(body?.query || '');
  if (!query) return sendJson(res, 400, { error: 'query is required' });

  const mode = ['auto', 'news_summary', 'brief_today', 'qa'].includes(String(body?.mode || 'auto'))
    ? String(body.mode || 'auto')
    : 'auto';
  const topK = clamp(body?.top_k, 3, 20) || 12;
  const requestedDays = clamp(body?.range_days, 1, 180) || (mode === 'news_summary' ? 7 : 3);
  const timezone = sanitizeLine(body?.timezone || '+08:00') || '+08:00';

  const intent = await detectIntentByLlm(query, mode);
  const expansion = await buildQueryExpansion(query, intent);
  const dailyBrief = await fetchLatestDailyBrief().catch(() => null);
  const candidates = await fetchNewsCandidatesV2({ days: requestedDays, limit: 260 }).catch(() => []);
  const ranked = rankNewsHybrid({ query, candidates, expansion });
  const sources = buildContextFromSources(ranked.slice(0, topK), topK);

  const retrieval = {
    total_candidates: candidates.length,
    returned: sources.length,
    strategy: candidates.some((r) => Object.prototype.hasOwnProperty.call(r || {}, 'embedding'))
      ? 'hybrid(keyword+semantic+time_decay+dedupe)'
      : 'hybrid(keyword+query_expansion+time_decay+dedupe)'
  };
  const timeRangeText = `${requestedDays}d (${timezone})`;

  const briefContext = dailyBrief
    ? {
        brief_date: dailyBrief.brief_date,
        headline: sanitizeLine(dailyBrief.headline || ''),
        one_liner: sanitizeLine(dailyBrief.one_liner || ''),
        top_drivers: Array.isArray(dailyBrief.top_drivers) ? dailyBrief.top_drivers.slice(0, 3) : []
      }
    : null;

  let generated;
  if (sources.length === 0) {
    const missPrompt = `
你是战略分析师。数据库检索结果为空。
请输出严格 JSON：
{
  "answer":"需明确说明未检索到符合条件的新闻，并给出扩大时间窗口建议",
  "cards":{
    "headline":"...",
    "key_drivers":["..."],
    "impacts":["..."],
    "actions":[{"priority":"P1","title":"...","why":"...","owner_suggest":"...","timeframe":"7d"}]
  }
}
用户问题：${query}
当前时间窗口：${requestedDays}天
`.trim();
    const missRaw = await callLlmOnce({
      messages: [{ role: 'system', content: '你是严格JSON输出器。' }, { role: 'user', content: missPrompt }],
      temperature: 0.2,
      maxTokens: 800
    });
    const missParsed = tryExtractJsonObject(missRaw);
    generated = {
      answer: sanitizeLine(missParsed?.answer || '未检索到符合条件的新闻，建议扩大时间窗口到近7天或近30天后重试。'),
      cards: {
        headline: sanitizeLine(missParsed?.cards?.headline || '未命中可用新闻'),
        key_drivers: Array.isArray(missParsed?.cards?.key_drivers) ? missParsed.cards.key_drivers.map((v) => sanitizeLine(v)).filter(Boolean) : [],
        impacts: Array.isArray(missParsed?.cards?.impacts) ? missParsed.cards.impacts.map((v) => sanitizeLine(v)).filter(Boolean) : [],
        actions: Array.isArray(missParsed?.cards?.actions)
          ? missParsed.cards.actions.map((a) => ({
              priority: ['P0', 'P1', 'P2'].includes(String(a?.priority || '').toUpperCase()) ? String(a.priority).toUpperCase() : 'P1',
              title: sanitizeLine(a?.title || ''),
              why: sanitizeLine(a?.why || ''),
              owner_suggest: sanitizeLine(a?.owner_suggest || '待定'),
              timeframe: sanitizeLine(a?.timeframe || '7d')
            })).filter((a) => a.title)
          : []
      }
    };
  } else {
    generated = await generateAssistantAnswer({
      query,
      intent,
      contextSources: sources,
      briefContext,
      retrieval,
      timeRangeText
    });
  }

  const response = {
    answer: generated.answer,
    cards: generated.cards,
    sources: sources.map((s) => ({
      news_id: s.news_id,
      title: s.title,
      url: s.url,
      domain: s.domain,
      published_at: s.published_at,
      score: s.score
    })),
    reasoning_view: {
      intent,
      time_range: timeRangeText,
      retrieval,
      synthesis_steps: ['识别问题类型', '检索时间窗口内容', '主题聚类', '生成决策结构'],
      clusters: expansion.clusters
    }
  };
  sendJson(res, 200, response);
}

async function buildStructuredAnswer({ question, plan, docs, brief }) {
  const briefObj = brief
    ? {
        headline: sanitizeLine(brief.headline),
        one_liner: sanitizeLine(brief.one_liner),
        top_drivers: Array.isArray(brief.top_drivers) ? brief.top_drivers.slice(0, 3) : [],
        impacts: brief.impacts || {},
        actions: Array.isArray(brief.actions) ? brief.actions.slice(0, 3) : []
      }
    : null;
  const citations = docs.map((d) => ({
    id: String(d.id || ''),
    title: sanitizeLine(d.title),
    url: String(d.url || ''),
    source: sanitizeLine(d.source),
    published_at: String(d.published_at || '')
  }));
  const prompt = `
你是跨境SaaS管理层顾问。请仅基于提供的数据回答，输出严格 JSON：
{
  "title":"不超过24字",
  "sections":[
    {"heading":"当前判断","bullets":["..."]},
    {"heading":"关键依据","bullets":["..."]},
    {"heading":"下一步动作","bullets":["..."]}
  ],
  "citations":[{"id":"","title":"","url":"","source":"","published_at":""}]
}
要求：
- 不得输出 Markdown。
- 不得出现“信息不足/未找到相关条目/无法评估/新闻不足”。
- 在可用信号下给出可执行建议。
- bullets 每项一句话，最多 5 条。
问题：${question}
路由计划：${JSON.stringify(plan)}
daily_brief：${JSON.stringify(briefObj)}
news_docs：${JSON.stringify(citations.slice(0, 10))}
`.trim();
  try {
    const content = await callLlmOnce({
      messages: [
        { role: 'system', content: '你是严格JSON输出器。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.25,
      maxTokens: 1200
    });
    const parsed = tryExtractJsonObject(content);
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid answer json');
    const title = sanitizeLine(parsed.title || '今日策略答复');
    const sectionsRaw = Array.isArray(parsed.sections) ? parsed.sections : [];
    const sections = sectionsRaw
      .map((s) => ({
        heading: sanitizeLine(s?.heading || '要点'),
        bullets: (Array.isArray(s?.bullets) ? s.bullets : [])
          .map((b) => sanitizeLine(b))
          .filter(Boolean)
          .slice(0, 6)
      }))
      .filter((s) => s.heading && s.bullets.length > 0)
      .slice(0, 4);
    const normalizedCitations = Array.isArray(parsed.citations) ? parsed.citations : citations;
    return { title, sections: sections.length ? sections : [{ heading: '当前判断', bullets: ['先执行最小可逆动作，并在24-72小时内验证关键指标。'] }], citations: normalizedCitations.slice(0, 10) };
  } catch {
    const q = sanitizeLine(question).toLowerCase();
    const isSummary = /(总结|汇总|概览|overview|今日关注|今天关注|重点)/i.test(q);
    const isRisk = /(风险|质疑|假设|挑战|担忧|低估)/i.test(q);
    const isAction = /(行动|保留一个|先做|优先|下一步)/i.test(q);
    const routeLabel =
      plan?.route === 'DAILY_BRIEF_QA'
        ? '战略复盘'
        : plan?.route === 'NEWS_SEARCH'
        ? '主题研判'
        : '全局扫描';
    const title = isSummary ? '今日重点扫描' : isRisk ? '风险优先解读' : isAction ? '行动优先解读' : `${routeLabel}答复`;

    const judgement =
      isSummary
        ? '当前外部信号并非单一主线，建议以高影响事件为牵引，先做可逆决策。'
        : isRisk
        ? '当前最需要防范的是“高影响信号向经营指标传导”的时滞风险，而非单点波动本身。'
        : isAction
        ? '建议先保留低成本且可快速验证的动作，避免一次性资源押注。'
        : '在当前可用信号下，建议以验证闭环优先于规模投入。';

    const fallbackSections = [
      {
        heading: '当前判断',
        bullets: [judgement]
      },
      {
        heading: '关键依据',
        bullets: (docs.slice(0, 3).map((d) => `${sanitizeLine(d.title)}（${sanitizeLine(d.source)}）`)).length
          ? docs.slice(0, 3).map((d) => `${sanitizeLine(d.title)}（${sanitizeLine(d.source)}）`)
          : ['近7天高影响新闻主线分散，暂按“先验证再扩量”执行。']
      },
      {
        heading: '下一步动作',
        bullets: isAction
          ? [
              '24小时内仅保留一个最小动作并明确负责人，避免多线程分散执行力。',
              '72小时内用转化率、支付成功率、退款/拒付率三项指标决定扩容或回撤。'
            ]
          : [
              '24小时内确认核心指标看板（转化率、支付成功率、退款/拒付率）。',
              '72小时内完成一次小流量实验，对比动作前后差异并决定扩容或回撤。'
            ]
      }
    ];
    return { title, sections: fallbackSections, citations: citations.slice(0, 10) };
  }
}

async function streamPlannedChat(question, res) {
  const plan = await planQuery(question);
  let route = plan.route;
  let docs = [];
  let brief = null;

  if (route === 'DAILY_BRIEF_QA') {
    brief = await fetchLatestDailyBrief().catch(() => null);
    if (!brief) {
      route = 'TOP_N_FALLBACK';
    }
  }

  if (route === 'NEWS_SEARCH') {
    const dayMap = { '7d': 7, '30d': 30, '180d': 180 };
    const days = dayMap[plan.time_window] || 30;
    docs = await searchNewsRaw(question, {
      supabaseUrl: SUPABASE_URL,
      supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      days,
      limit: Math.min(Math.max(plan.top_n || 8, 3), 12),
      timeoutMs: 9000
    });
    if (!docs.length && Array.isArray(plan.query_expansion) && plan.query_expansion.length) {
      const merged = [];
      for (const expanded of plan.query_expansion) {
        const hit = await searchNewsRaw(expanded, {
          supabaseUrl: SUPABASE_URL,
          supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
          days: 30,
          limit: 6,
          timeoutMs: 9000
        });
        merged.push(...hit);
      }
      const uniq = new Map();
      merged.forEach((d) => uniq.set(String(d.id || `${d.url}`), d));
      docs = Array.from(uniq.values()).slice(0, 10);
    }
    if (!docs.length) {
      route = 'TOP_N_FALLBACK';
    }
  }

  if (route === 'TOP_N_FALLBACK') {
    docs = await fetchTopNews({ days: 7, limit: Math.min(Math.max(plan.top_n || 8, 3), 12) }).catch(() => []);
    if (!docs.length) {
      docs = await fetchTopNews({ days: 30, limit: 8 }).catch(() => []);
    }
    if (!brief) {
      brief = await fetchLatestDailyBrief().catch(() => null);
    }
  }

  const allDocContext = docs.slice(0, 10);
  const answerJson = await buildStructuredAnswer({
    question,
    plan: { ...plan, route },
    docs: allDocContext,
    brief
  });
  const citations =
    route === 'DAILY_BRIEF_QA'
      ? normalizeCitationsFromBrief(brief || {}, allDocContext)
      : (answerJson.citations || allDocContext).slice(0, 10);

  const payload = {
    title: sanitizeLine(answerJson.title || '今日策略答复'),
    sections: Array.isArray(answerJson.sections) ? answerJson.sections : [],
    citations: citations.map((c) => ({
      id: String(c.id || ''),
      title: sanitizeLine(c.title || ''),
      url: String(c.url || ''),
      source: sanitizeLine(c.source || ''),
      published_at: String(c.published_at || '')
    })),
    route
  };

  startSse(res);
  emitSse(res, { sources: payload.citations });
  emitSse(res, { result: { answer: JSON.stringify(payload), sources: payload.citations } });
  endSse(res);
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
          content: '你是跨境 SaaS 管理层顾问。仅基于输入数据回答，不编造；输出纯文本三段。'
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

  await streamPlannedChat(question, res);
}

async function handleNewsRaw(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    sendJson(res, 500, { error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing on server.' });
    return;
  }

  const requestUrl = new URL(req.url || '/api/news_raw', `http://${req.headers.host || 'localhost'}`);
  const rawLimit = Number.parseInt(String(requestUrl.searchParams.get('limit') || ''), 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 1000) : 1000;
  const lite = String(requestUrl.searchParams.get('lite') || '') === '1';
  const recentDays = Number.parseInt(String(requestUrl.searchParams.get('recent_days') || ''), 10);
  const dateFrom = String(requestUrl.searchParams.get('date_from') || '').trim();
  const dateTo = String(requestUrl.searchParams.get('date_to') || '').trim();

  const upstreamUrl = new URL(`${SUPABASE_URL}/rest/v1/news_raw`);
  const select = lite
    ? 'id,title,title_zh:summary->>title_zh,tldr:summary->>tldr,core_summary:summary->>core_summary,source,url,publish_time,created_at,impact_score,risk_level,platform,region,event_type'
    : 'id,title,source,url,publish_time,created_at,summary,impact_score,risk_level,platform,region,event_type,importance_level,sentiment_score,summary_generated_at';
  upstreamUrl.searchParams.set('select', select);
  if (dateFrom) {
    upstreamUrl.searchParams.set('publish_time', `gte.${dateFrom}T00:00:00+08:00`);
  } else if (Number.isFinite(recentDays) && recentDays > 0) {
    const start = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString();
    upstreamUrl.searchParams.set('publish_time', `gte.${start}`);
  }
  if (dateTo) {
    upstreamUrl.searchParams.set('publish_time', `lte.${dateTo}T23:59:59+08:00`);
  }
  upstreamUrl.searchParams.set('order', 'publish_time.desc.nullslast,created_at.desc');
  upstreamUrl.searchParams.set('limit', String(limit));

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

async function handleDailyBrief(req, res, requestUrl) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    sendJson(res, 500, { error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing on server.' });
    return;
  }

  const date = String(requestUrl.searchParams.get('date') || '').trim();
  const promptVersion = String(requestUrl.searchParams.get('prompt_version') || '').trim();
  const upstreamUrl = new URL(`${SUPABASE_URL}/rest/v1/daily_brief`);
  upstreamUrl.searchParams.set(
    'select',
    'id,brief_date,brief_tz,window_start,window_end,headline,one_liner,top_drivers,impacts,actions,citations,stats,model,prompt_version,usage,generated_at'
  );
  if (date) {
    upstreamUrl.searchParams.set('brief_date', `eq.${date}`);
  }
  if (promptVersion) {
    upstreamUrl.searchParams.set('prompt_version', `eq.${promptVersion}`);
  }
  upstreamUrl.searchParams.set('order', 'generated_at.desc');
  upstreamUrl.searchParams.set('limit', '1');

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
    const requestUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
    const { pathname = '/' } = requestUrl;
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

    if (method === 'POST' && pathname === '/api/ai_chat_v2') {
      await handleAiChatV2(req, res);
      return;
    }

    if (method === 'GET' && pathname === '/api/news_raw') {
      await handleNewsRaw(req, res);
      return;
    }

    if (method === 'GET' && pathname === '/api/daily_brief') {
      await handleDailyBrief(req, res, requestUrl);
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
