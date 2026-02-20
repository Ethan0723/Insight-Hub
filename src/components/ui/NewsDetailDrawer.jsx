function NewsDetailDrawer({ open, news, onClose }) {
  if (!open || !news) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/70" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl animate-[slideIn_220ms_ease-out] overflow-y-auto border-l border-cyan-300/20 bg-slate-950/95 p-6 backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-100">新闻战略详情</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            关闭
          </button>
        </div>

        <article className="space-y-4 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
          <div>
            <p className="text-xs text-slate-400">{news.source} · {news.publish_date}</p>
            <h4 className="mt-2 text-xl font-semibold leading-8 text-slate-100">{news.title}</h4>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2.5 py-1 text-cyan-200">
              平台: {news.platform}
            </span>
            <span className="rounded-full border border-fuchsia-300/40 bg-fuchsia-300/10 px-2.5 py-1 text-fuchsia-200">
              战略影响评分: {news.impact_score}
            </span>
            <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-amber-200">
              风险等级: {news.risk_level}
            </span>
          </div>

          <section>
            <p className="text-sm font-medium text-cyan-200">完整 AI 战略分析</p>
            <p className="mt-2 text-sm leading-7 text-slate-200">{news.full_analysis}</p>
          </section>

          <section>
            <p className="text-sm font-medium text-cyan-200">收入影响路径</p>
            <p className="mt-2 text-sm leading-7 text-slate-200">{news.revenue_path}</p>
          </section>

          <section>
            <p className="text-sm font-medium text-cyan-200">影响维度</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {news.impact_dimension.map((tag) => (
                <span key={tag} className="rounded-full border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-200">
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-xs text-slate-400">被哪些指数引用</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {news.referenced_indexes.map((item) => (
                  <span key={item} className="rounded-full border border-blue-300/35 bg-blue-300/10 px-2 py-1 text-xs text-blue-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-xs text-slate-400">被哪些竞争矩阵引用</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {news.referenced_competitors.map((item) => (
                  <span key={item} className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div className="pt-2">
            <a
              href={news.original_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
            >
              查看原文
            </a>
          </div>
        </article>
      </aside>
    </div>
  );
}

export default NewsDetailDrawer;
