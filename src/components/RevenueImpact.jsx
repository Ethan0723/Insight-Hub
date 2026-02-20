import { revenueAnalysis } from '../data/strategicMockData';

function TinyBars({ values, formatter = (v) => v }) {
  const max = Math.max(...values);

  return (
    <div>
      <div className="flex h-24 items-end gap-2">
        {values.map((value, idx) => (
          <div key={`${value}-${idx}`} className="flex-1">
            <div
              className="rounded-t-md bg-gradient-to-t from-blue-500/70 to-cyan-300/80"
              style={{ height: `${(value / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-500">
        {revenueAnalysis.labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">最新值: {formatter(values[values.length - 1])}</p>
    </div>
  );
}

function RevenueImpact() {
  return (
    <section className="rounded-3xl border border-blue-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100 lg:text-2xl">收入模型影响分析</h2>
        <span className="rounded-full border border-blue-300/30 bg-blue-300/10 px-3 py-1 text-xs text-blue-200">
          SaaS 收入结构洞察
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
          <p className="mb-3 text-sm text-slate-300">订阅收入风险趋势</p>
          <TinyBars values={revenueAnalysis.subscriptionRiskTrend} formatter={(v) => `${v}%`} />
        </article>

        <article className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
          <p className="mb-3 text-sm text-slate-300">佣金收入敏感度分析</p>
          <TinyBars values={revenueAnalysis.commissionSensitivity} formatter={(v) => `${v}%`} />
        </article>

        <article className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
          <p className="mb-3 text-sm text-slate-300">支付费率影响模拟</p>
          <TinyBars values={revenueAnalysis.paymentRateSimulation} formatter={(v) => `${v}%`} />
        </article>

        <article className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
          <p className="mb-3 text-sm text-slate-300">Churn 风险变化预测</p>
          <TinyBars values={revenueAnalysis.churnPrediction} formatter={(v) => `${v}%`} />
        </article>
      </div>
    </section>
  );
}

export default RevenueImpact;
