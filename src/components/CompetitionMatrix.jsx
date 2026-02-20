function CompetitionMatrix({ rows, onOpenEvidence, onOpenLibraryByIds }) {
  return (
    <section className="rounded-3xl border border-indigo-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100 lg:text-2xl">竞争动态矩阵</h2>
        <span className="rounded-full border border-indigo-300/30 bg-indigo-300/10 px-3 py-1 text-xs text-indigo-200">
          可溯源竞争情报
        </span>
      </div>

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
          {rows.map((item) => (
            <div key={item.name} className="grid grid-cols-6 gap-3 px-4 py-4 text-xs text-slate-200">
              <p className="font-semibold text-cyan-200">{item.name}</p>
              <p>{item.weeklyMove}</p>
              <p>{item.earningsHighlight}</p>
              <p>{item.productUpdate}</p>
              <p>{item.aiUpdate}</p>
              <div className="space-y-2">
                <p className="text-slate-400">{item.evidence.newsIds.length} 条</p>
                <button
                  type="button"
                  onClick={() => onOpenEvidence(item.evidence)}
                  className="rounded-lg border border-slate-600 px-2 py-1 text-[11px] hover:border-cyan-300/40 hover:text-cyan-200"
                >
                  查看新闻来源
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLibraryByIds(item.evidence.newsIds)}
                  className="rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-300/20"
                >
                  去新闻库
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CompetitionMatrix;
