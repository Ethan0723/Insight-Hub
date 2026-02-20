function NewsDetailDrawer({ open, news, relatedNews, onClose, onOpenNews }) {
  if (!open || !news) return null;

  const dimMap = [
    ['订阅', news.why.subscription],
    ['佣金', news.why.commission],
    ['支付', news.why.payment],
    ['生态', news.why.ecosystem]
  ];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/70" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-3xl animate-[slideIn_220ms_ease-out] overflow-y-auto border-l border-cyan-300/20 bg-slate-950/95 p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-100">新闻详情</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            关闭
          </button>
        </div>

        <article className="space-y-4 rounded-2xl border border-slate-700/70 bg-slate-900/65 p-5">
          <div>
            <p className="text-xs text-slate-400">
              {news.source} · {news.publishDate}
            </p>
            <h4 className="mt-2 text-xl font-semibold leading-8 text-slate-100">{news.title}</h4>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-200">
              平台: {news.platform}
            </span>
            <span className="rounded-full border border-slate-600 bg-slate-950 px-2.5 py-1 text-xs text-slate-200">
              地区: {news.region}
            </span>
            <span className="rounded-full border border-fuchsia-300/35 bg-fuchsia-300/10 px-2.5 py-1 text-xs text-fuchsia-200">
              影响评分: {news.impactScore}
            </span>
            <span className="rounded-full border border-amber-300/35 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-200">
              风险: {news.riskLevel}
            </span>
          </div>

          <section>
            <p className="text-sm font-medium text-cyan-200">AI TL;DR</p>
            <p className="mt-1 text-sm text-slate-200">{news.aiTldr}</p>
          </section>

          <section>
            <p className="text-sm font-medium text-cyan-200">AI 解读（Why）</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {dimMap.map(([dim, val]) => (
                <div key={dim} className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-400">{dim}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-200">{val || '暂无直接影响'}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="text-sm font-medium text-cyan-200">建议动作</p>
            <div className="mt-2 space-y-2">
              {news.actions.map((action) => (
                <div key={`${action.priority}-${action.text}`} className="rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-200">
                  <span className="mr-2 text-cyan-200">{action.priority}</span>
                  <span className="mr-2 text-slate-400">Owner: {action.owner}</span>
                  <span>{action.text}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="text-sm font-medium text-cyan-200">影响维度 / 标签</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {news.impactDimensions.map((dim) => (
                <span key={dim} className="rounded-full border border-blue-300/35 bg-blue-300/10 px-2 py-1 text-blue-200">
                  {dim}
                </span>
              ))}
              {news.moduleTags.map((tag) => (
                <span key={tag} className="rounded-full border border-slate-600 bg-slate-950 px-2 py-1 text-slate-200">
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <div className="pt-1">
            <a
              href={news.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
            >
              查看原文
            </a>
          </div>
        </article>

        <section className="mt-5 rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4">
          <p className="text-sm font-medium text-cyan-200">关联新闻</p>
          <div className="mt-3 space-y-2">
            {relatedNews.length === 0 ? (
              <p className="text-xs text-slate-400">暂无关联新闻</p>
            ) : (
              relatedNews.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenNews(item.id)}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-left text-xs text-slate-200 hover:border-cyan-300/40"
                >
                  <p className="text-slate-400">{item.platform} · {item.region}</p>
                  <p className="mt-1">{item.title}</p>
                </button>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

export default NewsDetailDrawer;
