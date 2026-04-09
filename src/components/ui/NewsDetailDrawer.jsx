function NewsDetailDrawer({ open, news, relatedNews, onClose, onOpenNews }) {
  if (!open || !news) return null;

  const riskTone =
    news.riskLevel === '高'
      ? 'app-chip-risk-high'
      : news.riskLevel === '中'
        ? 'app-chip-risk-mid'
        : 'app-chip-risk-low';

  const dimMap = [
    ['订阅', news.why.subscription],
    ['佣金', news.why.commission],
    ['支付', news.why.payment],
    ['生态', news.why.ecosystem]
  ];

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="app-overlay absolute inset-0" onClick={onClose} />
      <aside className="app-drawer absolute right-0 top-0 h-full w-full max-w-3xl animate-[slideIn_220ms_ease-out] overflow-y-auto p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="app-text-primary text-lg font-semibold">新闻详情</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg app-button-secondary px-3 py-1.5 text-xs"
          >
            关闭
          </button>
        </div>

        <article className="app-card space-y-4 rounded-2xl p-5">
          <div>
            <p className="app-text-muted text-xs">
              {news.source} · {news.publishDate}
            </p>
            <h4 className="app-text-primary mt-2 text-xl font-semibold leading-8">{news.title}</h4>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="app-chip-info rounded-full px-2.5 py-1 text-xs">
              平台: {news.platform}
            </span>
            <span className="rounded-full app-chip-neutral px-2.5 py-1 text-xs">
              地区: {news.region}
            </span>
            <span className="app-chip-score rounded-full px-2.5 py-1 text-xs">
              影响评分: {news.impactScore}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs ${riskTone}`}>
              风险: {news.riskLevel}
            </span>
          </div>

          <section>
            <p className="app-accent-text text-sm font-medium">AI TL;DR</p>
            <p className="app-text-secondary mt-1 text-sm">{news.aiTldr}</p>
          </section>

          <section>
            <p className="app-accent-text text-sm font-medium">AI 解读（Why）</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {dimMap.map(([dim, val]) => (
                <div key={dim} className="app-card-soft rounded-lg p-3">
                  <p className="app-text-muted text-xs">{dim}</p>
                  <p className="app-text-secondary mt-1 text-xs leading-5">{val || '暂无直接影响'}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="app-accent-text text-sm font-medium">建议动作</p>
            <div className="mt-2 space-y-2">
              {news.actions.map((action) => (
                <div key={`${action.priority}-${action.text}`} className="app-card-soft rounded-lg p-3 text-xs app-text-secondary">
                  <span className="app-accent-text mr-2">{action.priority}</span>
                  <span className="app-text-muted mr-2">Owner: {action.owner}</span>
                  <span>{action.text}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="app-accent-text text-sm font-medium">影响维度 / 标签</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {news.impactDimensions.map((dim) => (
                <span key={dim} className="app-chip-tag rounded-full px-2 py-1">
                  {dim}
                </span>
              ))}
              {news.moduleTags.map((tag) => (
                <span key={tag} className="rounded-full app-chip-neutral px-2 py-1">
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
              className="app-button-primary inline-flex rounded-lg px-4 py-2 text-sm font-medium"
            >
              查看原文
            </a>
          </div>
        </article>

        <section className="app-card mt-5 rounded-2xl p-4">
          <p className="app-accent-text text-sm font-medium">关联新闻</p>
          <div className="mt-3 space-y-2">
            {relatedNews.length === 0 ? (
              <p className="app-text-muted text-xs">暂无关联新闻</p>
            ) : (
              relatedNews.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenNews(item.id)}
                  className="app-card-soft block w-full rounded-lg p-3 text-left text-xs hover:border-cyan-300/40"
                >
                  <p className="app-text-muted">{item.platform} · {item.region}</p>
                  <p className="app-text-secondary mt-1">{item.title}</p>
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
