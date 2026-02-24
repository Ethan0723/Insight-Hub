import { useMemo, useState } from 'react';

function Sparkline({ points }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const d = points
    .map((value, idx) => {
      const denominator = Math.max(points.length - 1, 1);
      const x = (idx / denominator) * 100;
      const normalized = (value - min) / range;
      const y = 94 - normalized * 88;
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" className="h-9 w-20">
      <path d={d} fill="none" stroke="rgb(34,211,238)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const dimNameToKey = {
  订阅: 'subscription',
  佣金: 'commission',
  支付: 'payment',
  生态: 'ecosystem'
};

function formatDelta(value) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function ReasoningEngine({ insight, scoreBreakdown, onOpenEvidence }) {
  const [expanded, setExpanded] = useState(false);
  const finalOverall = scoreBreakdown?.final?.overall ?? insight.impactScore;
  const baselineOverall = scoreBreakdown?.baseline?.overall ?? insight.impactScore;
  const deltaOverall = scoreBreakdown?.delta?.overall ?? 0;

  const signalCount = useMemo(() => {
    const set = new Set();
    insight.reasoningNodes.forEach((node) => node.evidence.newsIds.forEach((id) => set.add(id)));
    return set.size;
  }, [insight.reasoningNodes]);

  return (
    <section className="rounded-3xl border border-slate-700/60 bg-slate-900/45 p-4 backdrop-blur-xl lg:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 lg:text-xl">外部信号引擎（Baseline 计算层）</h2>
          <p className="mt-1 text-xs text-slate-400">新闻信号 → 维度评分 → Baseline 风险分</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1 text-xs text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            {expanded ? '收起模型逻辑' : '查看模型逻辑'}
          </button>
          <span className="rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
            最近更新: {insight.updatedAt}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-slate-700/60 bg-slate-950/55 p-3">
          <p className="text-[11px] text-slate-400">Final</p>
          <p className="mt-1 text-xl font-semibold text-cyan-200">{finalOverall}</p>
          <p className="text-[11px] text-slate-500">
            Baseline {baselineOverall} / Δ {formatDelta(deltaOverall)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-700/60 bg-slate-950/55 p-3">
          <p className="text-[11px] text-slate-400">信号节点</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{insight.reasoningNodes.length}</p>
          <p className="text-[11px] text-slate-500">可点击节点查看证据</p>
        </div>
        <div className="rounded-xl border border-slate-700/60 bg-slate-950/55 p-3">
          <p className="text-[11px] text-slate-400">去重信号新闻</p>
          <p className="mt-1 text-xl font-semibold text-slate-100">{signalCount}</p>
          <p className="text-[11px] text-slate-500">作为 Baseline 外部输入</p>
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${
          expanded ? 'mt-4 max-h-[2200px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <article className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-4">
          <p className="mb-2 text-sm font-medium text-cyan-200">模型口径说明</p>
          <div className="grid gap-2 text-xs text-slate-300 md:grid-cols-3">
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-2">
              <p className="text-slate-400">Baseline</p>
              <p>外部新闻与政策信号评分</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-2">
              <p className="text-slate-400">Delta</p>
              <p>内部策略模拟影响</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-2">
              <p className="text-slate-400">Final</p>
              <p>Baseline + Delta（用于决策）</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">系统并非黑箱评分，而是外部态势与内部策略叠加模型。</p>
        </article>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/55 p-4">
            <p className="mb-3 text-sm text-slate-300">可点击因果链（外部信号层）</p>
            <div className="space-y-2">
              {insight.reasoningNodes.map((node, index) => (
                <div key={node.id} className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    title={`引用新闻 ${node.evidence.newsIds.length} 条`}
                    onClick={() => onOpenEvidence(node.evidence)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:border-cyan-300/40"
                  >
                    <p>{node.text}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{node.explain}</p>
                  </button>
                  <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-1">
                    <Sparkline points={node.trend7d} />
                  </div>
                  <span className="text-[11px] text-slate-400">{node.evidence.newsIds.length} 条</span>
                  {index < insight.reasoningNodes.length - 1 ? <span className="text-cyan-300">→</span> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <article className="rounded-2xl border border-slate-700/60 bg-slate-950/55 p-4">
              <p className="mb-2 text-xs text-slate-400">维度评分拆解（Final 展示）</p>
              <div className="space-y-2">
                {insight.dimensions.map((item) => {
                  const key = dimNameToKey[item.name];
                  const baselineScore = scoreBreakdown?.baseline?.[key] ?? item.score;
                  const deltaScore = scoreBreakdown?.delta?.[key] ?? 0;
                  const finalScore = scoreBreakdown?.final?.[key] ?? item.score;
                  return (
                    <div key={item.name}>
                      <div className="mb-1 flex justify-between text-xs text-slate-300">
                        <span>{item.name}</span>
                        <button
                          type="button"
                          title={`Baseline ${baselineScore} / Δ ${formatDelta(deltaScore)} / Final ${finalScore}`}
                          onClick={() => onOpenEvidence(item.evidence)}
                          className="text-cyan-200 hover:underline"
                        >
                          {finalScore} · 证据
                        </button>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${finalScore}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-700/60 bg-slate-950/55 p-4">
              <p className="mb-2 text-xs text-slate-400">Baseline 来源与信号数量</p>
              <div className="space-y-1.5 text-xs text-slate-300">
                {insight.indexes.map((idx) => (
                  <div key={idx.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5">
                    <span>{idx.name}</span>
                    <button
                      type="button"
                      onClick={() => onOpenEvidence(idx.evidence)}
                      className="text-cyan-200 hover:underline"
                    >
                      {idx.evidence.newsIds.length} 条
                    </button>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ReasoningEngine;
