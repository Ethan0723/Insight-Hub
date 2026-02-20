function CompetitionMatrix({ competitors, news, aiInterpretation, onOpenReferences }) {
  const getPlatformNewsIds = (platform) =>
    news.filter((item) => item.platform === platform).map((item) => item.id);

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
          <div className="grid grid-cols-6 bg-slate-900 px-4 py-3 text-xs text-slate-400">
            <span>平台</span>
            <span>本周关键动作</span>
            <span>财报亮点</span>
            <span>产品更新</span>
            <span>AI 动态</span>
            <span>引用新闻</span>
          </div>

          <div className="divide-y divide-slate-800 bg-slate-950/60">
            {competitors.map((item) => {
              const ids = getPlatformNewsIds(item.name);
              return (
                <div key={item.name} className="grid grid-cols-6 gap-3 px-4 py-4 text-xs text-slate-200">
                  <p className="font-semibold text-cyan-200">{item.name}</p>
                  <p>{item.weeklyMove}</p>
                  <p>{item.earningsHighlight}</p>
                  <p>{item.productUpdate}</p>
                  <p>{item.aiUpdate}</p>
                  <div>
                    <p className="mb-2 text-slate-400">{ids.length} 条</p>
                    <button
                      type="button"
                      onClick={() => onOpenReferences(`${item.name} 关联新闻来源`, ids)}
                      className="rounded-lg border border-slate-600 px-2 py-1 text-[11px] hover:border-cyan-300/40 hover:text-cyan-200"
                    >
                      查看新闻来源
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <article className="rounded-2xl border border-cyan-300/30 bg-cyan-400/5 p-4">
          <p className="mb-3 text-sm text-cyan-200">AI 战略解读</p>
          <p className="text-sm leading-7 text-slate-100">
            {aiInterpretation}
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
