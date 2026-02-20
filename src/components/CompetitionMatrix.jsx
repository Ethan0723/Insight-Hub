import { competitors } from '../data/strategicMockData';

function CompetitionMatrix() {
  return (
    <section className="rounded-3xl border border-indigo-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100 lg:text-2xl">竞争动态矩阵</h2>
        <span className="rounded-full border border-indigo-300/30 bg-indigo-300/10 px-3 py-1 text-xs text-indigo-200">
          Top 5 平台
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-700/70">
          <div className="grid grid-cols-5 bg-slate-900 px-4 py-3 text-xs text-slate-400">
            <span>平台</span>
            <span>本周关键动作</span>
            <span>财报亮点</span>
            <span>产品更新</span>
            <span>AI 动态</span>
          </div>

          <div className="divide-y divide-slate-800 bg-slate-950/60">
            {competitors.map((item) => (
              <div key={item.name} className="grid grid-cols-5 gap-3 px-4 py-4 text-xs text-slate-200">
                <p className="font-semibold text-cyan-200">{item.name}</p>
                <p>{item.weeklyMove}</p>
                <p>{item.earningsHighlight}</p>
                <p>{item.productUpdate}</p>
                <p>{item.aiUpdate}</p>
              </div>
            ))}
          </div>
        </div>

        <article className="rounded-2xl border border-cyan-300/30 bg-cyan-400/5 p-4">
          <p className="mb-3 text-sm text-cyan-200">AI 战略解读</p>
          <p className="text-sm leading-7 text-slate-100">
            Shopify 强化 AI 商家运营工具，意味着 SaaS 平台竞争将转向 AI 自动化能力。未来 2-3 个季度，
            平台的差异化将从“模板功能”转为“AI 协同效率 + 生态整合速度”。
          </p>
          <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3 text-xs text-slate-300">
            结论：建议将产品路线图重心迁移到 AI 运营工作流、智能投放协同与生态闭环指标。
          </div>
        </article>
      </div>
    </section>
  );
}

export default CompetitionMatrix;
