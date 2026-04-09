import { useEffect, useMemo, useState } from 'react';
import { streamNewsSummary } from '../../services/ai';
import { track } from '../../lib/analytics';

function EvidenceDrawer({ open, title, newsList, onClose, onOpenNews, onOpenLibraryByIds }) {
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    if (!open) {
      setSummary('');
      setLoadingSummary(false);
      setSummaryError('');
    }
  }, [open]);

  const sortedNewsList = useMemo(() => {
    return [...(Array.isArray(newsList) ? newsList : [])].sort((a, b) => {
      const bTs = Date.parse(b?.createdAt || b?.publishDate || '') || 0;
      const aTs = Date.parse(a?.createdAt || a?.publishDate || '') || 0;
      return bTs - aTs;
    });
  }, [newsList]);

  if (!open) return null;

  const onGenerateSummary = async () => {
    if (!sortedNewsList.length || loadingSummary) return;
    setSummary('');
    setSummaryError('');
    setLoadingSummary(true);

    try {
      await streamNewsSummary(
        sortedNewsList
          .map((item) => ({
            title: item.title,
            summary: item.summary || item.aiTldr || ''
          }))
          .slice(0, 12),
        {
          onToken: (token) => {
            setSummary((prev) => `${prev}${token}`);
          }
        }
      );
    } catch (error) {
      setSummaryError('AI 摘要生成失败，请稍后重试。');
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="app-overlay absolute inset-0" onClick={onClose} />
      <aside className="app-drawer absolute right-0 top-0 h-full w-full max-w-2xl animate-[slideIn_220ms_ease-out] overflow-y-auto p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="app-text-primary text-lg font-semibold">证据溯源</h3>
            <p className="app-text-muted text-xs">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg app-button-secondary px-3 py-1 text-xs"
          >
            关闭
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenLibraryByIds(sortedNewsList.map((item) => item.id))}
            className="app-accent-chip rounded-lg px-3 py-1.5 text-xs hover:bg-cyan-300/20"
          >
            在新闻库中查看这些引用新闻
          </button>
          <button
            type="button"
            onClick={onGenerateSummary}
            disabled={!sortedNewsList.length || loadingSummary}
            className="rounded-lg app-button-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingSummary ? '生成中...' : '生成 AI 摘要'}
          </button>
        </div>

        {summary || summaryError ? (
          <div className="app-accent-panel mb-4 rounded-xl p-3">
            <p className="app-accent-text mb-2 text-xs">AI 聚合摘要</p>
            {summary ? <p className="text-sm leading-6 text-slate-100">{summary}</p> : null}
            {summaryError ? <p className="text-xs text-rose-300">{summaryError}</p> : null}
          </div>
        ) : null}

        <div className="space-y-3">
          {sortedNewsList.length === 0 ? (
            <div className="app-card rounded-xl p-4 text-sm app-text-muted">暂无引用新闻</div>
          ) : (
            sortedNewsList.map((news) => (
              <article key={news.id} className="app-card rounded-xl p-4">
                <p className="app-text-muted text-xs">
                  {news.source} · {news.publishDate} · 贡献分 {Math.max(30, Math.round(news.impactScore * 0.88))}
                </p>
                <h4 className="app-text-primary mt-2 text-sm font-medium">{news.title}</h4>
                <p className="app-text-secondary mt-2 text-xs line-clamp-2">{news.aiTldr}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenNews(news)}
                    className="app-button-primary rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    查看详情
                  </button>
                  <a
                    href={news.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      let domain = '';
                      try {
                        domain = news?.originalUrl ? new URL(news.originalUrl).hostname : '';
                      } catch {
                        domain = '';
                      }
                      track('citation_click', { news_id: String(news?.id || ''), domain });
                    }}
                    className="rounded-lg app-button-secondary px-3 py-1.5 text-xs"
                  >
                    打开原文
                  </a>
                </div>
              </article>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

export default EvidenceDrawer;
