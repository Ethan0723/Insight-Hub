import MethodPopover from './ui/MethodPopover';

function Sparkline({ points }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const d = points
    .map((value, idx) => {
      const x = (idx / (points.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
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
  const finalOverall = scoreBreakdown?.final?.overall ?? insight.impactScore;

  return (
    <section className="rounded-3xl border border-fuchsia-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100 lg:text-2xl">战略影响推理引擎</h2>
        <div className="flex items-center gap-2">
          <MethodPopover />
          <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 py-1 text-xs text-fuchsia-200">
            最近更新: {insight.updatedAt}
          </span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 lg:p-5">
          <p className="mb-4 text-sm text-slate-400">可点击因果链（查看节点证据）</p>
          <div className="flex flex-wrap items-center gap-3">
            {insight.reasoningNodes.map((node, index) => (
              <div key={node.id} className="flex items-center gap-3">
                <button
                  type="button"
                  title={`引用新闻 ${node.evidence.newsIds.length} 条`}
                  onClick={() => onOpenEvidence(node.evidence)}
                  className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/40"
                >
                  <p>{node.text}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{node.explain}</p>
                </button>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-1">
                  <Sparkline points={node.trend7d} />
                </div>
                <span className="text-xs text-slate-400">{node.evidence.newsIds.length} 条</span>
                {index < insight.reasoningNodes.length - 1 ? <span className="text-cyan-300">→</span> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <article className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-400">影响评分</p>
            <p className="mt-2 text-4xl font-semibold text-cyan-200">{finalOverall}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Baseline {scoreBreakdown?.baseline?.overall ?? insight.impactScore} / Δ {formatDelta(scoreBreakdown?.delta?.overall ?? 0)} / Final{' '}
              {finalOverall}
            </p>
            <p className="mt-2 text-xs text-slate-500">0-100 越高表示对收入模型扰动越大</p>
          </article>

          <article className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
            <p className="mb-3 text-xs text-slate-400">影响维度</p>
            <div className="space-y-2">
              {insight.dimensions.map((item) => (
                <div key={item.name}>
                  {(() => {
                    const key = dimNameToKey[item.name];
                    const baselineScore = scoreBreakdown?.baseline?.[key] ?? item.score;
                    const deltaScore = scoreBreakdown?.delta?.[key] ?? 0;
                    const finalScore = scoreBreakdown?.final?.[key] ?? item.score;
                    return (
                      <>
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
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>

      <article className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
        <p className="mb-2 text-sm text-amber-200">建议优先级</p>
        <div className="space-y-2 text-sm text-slate-200">
          {insight.priorities.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </article>
    </section>
  );
}

export default ReasoningEngine;
