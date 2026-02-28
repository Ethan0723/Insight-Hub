const EN_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'i', 'in', 'is', 'it',
  'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'we', 'what', 'when', 'where', 'who',
  'why', 'with', 'you', 'your', 'about', 'can', 'could', 'do', 'does', 'did', 'have', 'has',
  'had', 'will', 'would', 'should', '近期', '最近'
]);

const CN_STOPWORDS = new Set([
  '的', '了', '我', '你', '他', '她', '它', '我们', '你们', '他们', '她们', '它们', '是', '在', '和',
  '与', '及', '或', '就', '都', '而', '及其', '一个', '一些', '这个', '那个', '请问', '一下', '什么',
  '怎么', '如何', '哪些', '有没有', '呢', '吧', '吗', '啊', '呀', '近期', '最近'
]);

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timeout after ${ms}ms`)), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function toLowerText(value) {
  return String(value || '').toLowerCase();
}

function safeSummaryText(summaryRaw) {
  if (!summaryRaw) return '';
  if (typeof summaryRaw === 'string') return summaryRaw;
  if (typeof summaryRaw !== 'object') return '';
  const candidates = [
    summaryRaw.tldr,
    summaryRaw.core_summary,
    summaryRaw.industry_impact,
    summaryRaw.platform_saas_insight,
    summaryRaw.title_zh
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  return candidates.join(' | ');
}

function tokenizeQuestion(question) {
  const text = String(question || '').trim();
  if (!text) return [];

  const enTokens = text.match(/[A-Za-z][A-Za-z0-9_-]*/g) || [];
  const cnTokens = text.match(/[\u4e00-\u9fff]{2,}/g) || [];
  return [...enTokens, ...cnTokens];
}

function containsAny(text, needles) {
  return needles.some((n) => text.includes(n));
}

export function extractKeywords(question) {
  const raw = tokenizeQuestion(question);
  const normalized = raw
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .filter((t) => !EN_STOPWORDS.has(t.toLowerCase()) && !CN_STOPWORDS.has(t))
    .map((t) => t.toLowerCase());

  const q = String(question || '').toLowerCase();
  const keywordSet = new Set(normalized);

  if (containsAny(q, ['关税', '税', 'tariff'])) {
    ['tariff', 'customs', 'duty', 'de minimis', 'vat'].forEach((k) => keywordSet.add(k));
  }
  if (containsAny(q, ['支付', '收单', '卡', 'checkout'])) {
    ['payment', 'checkout', 'card', 'chargeback', 'fraud'].forEach((k) => keywordSet.add(k));
  }
  if (containsAny(q, ['物流', '履约'])) {
    ['logistics', 'fulfillment', 'freight', 'supply chain', 'shipping'].forEach((k) =>
      keywordSet.add(k)
    );
  }

  const platformTerms = ['平台', 'shopify', 'shopline', 'amazon', 'temu', 'tiktok'];
  if (containsAny(q, platformTerms)) {
    platformTerms.forEach((k) => keywordSet.add(k.toLowerCase()));
  }

  return Array.from(keywordSet).slice(0, 12);
}

function buildMatchText(row) {
  const title = String(row?.title || '');
  const summary = safeSummaryText(row?.summary);
  const content = String(row?.content || '');
  const description = String(row?.description || '');
  return {
    title,
    titleLower: toLowerText(title),
    summary,
    summaryLower: toLowerText(summary || description),
    contentLower: toLowerText(content)
  };
}

function choosePublishedAt(row) {
  return row?.publish_time || row?.created_at || '';
}

function computeScore(row, keywords, nowMs) {
  const txt = buildMatchText(row);
  let score = 0;
  let matched = false;

  for (const kw of keywords) {
    const k = kw.toLowerCase();
    if (!k) continue;
    if (txt.titleLower.includes(k)) {
      score += 5;
      matched = true;
    }
    if (txt.summaryLower.includes(k)) {
      score += 3;
      matched = true;
    }
    if (!txt.titleLower.includes(k) && !txt.summaryLower.includes(k) && txt.contentLower.includes(k)) {
      score += 1;
      matched = true;
    }
  }

  const ts = Date.parse(choosePublishedAt(row));
  if (!Number.isNaN(ts)) {
    const daysSincePublish = Math.max(0, (nowMs - ts) / (1000 * 60 * 60 * 24));
    score += Math.max(0, 10 - daysSincePublish / 3);
  }

  return { score, matched };
}

async function fetchCandidates({
  supabaseUrl,
  supabaseServiceRoleKey,
  daysWindow,
  timeoutMs,
  hardLimit = 500
}) {
  const cutoff = new Date(Date.now() - daysWindow * 24 * 60 * 60 * 1000).toISOString();
  const base = new URL(`${supabaseUrl}/rest/v1/news_raw`);
  base.searchParams.set(
    'select',
    'id,title,url,source,publish_time,created_at,summary,content'
  );
  base.searchParams.set('order', 'publish_time.desc,created_at.desc');
  base.searchParams.set('limit', String(hardLimit));
  base.searchParams.set('or', `(publish_time.gte.${cutoff},created_at.gte.${cutoff})`);

  const { signal, clear } = timeoutSignal(timeoutMs);
  try {
    const res = await fetch(base.toString(), {
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`
      },
      signal
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`supabase search failed ${res.status}: ${text.slice(0, 160)}`);
    }
    const rows = JSON.parse(text);
    return Array.isArray(rows) ? rows : [];
  } finally {
    clear();
  }
}

export async function searchNewsRaw(
  question,
  {
    supabaseUrl,
    supabaseServiceRoleKey,
    days = 30,
    limit = 10,
    timeoutMs = 8000
  } = {}
) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('searchNewsRaw requires supabaseUrl and supabaseServiceRoleKey');
  }

  const keywords = extractKeywords(question);
  const nowMs = Date.now();

  const rank = (rows) =>
    rows
      .map((row) => {
        const { score, matched } = computeScore(row, keywords, nowMs);
        return { row, score, matched };
      })
      .filter((item) => item.matched)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const bt = Date.parse(choosePublishedAt(b.row)) || 0;
        const at = Date.parse(choosePublishedAt(a.row)) || 0;
        return bt - at;
      })
      .slice(0, limit)
      .map((item) => {
        const summary = safeSummaryText(item.row.summary) || String(item.row.description || '');
        return {
          id: item.row.id,
          title: String(item.row.title || '').trim() || 'Untitled',
          url: String(item.row.url || '').trim(),
          published_at: choosePublishedAt(item.row),
          source: String(item.row.source || '').trim() || 'Unknown',
          description: String(summary || '').slice(0, 300),
          score: Number(item.score.toFixed(2))
        };
      });

  const primary = rank(
    await fetchCandidates({
      supabaseUrl,
      supabaseServiceRoleKey,
      daysWindow: days,
      timeoutMs
    })
  );
  if (primary.length > 0) return primary;

  return rank(
    await fetchCandidates({
      supabaseUrl,
      supabaseServiceRoleKey,
      daysWindow: 180,
      timeoutMs
    })
  );
}

export function buildContext(docs, maxChars = 6000) {
  const blocks = [];
  let used = 0;

  docs.forEach((doc, idx) => {
    if (used >= maxChars) return;
    const snippet = String(doc.description || '').slice(0, 320);
    const block = [
      `[DOC ${idx + 1}]`,
      `Title: ${doc.title || ''}`,
      `Date: ${doc.published_at || ''}`,
      `Source: ${doc.source || ''}`,
      `URL: ${doc.url || ''}`,
      `Snippet: ${snippet}`,
      ''
    ].join('\n');
    const remaining = maxChars - used;
    if (block.length <= remaining) {
      blocks.push(block);
      used += block.length;
    } else if (remaining > 80) {
      blocks.push(block.slice(0, remaining));
      used = maxChars;
    }
  });

  return blocks.join('\n').trim();
}
