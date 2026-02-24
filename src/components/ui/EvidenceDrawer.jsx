import { useEffect, useState } from 'react';
import { streamNewsSummary } from '../../services/ai';

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

  if (!open) return null;

  const onGenerateSummary = async () => {
    if (!newsList.length || loadingSummary) return;
    setSummary('');
    setSummaryError('');
    setLoadingSummary(true);

    try {
      await streamNewsSummary(
        newsList.map((item) => item.title).slice(0, 12),
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
      <div className="absolute inset-0 bg-slate-950/70" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl animate-[slideIn_220ms_ease-out] overflow-y-auto border-l border-cyan-300/20 bg-slate-950/95 p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">证据溯源</h3>
            <p className="text-xs text-slate-400">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            关闭
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenLibraryByIds(newsList.map((item) => item.id))}
            className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-300/20"
          >
            在新闻库中查看这些引用新闻
          </button>
          <button
            type="button"
            onClick={onGenerateSummary}
            disabled={!newsList.length || loadingSummary}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingSummary ? '生成中...' : '生成 AI 摘要'}
          </button>
        </div>

        {summary || summaryError ? (
          <div className="mb-4 rounded-xl border border-cyan-300/25 bg-cyan-300/5 p-3">
            <p className="mb-2 text-xs text-cyan-200">AI 聚合摘要</p>
            {summary ? <p className="text-sm leading-6 text-slate-100">{summary}</p> : null}
            {summaryError ? <p className="text-xs text-rose-300">{summaryError}</p> : null}
          </div>
        ) : null}

        <div className="space-y-3">
          {newsList.length === 0 ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">暂无引用新闻</div>
          ) : (
            newsList.map((news) => (
              <article key={news.id} className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400">
                  {news.source} · {news.publishDate} · 贡献分 {Math.max(30, Math.round(news.impactScore * 0.88))}
                </p>
                <h4 className="mt-2 text-sm font-medium text-slate-100">{news.title}</h4>
                <p className="mt-2 text-xs text-slate-300 line-clamp-2">{news.aiTldr}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenNews(news.id)}
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
