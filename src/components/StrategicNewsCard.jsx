const riskStyles = {
  低: 'app-chip-risk-low',
  中: 'app-chip-risk-mid',
  高: 'app-chip-risk-high'
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
    <article className="app-card app-card-hoverable flex h-full flex-col rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="app-text-muted text-xs">{news.source}</span>
        <div className="flex items-center gap-2">
          {isRead ? <span className="app-success-text text-[10px]">已读</span> : null}
          <button
            type="button"
            onClick={() => onToggleFavorite(news.id)}
            className={`rounded-full border px-2 py-0.5 text-[10px] ${
              isFavorite
                ? 'border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-200'
                : 'app-chip-neutral hover:border-fuchsia-300/40'
            }`}
          >
            {isFavorite ? '已收藏' : '收藏'}
          </button>
        </div>
      </div>

      <h3 className="app-text-primary text-base font-medium leading-7">{news.title}</h3>
      <p className="app-text-secondary mt-3 line-clamp-3 text-sm leading-6">{news.aiTldr}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-2 py-1 text-xs ${riskStyles[news.riskLevel]}`}>风险: {news.riskLevel}</span>
        <span className="app-chip-score rounded-full px-2 py-1 text-xs">
          影响评分: {news.impactScore}
        </span>
        <span className="app-chip-info rounded-full px-2 py-1 text-xs">
          平台: {news.platform}
        </span>
        <span className="rounded-full app-chip-neutral px-2 py-1 text-xs">地区: {news.region}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {news.impactDimensions.map((item) => (
          <span key={item} className="rounded-full app-chip-tag px-2 py-1">
            {item}
          </span>
        ))}
        {news.moduleTags.map((tag) => (
          <span key={tag} className="app-accent-chip rounded-full px-2 py-1">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onDetail(news.id)}
            className="app-button-primary rounded-xl px-3.5 py-2 text-xs font-medium"
          >
            查看详情
          </button>
          <a
            href={news.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl app-button-secondary px-3.5 py-2 text-xs"
          >
            查看原文
          </a>
        </div>

        {onOpenReference ? (
          <button
            type="button"
            onClick={onOpenReference}
            className="mt-2 rounded-xl app-button-secondary px-3.5 py-2 text-xs"
          >
            查看被引用关系
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default StrategicNewsCard;
