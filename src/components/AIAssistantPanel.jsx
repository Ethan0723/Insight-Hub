import { useMemo, useState } from 'react';
import { streamAiChat, streamNewsSummary } from '../services/ai';

const DIMENSION_META = {
  subscription: { label: '订阅价格', short: '模板订阅' },
  commission: { label: '佣金结构', short: '商家运营服务' },
  payment: { label: '支付链路', short: '支付与收单' },
  ecosystem: { label: '生态扩展', short: '生态协同' }
};

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

        <div className="whitespace-pre-wrap text-sm leading-6 text-slate-100">{message.text || (message.pending ? '正在基于当前评分与暴露矩阵生成策略回答...' : '')}</div>

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

function AIAssistantPanel({ data, open, onClose, scoreBreakdown, news, onOpenEvidence }) {
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

  const exposureMatrix = useMemo(() => buildExposureMatrix(scoreBreakdown), [scoreBreakdown]);
  const priorityRanking = useMemo(() => buildPriorityRanking(exposureMatrix), [exposureMatrix]);
  const structure = useMemo(
    () => buildReasoningStructure(scoreBreakdown, exposureMatrix, priorityRanking, news),
    [scoreBreakdown, exposureMatrix, priorityRanking, news]
  );

  if (!open) return null;

  const submitQuestion = async (rawQuestion) => {
    const question = String(rawQuestion || '').trim();
    if (!question) return;

    const userMessage = { id: `u-${Date.now()}`, role: 'user', text: question };
    const assistantId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: 'assistant',
        text: '',
        structure,
        pending: true,
        error: ''
      }
    ]);
    setInput('');

    try {
      if (isNewsSummaryQuestion(question)) {
        const newsItems = pickRecentNewsItems(news, 7, 12);
        if (newsItems.length === 0) {
          throw new Error('no_recent_news');
        }
        await streamNewsSummary(newsItems, {
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((item) => (item.id === assistantId ? { ...item, text: `${item.text}${token}` } : item))
            );
          }
        });
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
                prev.map((item) => (item.id === assistantId ? { ...item, text: `${item.text}${token}` } : item))
              );
            }
          }
        );
      }

      setMessages((prev) =>
        prev.map((item) => (item.id === assistantId ? { ...item, pending: false } : item))
      );
    } catch (error) {
      const noRecentNews = String(error?.message || '').includes('no_recent_news');
      const fallback = noRecentNews
        ? '近7天（UTC+8）暂无可用于总结的新闻标题，请稍后再试或先检查新闻抓取状态。'
        : buildFallbackAnswer(question, scoreBreakdown, priorityRanking);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text: item.text || fallback,
                pending: false,
                error: noRecentNews ? '' : 'AI 服务暂不可用，已返回规则引擎兜底建议。'
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
            {(data.samples || []).map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => submitQuestion(question)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
              >
                {question}
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
