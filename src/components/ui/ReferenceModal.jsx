function ReferenceModal({ open, title, newsList, onClose, onSelectNews }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-3xl animate-[fadeIn_180ms_ease-out] rounded-2xl border border-cyan-300/25 bg-slate-900 p-5 shadow-[0_0_45px_rgba(34,211,238,0.18)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            关闭
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {newsList.length === 0 ? (
            <p className="text-sm text-slate-400">暂无引用新闻。</p>
          ) : (
            newsList.map((news) => (
              <article key={news.id} className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-400">{news.source} · {news.publish_date}</p>
                <h4 className="mt-2 text-sm font-medium text-slate-100">{news.title}</h4>
                <p className="mt-2 text-xs text-slate-300 line-clamp-2">{news.ai_summary}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectNews(news)}
                    className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-cyan-400"
                  >
                    查看详情
                  </button>
                  <a
                    href={news.original_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
                  >
                    查看原文
                  </a>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ReferenceModal;
