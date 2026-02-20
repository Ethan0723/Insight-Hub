import { reasoningEngine } from '../data/strategicMockData';

function ReasoningEngine() {
  return (
    <section className="rounded-3xl border border-fuchsia-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100 lg:text-2xl">战略影响推理引擎</h2>
        <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 py-1 text-xs text-fuchsia-200">
          AI 因果链推理
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 lg:p-5">
          <p className="mb-4 text-sm text-slate-400">情报转战略路径</p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {reasoningEngine.chain.map((node, index) => (
              <div key={node} className="flex items-center gap-3">
                <div className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                  {node}
                </div>
                {index < reasoningEngine.chain.length - 1 ? (
                  <span className="text-cyan-300">→</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <article className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
            <p className="text-xs text-slate-400">影响评分</p>
            <p className="mt-2 text-4xl font-semibold text-cyan-200">{reasoningEngine.impactScore}</p>
            <p className="mt-2 text-xs text-slate-500">0-100 越高表示对收入模型扰动越大</p>
          </article>

          <article className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
            <p className="mb-3 text-xs text-slate-400">影响维度</p>
            <div className="space-y-2">
              {reasoningEngine.dimensions.map((item) => (
                <div key={item.name}>
                  <div className="mb-1 flex justify-between text-xs text-slate-300">
                    <span>{item.name}</span>
                    <span>{item.score}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>

      <article className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
        <p className="mb-2 text-sm text-amber-200">建议优先级</p>
        <div className="space-y-2 text-sm text-slate-200">
          {reasoningEngine.priority.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </article>
    </section>
  );
}

export default ReasoningEngine;
