import { useMemo, useState } from 'react';
import { streamAiChat, streamNewsSummary } from '../services/ai';
import { track } from '../lib/analytics';

const DIMENSION_META = {
  subscription: { label: '订阅价格', short: '模板订阅' },
  commission: { label: '佣金结构', short: '商家运营服务' },
  payment: { label: '支付链路', short: '支付与收单' },
  ecosystem: { label: '生态扩展', short: '生态协同' }
};

const FIXED_SAMPLE_QUESTIONS = [
  { id: 'q1', text: '当前结论中，最值得质疑的假设是什么？' },
  { id: 'q2', text: '如果只能保留一个行动，应该保留哪一个？为什么？' },
  { id: 'q3', text: '在当前判断下，最容易被低估的风险是什么？' }
];

function parseMaybeJson(value, fallback) {
  if (value == null) return fallback;
  if (Array.isArray(fallback) && Array.isArray(value)) return value;
  if (!Array.isArray(fallback) && typeof fallback === 'object' && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function sanitizePlainText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`{1,3}/g, '')
    .replace(/战略摘要（100字）/g, '战略结论')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s*/g, '')
        .replace(/^\s*[-*+]\s+/g, '')
        .replace(/^\s*>\s*/g, '')
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatStructuredSections(text) {
  let normalized = String(text || '');
  normalized = normalized
    .replace(/跨境\s*SaaS\s*\n+\s*战略摘要/g, '跨境 SaaS 战略摘要')
    .replace(/跨境SaaS\s*\n+\s*战略摘要/g, '跨境 SaaS 战略摘要');

  const labels = ['外部风险信号：', '收入结构影响：', '优先方向：', '结论：', '依据：', '建议：'];
  labels.forEach((label) => {
    const pattern = new RegExp(`\\s*${escapeRegExp(label)}\\s*`, 'g');
    normalized = normalized.replace(pattern, `\n\n${label} `);
  });
  normalized = normalized.replace(/\s+([1-9]\.)\s+/g, '\n$1 ');
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  return normalized.trim();
}

function toNumberedItems(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const normalizeChunks = (chunks) => {
    const refined = [];
    chunks.forEach((chunk) => {
      const parts = String(chunk || '')
        .split(/[，,]/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length === 0) return;
      if (parts.length === 1) {
        refined.push(parts[0]);
        return;
      }
      parts.forEach((part) => {
        if (refined.length > 0 && part.length < 8) {
          refined[refined.length - 1] = `${refined[refined.length - 1]}，${part}`;
        } else {
          refined.push(part);
        }
      });
    });
    return refined.filter(Boolean);
  };

  const numbered = raw
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s*([1-9]\.)\s*/g, '\n$1 ')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^[1-9]\.\s*/, '').trim())
    .filter(Boolean);

  if (numbered.length > 0) {
    const expanded = normalizeChunks(
      numbered.flatMap((item) =>
        item
          .split(/[；;。]/)
          .map((part) => part.trim())
          .filter(Boolean)
      )
    );
    return (expanded.length > 0 ? expanded : numbered).slice(0, 6);
  }

  const expanded = normalizeChunks(
    raw
      .split(/[。；;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
  return expanded.slice(0, 6);
}

function mergeRiskItems(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const merged = [];
  const shouldMergeWithPrev = (current) => {
    const t = String(current || '').trim();
    if (!t) return false;
    if (t.length <= 10) return true;
    return /^(政策|风险|合规|品牌|不确定性|达峰|激增|上升)/.test(t);
  };

  for (const raw of list) {
    const item = String(raw || '').trim();
    if (!item) continue;
    if (merged.length === 0) {
      merged.push(item);
      continue;
    }
    if (shouldMergeWithPrev(item)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}，${item}`;
    } else {
      merged.push(item);
    }
  }

  return merged.slice(0, 5);
}

function formatExecutiveSummaryText(text) {
  const normalized = formatStructuredSections(sanitizePlainText(text));
  const matchSection = (name, endNames) => {
    const endPattern = endNames.length ? `(?:${endNames.map((n) => escapeRegExp(n)).join('|')})` : '$';
    const reg = new RegExp(`${escapeRegExp(name)}\\s*([\\s\\S]*?)${endPattern}`, 'i');
    const m = normalized.match(reg);
    return m ? m[1].trim() : '';
  };

  const risk = matchSection('外部风险信号：', ['收入结构影响：', '优先方向：']);
  const revenue = matchSection('收入结构影响：', ['优先方向：']);
  const priority = matchSection('优先方向：', []);

  const riskItems = mergeRiskItems(toNumberedItems(risk));
  const revenueItems = toNumberedItems(revenue);
  const priorityItems = toNumberedItems(priority);
  const hasAnyStructuredSection = Boolean(risk || revenue || priority);

  if (!hasAnyStructuredSection) {
    const lines = normalized
      .split(/[。；;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const a = lines.slice(0, 3);
    const b = lines.slice(3, 6);
    const c = lines.slice(6, 10);
    return [
      '跨境 SaaS 战略摘要',
      '',
      '外部风险信号：',
      ...(a.length ? a : ['暂无可提炼信号']).map((item, idx) => `${idx + 1}. ${item}`),
      '',
      '收入结构影响：',
      ...(b.length ? b : ['暂无明确结构性变化']).map((item, idx) => `${idx + 1}. ${item}`),
      '',
      '优先方向：',
      ...(c.length ? c : ['先执行最小可逆动作并跟踪核心指标']).map((item, idx) => `${idx + 1}. ${item}`)
    ].join('\n');
  }

  const blocks = [];
  blocks.push('跨境 SaaS 战略摘要');
  blocks.push('');
  blocks.push('外部风险信号：');
  (riskItems.length ? riskItems : ['暂无可提炼信号']).forEach((item, idx) => {
    blocks.push(`${idx + 1}. ${item}`);
  });
  blocks.push('');
  blocks.push('收入结构影响：');
  (revenueItems.length ? revenueItems : ['暂无明确结构性变化']).forEach((item, idx) => {
    blocks.push(`${idx + 1}. ${item}`);
  });
  blocks.push('');
  blocks.push('优先方向：');
  (priorityItems.length ? priorityItems : ['先执行最小可逆动作并跟踪核心指标']).forEach((item, idx) => {
    blocks.push(`${idx + 1}. ${item}`);
  });

  return blocks.join('\n');
}

function stripWeakeningLanguage(text) {
  return String(text || '')
    .replace(/样本少[^。；\n]*[。；]?/g, '')
    .replace(/可用新闻仅\\d+条[^。；\n]*[。；]?/g, '')
    .replace(/业务相关仅\\d+条[^。；\n]*[。；]?/g, '')
    .replace(/信息不足[^。；\n]*[。；]?/g, '')
    .replace(/新闻不足[^。；\n]*[。；]?/g, '')
    .replace(/信号不足[^。；\n]*[。；]?/g, '')
    .replace(/无关业务[^。；\n]*[。；]?/g, '')
    .replace(/（\s*当日\s*）/g, '')
    .replace(/\(\s*当日\s*\)/g, '')
    .trim();
}

function renderParagraphs(text) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return <p className="whitespace-pre-wrap"> </p>;
  }

  return paragraphs.map((paragraph, idx) => (
    <p key={`${idx}-${paragraph.slice(0, 12)}`} className="whitespace-pre-wrap">
      {paragraph}
    </p>
  ));
}

async function fetchLatestDailyBrief() {
  const response = await fetch('/api/daily_brief');
  if (!response.ok) {
    throw new Error(`daily_brief http ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }
  return payload[0];
}

function normalizeDailyBrief(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    headline: String(raw.headline || '').trim(),
    oneLiner: String(raw.one_liner || '').trim(),
    topDrivers: parseMaybeJson(raw.top_drivers, []),
    impacts: parseMaybeJson(raw.impacts, {}),
    actions: parseMaybeJson(raw.actions, []),
    citations: parseMaybeJson(raw.citations, []),
    stats: parseMaybeJson(raw.stats, {}),
    generatedAt: String(raw.generated_at || '').trim()
  };
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function buildEvidenceLinks(brief, news) {
  const newsMap = new Map();
  (news || []).forEach((item) => {
    const id = String(item?.id || '').trim();
    const url = String(item?.originalUrl || '').trim();
    if (id && url && isHttpUrl(url)) {
      newsMap.set(id, url);
    }
  });

  const rawEvidence = [];
  if (Array.isArray(brief?.citations)) {
    brief.citations.forEach((item) => {
      const value = String(item || '').trim();
      if (value) rawEvidence.push(value);
    });
  }
  if (Array.isArray(brief?.topDrivers)) {
    brief.topDrivers.forEach((driver) => {
      if (Array.isArray(driver?.signals)) {
        driver.signals.forEach((signal) => {
          const value = String(signal || '').trim();
          if (value) rawEvidence.push(value);
        });
      }
    });
  }

  const links = rawEvidence
    .map((value) => {
      if (isHttpUrl(value)) return value;
      return newsMap.get(value) || '';
    })
    .filter((value) => isHttpUrl(value));

  return [...new Set(links)].slice(0, 6);
}

function buildSampleQuestionAnswer(question, brief, news) {
  const q = String(question || '').trim();
  const drivers = Array.isArray(brief?.topDrivers) ? brief.topDrivers.slice(0, 3) : [];
  const actions = Array.isArray(brief?.actions) ? brief.actions : [];
  const impacts = brief?.impacts && typeof brief.impacts === 'object' ? brief.impacts : {};
  const evidenceLinks = buildEvidenceLinks(brief, news);
  const defaultDriver =
    drivers[0] ||
    ({
      title: '外部信号分散',
      why_it_matters: '当前判断主要依赖支付与转化链路的短期变化。'
    });

  const p0Action =
    actions.find((item) => String(item?.priority || '').toUpperCase() === 'P0') ||
    actions[0] ||
    ({
      priority: 'P0',
      owner: '战略',
      timeframe: '24-72h',
      action: '先保留最小可逆动作并持续跟踪转化、回款与留存三项核心指标。'
    });

  let paragraph1 = '';
  if (q.includes('最值得质疑')) {
    paragraph1 = `最值得质疑的假设是“${defaultDriver.title}会在短期内持续成立”。如果这个假设被打破，当前结论“${brief?.headline || '优先稳住支付与转化'}”的优先级就需要立即重排。`;
  } else if (q.includes('只能保留一个行动')) {
    paragraph1 = `如果只能保留一个行动，建议保留“${p0Action.action}”。这是当前唯一同时覆盖需求验证、风险对冲和执行时效的动作。`;
  } else {
    const underestimated = String(impacts?.payments_risk || impacts?.conversion || impacts?.competition || '').trim();
    paragraph1 = `最容易被低估的风险是${underestimated || '支付链路的局部波动会先打穿转化，再传导到留存和现金回收'}。这个风险不会先体现在口径上，而会先体现在订单完成率与账期延长。`;
  }

  const driverLine = drivers
    .map((item, idx) => {
      const title = String(item?.title || `驱动${idx + 1}`).trim();
      const why = stripWeakeningLanguage(String(item?.why_it_matters || '').trim());
      return why ? `${title}（${why}）` : title;
    })
    .filter(Boolean)
    .join('；');

  const impactLine = [
    String(impacts?.merchant_demand || '').trim(),
    String(impacts?.acquisition || '').trim(),
    String(impacts?.conversion || '').trim(),
    String(impacts?.payments_risk || '').trim()
  ]
    .filter(Boolean)
    .slice(0, 2)
    .join('；');

  const cleanOneLiner = stripWeakeningLanguage(brief?.oneLiner || '先验证关键链路，再扩大投入');
  const paragraph2 = `依据：今日结论为“${brief?.headline || '维持基线并优先做可逆动作'}”，其解释是“${cleanOneLiner || '先验证关键链路，再扩大投入'}”。驱动信息显示${driverLine || '外部变化集中在支付与转化环节'}。影响拆解进一步提示${impactLine || '短周期优先关注转化和支付稳定性'}。`;

  const owner = String(p0Action?.owner || '待定').trim();
  const timeframe = String(p0Action?.timeframe || '24-72h').trim();
  const paragraph3 = `下一步建议：由${owner}在${timeframe}内先落地该动作，并同步设定一组可回滚阈值（转化率、支付成功率、退款/拒付率）。若48小时内指标没有改善，就保守收缩增量投入并切换到备用动作。${evidenceLinks.length ? '证据来源见下方链接。' : ''}`;

  return {
    text: sanitizePlainText([paragraph1, paragraph2, paragraph3].join('\n\n')),
    sources: evidenceLinks.map((url, idx) => ({
      title: `证据链接 ${idx + 1}`,
      url,
      source: 'daily_brief'
    }))
  };
}

function buildExposureMatrix(scoreBreakdown) {
  const dims = ['subscription', 'commission', 'payment', 'ecosystem'];
  return dims.map((id) => {
    const baseline = scoreBreakdown?.baseline?.[id] || 0;
    const delta = scoreBreakdown?.delta?.[id] || 0;
    const final = scoreBreakdown?.final?.[id] || 0;
    const exposureIndex = Number(((baseline * Math.abs(delta)) / 100).toFixed(2));

    return {
      id,
      name: DIMENSION_META[id].label,
      externalRisk: baseline,
      internalSensitivity: Math.abs(delta),
      exposureIndex,
      final
    };
  });
}

function buildPriorityRanking(exposureMatrix) {
  return [...exposureMatrix]
    .sort((a, b) => b.exposureIndex - a.exposureIndex)
    .map((item) => item.name);
}

function buildReasoningStructure(scoreBreakdown, exposureMatrix, priorityRanking, news) {
  const newsMap = new Map((news || []).map((item) => [item.id, item]));

  return exposureMatrix.map((item) => {
    const evidenceIds = scoreBreakdown?.evidence?.[item.id] || [];
    return {
      id: item.id,
      name: item.name,
      baseline: scoreBreakdown?.baseline?.[item.id] || 0,
      delta: scoreBreakdown?.delta?.[item.id] || 0,
      final: scoreBreakdown?.final?.[item.id] || 0,
      priority: priorityRanking.indexOf(item.name) + 1,
      evidenceIds,
      evidenceTitles: evidenceIds.map((id) => newsMap.get(id)?.title).filter(Boolean).slice(0, 5)
    };
  });
}

function buildFallbackAnswer(question, scoreBreakdown, priorityRanking) {
  const final = scoreBreakdown?.final?.overall || 0;
  return [
    '【战略判断】',
    `当前 Final 评分 ${final}，建议优先按暴露排序推进：${priorityRanking.slice(0, 2).join('、')}。`,
    '',
    '【关键影响因素】',
    '- 外部 Baseline 信号仍在中高位波动。',
    '- 内部策略参数变化对支付与佣金维度更敏感。',
    '',
    '【建议行动】',
    '- 先处理 P0 维度并建立周度回看。',
    '- 将问题拆为 2 周实验，按 Final 变化复盘。',
    `- 当前问题：${question}`
  ].join('\n');
}

function toUtc8Date(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

function utc8DayKeyFromDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildRecentUtc8DaySet(days = 7) {
  const base = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const daySet = new Set();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(base.getTime() - i * 24 * 60 * 60 * 1000);
    daySet.add(utc8DayKeyFromDate(d));
  }
  return daySet;
}

function isNewsSummaryQuestion(question) {
  const q = String(question || '').toLowerCase();
  return (
    (/总结|汇总|概览|盘点/.test(q) && /新闻|情报|动态/.test(q)) ||
    (/近7天|最近7天|过去7天|一周|本周/.test(q) && /新闻|情报|动态/.test(q))
  );
}

function pickRecentNewsItems(news, days = 7, limit = 12) {
  const daySet = buildRecentUtc8DaySet(days);
  return (news || [])
    .filter((item) => daySet.has(utc8DayKeyFromDate(toUtc8Date(item?.createdAt) || new Date(0))))
    .sort((a, b) => (Number(b?.impactScore) || 0) - (Number(a?.impactScore) || 0))
    .map((item) => ({
      title: String(item?.title || '').trim(),
      summary: String(item?.summary || item?.aiTldr || '').trim()
    }))
    .filter((item) => Boolean(item.title))
    .slice(0, limit);
}

function AssistantBubble({ message, onOpenEvidence }) {
  const [showStructure, setShowStructure] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-sm text-cyan-100">{message.text}</div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-3 text-sm text-slate-100">
        <div className="mb-2 flex items-center gap-2 text-xs text-cyan-300">
          <span>🤖 AI 助手</span>
          {message.pending ? <span className="text-slate-400">生成中...</span> : null}
        </div>

        <div className="space-y-2.5 text-sm leading-[1.62] text-slate-100">
          {renderParagraphs(message.text || (message.pending ? '正在基于当前评分与暴露矩阵生成策略回答...' : ''))}
        </div>

        {Array.isArray(message.sources) && message.sources.length > 0 ? (
          <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/40 p-2">
            <p className="mb-1 text-[11px] text-cyan-200">引用来源</p>
            <div className="space-y-1">
              {message.sources.map((src, idx) => (
                <a
                  key={`${src.url}-${idx}`}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    let domain = '';
                    try {
                      domain = src?.url ? new URL(src.url).hostname : '';
                    } catch {
                      domain = '';
                    }
                    track('citation_click', { domain });
                  }}
                  className="block text-[11px] text-slate-300 hover:text-cyan-200"
                >
                  [{idx + 1}] {src.published_at || ''} {src.source || ''} {src.title}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {message.error ? <p className="mt-2 text-xs text-rose-300">{message.error}</p> : null}

        {message.structure ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowStructure((v) => !v)}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
            >
              {showStructure ? '收起推理结构' : '查看推理结构'}
            </button>

            {showStructure ? (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                {message.structure.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <p className="text-xs text-cyan-200">
                      {item.name} · 优先级 P{item.priority}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Baseline {item.baseline} / Δ {item.delta > 0 ? `+${item.delta}` : item.delta} / Final {item.final}
                    </p>
                    {item.evidenceTitles.length ? (
                      <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                        {item.evidenceTitles.map((title) => (
                          <p key={title}>- {title}</p>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        onOpenEvidence({
                          id: `ev-ai-${item.id}`,
                          title: `AI 对话引用 · ${item.name}`,
                          newsIds: item.evidenceIds
                        })
                      }
                      className="mt-2 rounded-lg border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
                    >
                      查看证据新闻
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AIAssistantPanel({ open, onClose, scoreBreakdown, news, onOpenEvidence }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: '我会基于 Baseline + Delta + 暴露矩阵回答，不会重算核心评分。',
      structure: null,
      pending: false,
      error: ''
    }
  ]);
  const [latestBrief, setLatestBrief] = useState(null);

  const exposureMatrix = useMemo(() => buildExposureMatrix(scoreBreakdown), [scoreBreakdown]);
  const priorityRanking = useMemo(() => buildPriorityRanking(exposureMatrix), [exposureMatrix]);
  const structure = useMemo(
    () => buildReasoningStructure(scoreBreakdown, exposureMatrix, priorityRanking, news),
    [scoreBreakdown, exposureMatrix, priorityRanking, news]
  );

  if (!open) return null;

  const submitQuestion = async (rawQuestion, options = {}) => {
    const question = String(rawQuestion || '').trim();
    const isSample = Boolean(options.isSample);
    const sampleId = String(options.sampleId || '').trim();
    const isSummaryQuestion = !isSample && isNewsSummaryQuestion(question);
    if (!question) return;

    if (isSample && sampleId) {
      track('ai_example_click', { q_id: sampleId });
    } else if (!isSample) {
      track('ai_ask_submit', { input_len: question.length });
    }

    const userMessage = { id: `u-${Date.now()}`, role: 'user', text: question };
    const assistantId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: 'assistant',
        text: '',
        sources: [],
        structure,
        pending: true,
        error: ''
      }
    ]);
    setInput('');

    try {
      if (isSample) {
        const rawBrief = latestBrief || (await fetchLatestDailyBrief());
        if (rawBrief && !latestBrief) {
          setLatestBrief(rawBrief);
        }
        const brief = normalizeDailyBrief(rawBrief);
        const answer = buildSampleQuestionAnswer(question, brief, news);
        setMessages((prev) =>
          prev.map((item) => (item.id === assistantId ? { ...item, text: answer.text, sources: answer.sources, pending: false } : item))
        );
      } else if (isSummaryQuestion) {
        const newsItems = pickRecentNewsItems(news, 7, 12);
        if (newsItems.length === 0) {
          throw new Error('no_recent_news');
        }
        let summaryRawBuffer = '';
        await streamNewsSummary(newsItems, {
          onToken: (token) => {
            summaryRawBuffer += token;
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? { ...item, text: sanitizePlainText(summaryRawBuffer) }
                  : item
              )
            );
          },
          onSources: (sources) => {
            setMessages((prev) => prev.map((item) => (item.id === assistantId ? { ...item, sources } : item)));
          }
        });

        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  text: formatExecutiveSummaryText(summaryRawBuffer),
                  pending: false
                }
              : item
          )
        );
      } else {
        await streamAiChat(
          {
            userQuestion: question,
            baseline: scoreBreakdown?.baseline?.overall || 0,
            delta: scoreBreakdown?.delta?.overall || 0,
            finalScore: scoreBreakdown?.final?.overall || 0,
            exposureMatrix,
            priorityRanking
          },
          {
            onToken: (token) => {
            setMessages((prev) =>
              prev.map((item) =>
                  item.id === assistantId
                    ? { ...item, text: formatStructuredSections(sanitizePlainText(`${item.text}${token}`)) }
                    : item
              )
            );
            },
            onSources: (sources) => {
              setMessages((prev) => prev.map((item) => (item.id === assistantId ? { ...item, sources } : item)));
            }
          }
        );

        setMessages((prev) => prev.map((item) => (item.id === assistantId ? { ...item, pending: false } : item)));
      }
    } catch (error) {
      const noRecentNews = String(error?.message || '').includes('no_recent_news');
      const fallback = noRecentNews
        ? '近7天（UTC+8）暂无可用于总结的新闻标题，请稍后再试或先检查新闻抓取状态。'
        : isSample
          ? buildSampleQuestionAnswer(
              question,
              normalizeDailyBrief(latestBrief) || {
                headline: '外部信号分散，先执行最小可逆动作',
                oneLiner: '当前优先稳住支付与转化基本盘，再依据内部指标扩大动作。',
                topDrivers: [],
                impacts: {},
                actions: [],
                citations: [],
                stats: {}
              },
              news
            )
          : buildFallbackAnswer(question, scoreBreakdown, priorityRanking);
      const fallbackText = typeof fallback === 'string' ? fallback : fallback.text;
      const fallbackSources = typeof fallback === 'string' ? [] : fallback.sources;

      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text:
                  isSummaryQuestion
                    ? formatExecutiveSummaryText(item.text || fallbackText)
                    : formatStructuredSections(sanitizePlainText(item.text || fallbackText)),
                sources: item.sources && item.sources.length > 0 ? item.sources : fallbackSources,
                pending: false,
                error: noRecentNews && !isSample ? '' : isSample ? '' : 'AI 服务暂不可用，已返回规则引擎兜底建议。'
              }
            : item
        )
      );
    }
  };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-950/70" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md animate-[slideIn_220ms_ease-out] border-l border-cyan-300/20 bg-slate-950/95 p-5 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">🧠 向 AI 询问战略问题</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            关闭
          </button>
        </div>

        <div className="h-[calc(100vh-7rem)] overflow-y-auto pr-1">
          <div className="mt-4 space-y-2">
            {FIXED_SAMPLE_QUESTIONS.map((question) => (
              <button
                key={question.id}
                type="button"
                onClick={() => submitQuestion(question.text, { isSample: true, sampleId: question.id })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
              >
                {question.text}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {messages.map((message) => (
              <AssistantBubble key={message.id} message={message} onOpenEvidence={onOpenEvidence} />
            ))}
          </div>

          <div className="mt-5 flex gap-2 rounded-xl border border-slate-700 bg-slate-950/60 p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitQuestion(input);
              }}
              placeholder="输入你的战略问题..."
              className="w-full bg-transparent px-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => submitQuestion(input)}
              className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-cyan-400"
            >
              发送
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default AIAssistantPanel;
