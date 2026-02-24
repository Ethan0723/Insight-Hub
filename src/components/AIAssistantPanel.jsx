import { useMemo, useState } from 'react';

const DIMENSION_META = {
  subscription: { label: '订阅价格', short: '模板订阅' },
  commission: { label: '佣金结构', short: '商家运营服务' },
  payment: { label: '支付链路', short: '支付与收单' },
  ecosystem: { label: '生态扩展', short: '生态协同' }
};

function riskLabel(score) {
  if (score >= 75) return '高';
  if (score >= 60) return '中高';
  if (score >= 45) return '中';
  return '低';
}

function timeWindowByRisk(score) {
  if (score >= 75) return '6-12 个月进入加速影响期';
  if (score >= 60) return '12-18 个月形成持续影响';
  if (score >= 45) return '18-24 个月逐步显现';
  return '当前影响有限，以观察为主';
}

function pickFocusDimension(question, scoreBreakdown) {
  const q = String(question || '').toLowerCase();
  if (q.includes('支付')) return 'payment';
  if (q.includes('佣金')) return 'commission';
  if (q.includes('订阅') || q.includes('arpu')) return 'subscription';
  if (q.includes('生态') || q.includes('ai') || q.includes('agent')) return 'ecosystem';

  const final = scoreBreakdown?.final || {};
  return ['subscription', 'commission', 'payment', 'ecosystem']
    .sort((a, b) => (final?.[b] || 0) - (final?.[a] || 0))[0];
}

function buildAssistantResponse(question, { scoreBreakdown, insight, revenueResult, news }) {
  const focus = pickFocusDimension(question, scoreBreakdown);
  const finalOverall = scoreBreakdown?.final?.overall ?? 0;
  const focusFinal = scoreBreakdown?.final?.[focus] ?? 0;
  const focusBaseline = scoreBreakdown?.baseline?.[focus] ?? 0;
  const focusDelta = scoreBreakdown?.delta?.[focus] ?? 0;
  const affectedModules = [DIMENSION_META[focus].short];

  const sortedDims = ['subscription', 'commission', 'payment', 'ecosystem'].sort(
    (a, b) => (scoreBreakdown?.final?.[b] || 0) - (scoreBreakdown?.final?.[a] || 0)
  );
  sortedDims.slice(0, 2).forEach((dim) => {
    const tag = DIMENSION_META[dim].short;
    if (!affectedModules.includes(tag)) affectedModules.push(tag);
  });

  const evidenceIds = scoreBreakdown?.evidence?.[focus] || revenueResult?.evidence?.newsIds || [];
  const newsMap = new Map((news || []).map((item) => [item.id, item]));
  const evidenceTitles = evidenceIds.map((id) => newsMap.get(id)?.title).filter(Boolean).slice(0, 3);

  const strategy = [
    `优先修复${DIMENSION_META[focus].label}的高暴露环节，建立周度监控阈值。`,
    `将${DIMENSION_META[focus].label}相关策略拆成短周期实验，按 Final 变化滚动复盘。`,
    insight?.priorities?.[0] || '强化高风险维度治理，降低收入模型波动。'
  ];

  return {
    question,
    threatLevel: `${riskLabel(focusFinal)}（${focusFinal}/100）`,
    timeWindow: timeWindowByRisk(focusFinal),
    affectedModules,
    strategy,
    explain: {
      baseline: focusBaseline,
      delta: focusDelta,
      final: focusFinal,
      overall: finalOverall
    },
    evidence: {
      focus,
      ids: evidenceIds,
      titles: evidenceTitles
    }
  };
}

function AssistantCard({ answer, onOpenEvidence }) {
  return (
    <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/5 p-4">
      <p className="text-sm font-medium text-cyan-200">结构化回答</p>
      <div className="mt-3 space-y-2 text-xs text-slate-200">
        <p>
          <span className="text-slate-400">威胁等级：</span>
          {answer.threatLevel}
        </p>
        <p>
          <span className="text-slate-400">时间窗口：</span>
          {answer.timeWindow}
        </p>
        <p>
          <span className="text-slate-400">评分拆解：</span>
          Baseline {answer.explain.baseline} / Δ {answer.explain.delta > 0 ? `+${answer.explain.delta}` : answer.explain.delta} / Final{' '}
          {answer.explain.final}
        </p>
        <p className="text-slate-400">受影响业务模块：</p>
        <div className="flex flex-wrap gap-2">
          {answer.affectedModules.map((item) => (
            <span key={item} className="rounded-full border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
              {item}
            </span>
          ))}
        </div>
        <p className="pt-1 text-slate-400">建议战略方向：</p>
        <div className="space-y-2 text-[11px] text-slate-200">
          {answer.strategy.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        {answer.evidence.titles.length > 0 ? (
          <>
            <p className="pt-1 text-slate-400">引用新闻：</p>
            <div className="space-y-1 text-[11px] text-slate-300">
              {answer.evidence.titles.map((item) => (
                <p key={item}>- {item}</p>
              ))}
            </div>
          </>
        ) : null}
        <button
          type="button"
          onClick={() =>
            onOpenEvidence({
              id: `ev-ai-${answer.evidence.focus}`,
              title: `AI 助手引用 · ${DIMENSION_META[answer.evidence.focus]?.label || '维度'}`,
              newsIds: answer.evidence.ids
            })
          }
          className="mt-2 rounded-lg border border-slate-600 px-3 py-1.5 text-[11px] text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
        >
          查看引用证据
        </button>
      </div>
    </div>
  );
}

function AIAssistantPanel({ data, open, onClose, insight, scoreBreakdown, revenueResult, news, onOpenEvidence }) {
  const [input, setInput] = useState('');
  const initialAnswer = useMemo(
    () =>
      buildAssistantResponse(data.samples?.[0] || '当前风险优先处理什么？', {
        scoreBreakdown,
        insight,
        revenueResult,
        news
      }),
    [data.samples, scoreBreakdown, insight, revenueResult, news]
  );
  const [messages, setMessages] = useState([{ role: 'assistant', answer: initialAnswer }]);

  if (!open) return null;

  const submitQuestion = (question) => {
    const text = String(question || '').trim();
    if (!text) return;
    const answer = buildAssistantResponse(text, { scoreBreakdown, insight, revenueResult, news });
    setMessages((prev) => [...prev, { role: 'user', text }, { role: 'assistant', answer }]);
    setInput('');
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
            {messages.map((message, index) => {
              if (message.role === 'user') {
                return (
                  <div key={`u-${index}`} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                    {message.text}
                  </div>
                );
              }
              return <AssistantCard key={`a-${index}`} answer={message.answer} onOpenEvidence={onOpenEvidence} />;
            })}
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
