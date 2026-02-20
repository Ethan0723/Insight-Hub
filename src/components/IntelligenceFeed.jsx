import { intelligenceFeed } from '../data/strategicMockData';

const riskColorMap = {
  高: 'text-rose-300 border-rose-300/40 bg-rose-300/10',
  中高: 'text-orange-300 border-orange-300/40 bg-orange-300/10',
  中: 'text-amber-200 border-amber-300/40 bg-amber-300/10',
  低: 'text-emerald-300 border-emerald-300/40 bg-emerald-300/10'
};

function IntelligenceFeed() {
  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100 lg:text-2xl">📡 战略输入情报流</h2>
        <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
          High Impact 8 条
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {intelligenceFeed.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 transition duration-300 hover:border-cyan-300/40 hover:shadow-[0_0_25px_rgba(34,211,238,0.12)]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">{item.source}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  riskColorMap[item.riskLevel] || 'text-slate-200 border-slate-400/40 bg-slate-600/20'
                }`}
              >
                风险等级: {item.riskLevel}
              </span>
            </div>

            <h3 className="text-base font-medium leading-6 text-slate-100">{item.title}</h3>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-blue-300/30 bg-blue-300/10 px-2 py-1 text-blue-200">
                影响维度: {item.dimensionTag}
              </span>
              <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-2 py-1 text-fuchsia-200">
                战略影响评分: {item.impactScore}
              </span>
            </div>

            <div className="mt-4 space-y-1 text-xs text-slate-300">
              <p>被引用指数: {item.referencedIndex}</p>
              <p>收入模型影响: {item.revenueImpact}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default IntelligenceFeed;
