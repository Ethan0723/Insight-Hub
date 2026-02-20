const riskStyles = {
  低: 'text-emerald-300 border-emerald-300/40 bg-emerald-300/10',
  中: 'text-amber-200 border-amber-300/40 bg-amber-300/10',
  高: 'text-rose-300 border-rose-300/40 bg-rose-300/10'
};

function StrategicNewsCard({
  news,
  onDetail,
  onToggleFavorite,
  isFavorite,
  isRead,
  onOpenReference
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-700/70 bg-slate-950/65 p-4 transition duration-300 hover:border-cyan-300/40 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{news.source}</span>
        <div className="flex items-center gap-2">
          {isRead ? <span className="text-[10px] text-emerald-300">已读</span> : null}
          <button
            type="button"
            onClick={() => onToggleFavorite(news.id)}
            className={`rounded-full border px-2 py-0.5 text-[10px] ${
              isFavorite
                ? 'border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-200'
                : 'border-slate-600 text-slate-300 hover:border-fuchsia-300/40'
            }`}
          >
            {isFavorite ? '已收藏' : '收藏'}
          </button>
        </div>
      </div>

      <h3 className="text-base font-medium leading-6 text-slate-100">{news.title}</h3>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{news.aiTldr}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-2 py-1 text-xs ${riskStyles[news.riskLevel]}`}>风险: {news.riskLevel}</span>
        <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-2 py-1 text-xs text-fuchsia-200">
          影响评分: {news.impactScore}
        </span>
        <span className="rounded-full border border-blue-300/30 bg-blue-300/10 px-2 py-1 text-xs text-blue-200">
          平台: {news.platform}
        </span>
        <span className="rounded-full border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200">地区: {news.region}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {news.impactDimensions.map((item) => (
          <span key={item} className="rounded-full border border-slate-600 bg-slate-900 px-2 py-1 text-slate-200">
            {item}
          </span>
        ))}
        {news.moduleTags.map((tag) => (
          <span key={tag} className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-cyan-200">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onDetail(news.id)}
            className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-cyan-400"
          >
            查看详情
          </button>
          <a
            href={news.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            查看原文
          </a>
        </div>

        {onOpenReference ? (
          <button
            type="button"
            onClick={onOpenReference}
            className="mt-2 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            查看被引用关系
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default StrategicNewsCard;
