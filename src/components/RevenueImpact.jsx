import { useMemo } from 'react';

function TrendChart({ labels, base, adjusted }) {
  const max = Math.max(...base, ...adjusted);
  const min = Math.min(...base, ...adjusted);
  const range = max - min || 1;

  const toPath = (arr) =>
    arr
      .map((value, idx) => {
        const x = (idx / (arr.length - 1)) * 100;
        const y = 100 - ((value - min) / range) * 100;
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
      <svg viewBox="0 0 100 100" className="h-40 w-full">
        <path d={toPath(base)} fill="none" stroke="rgb(100,116,139)" strokeWidth="2" strokeDasharray="2 2" />
        <path d={toPath(adjusted)} fill="none" stroke="rgb(34,211,238)" strokeWidth="2.5" />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-slate-500">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs">
        <span className="text-slate-400">灰线: 基线</span>
        <span className="text-cyan-200">蓝线: 当前参数</span>
      </div>
    </div>
  );
}

function RevenueImpact({ scenario, onScenarioChange, result, onOpenEvidence }) {
  const sliders = useMemo(
    () => [
      {
        key: 'arpuDelta',
        label: '订阅 ARPU 调整',
        min: -10,
        max: 10,
        step: 0.5,
        value: scenario.arpuDelta
      },
      {
        key: 'commissionDelta',
        label: '佣金率调整 (pp)',
        min: -0.2,
        max: 0.2,
        step: 0.01,
        value: scenario.commissionDelta
      },
      {
        key: 'paymentSuccessDelta',
        label: '支付成功率调整 (pp)',
        min: -5,
        max: 5,
        step: 0.5,
        value: scenario.paymentSuccessDelta
      }
    ],
    [scenario]
  );

  const formatSliderValue = (key, rawValue) => {
    if (key === 'commissionDelta') return `${rawValue.toFixed(2)}pp`;
    return `${rawValue.toFixed(1)}%`;
  };

  return (
    <section className="rounded-3xl border border-blue-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100 lg:text-2xl">收入影响沙盘</h2>
        <button
          type="button"
          onClick={() => onOpenEvidence(result.evidence)}
          className="rounded-full border border-blue-300/35 bg-blue-300/10 px-3 py-1 text-xs text-blue-200"
        >
          数据接口: {result.endpoint} · 查看引用新闻
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <article className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
          <p className="mb-4 text-sm text-slate-300">参数调节</p>
          <div className="space-y-4">
            {sliders.map((item) => (
              <div key={item.key}>
                <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                  <span>{item.label}</span>
                  <span className="text-cyan-200">{formatSliderValue(item.key, Number(item.value))}</span>
                </div>
                <input
                  type="range"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={item.value}
                  onChange={(e) => onScenarioChange(item.key, Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-slate-400">GMV 影响区间</p>
              <p className="mt-1 text-cyan-200">{result.outputs.gmv}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-slate-400">订阅影响</p>
              <p className="mt-1 text-cyan-200">{result.outputs.subscription}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-slate-400">佣金影响</p>
              <p className="mt-1 text-cyan-200">{result.outputs.commission}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-slate-400">支付成本变化</p>
              <p className="mt-1 text-cyan-200">{result.outputs.paymentCost}</p>
            </div>
          </div>
        </article>

        <article className="space-y-4">
          <TrendChart labels={result.labels} base={result.baseTrend} adjusted={result.adjustedTrend} />
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-200">
            {result.explanation}
          </div>
        </article>
      </div>

      <article className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4">
        <p className="mb-3 text-sm font-medium text-cyan-200">收入影响解释面板</p>
        <div className="grid gap-3 md:grid-cols-2">
          {result.dimensions.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-100">{item.name}</p>
                <span className="text-xs text-cyan-200">评分: {item.score}</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">影响来源新闻数量: {item.evidence.newsIds.length}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">敏感度说明: {item.sensitivity}</p>
              <button
                type="button"
                onClick={() => onOpenEvidence(item.evidence)}
                className="mt-3 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
              >
                点击查看来源新闻
              </button>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

export default RevenueImpact;
