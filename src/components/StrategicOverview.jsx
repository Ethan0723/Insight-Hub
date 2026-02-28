import { useState } from "react";

function StrategicOverview({ strategyBrief, indexes, onOpenEvidence }) {
  const [newsOpen, setNewsOpen] = useState(false);
  const brief = strategyBrief || {
    headline: "近72小时暂无足够高置信新闻",
    time_window: "近72小时",
    top_signals: [],
    dimension_risk: [],
    top_news: [],
    actions: [],
    meta: { news_count_scanned: 0, news_count_used: 0, generated_at: "" }
  };

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-900/60 p-6 shadow-[0_0_45px_rgba(56,189,248,0.12)] backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">AI 今日战略判断</p>
          <h3 className="text-2xl font-semibold text-slate-100 lg:text-3xl">{brief.headline}</h3>
          <p className="text-xs text-slate-400">{brief.time_window || '近72小时'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-emerald-200">
            <span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-2 py-0.5">仅基于 news_raw</span>
            <span className="rounded-full border border-slate-700/40 bg-slate-950/50 px-2 py-0.5">
              大约扫描 {brief.meta.news_count_scanned} 条，引用 {brief.meta.news_count_used}
            </span>
          </div>
        </div>
        <span className="text-[11px] text-slate-400">
          生成于 {brief.meta.generated_at ? new Date(brief.meta.generated_at).toLocaleString() : '—'}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-5 lg:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr,0.9fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
              重点信号
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(brief.top_signals.length > 0 ? brief.top_signals : [{ signal: '暂无高质量信号', why: '待补充', score: 0 }]).map((signal, index) => (
                <div
                  key={`${signal.signal}-${index}`}
                  className="flex min-w-[140px] flex-col gap-1 rounded-2xl border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-300"
                >
                  <span className="text-xs font-semibold text-slate-100">{signal.signal}</span>
                  <span>{signal.why || '信息不足'}</span>
                  <span className="text-right text-[11px] text-emerald-300">评分 {signal.score}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {['订阅', '佣金', '支付', '生态'].map((dimension) => {
                const info = brief.dimension_risk.find((item) => item.dimension === dimension);
                return (
                  <div key={dimension} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{dimension}</p>
                    <p className="mt-1 text-2xl font-semibold text-cyan-200">{info?.score || '—'}</p>
                    <p className="mt-1 text-xs text-slate-400">{info?.summary || '暂无相关高置信度新闻'}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-3 text-[11px] uppercase tracking-[0.2em] text-slate-500">
              引用新闻（{brief.top_news.length} 条）
            </div>
            {brief.top_news.slice(0, 3).map((news, idx) => (
              <a
                key={news.id || `${news.title}-${idx}`}
                href={news.url}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 text-sm text-slate-200 transition hover:border-cyan-300/50"
              >
                <p className="text-[11px] text-slate-400">
                  [{idx + 1}] {news.published_at || '时间无'} · {news.source}
                </p>
                <p className="mt-1 font-medium text-slate-100">{news.title}</p>
                <p className="mt-1 text-[11px] text-slate-400">来源摘要：{news.why_used || '暂无描述'}</p>
                <p className="mt-1 text-[11px] text-emerald-300">影响评分 {news.impact_score} · 风险 {news.risk_level}</p>
              </a>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-slate-800/60 pt-4">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-slate-500">
            <p>扩展引用</p>
            <button
              type="button"
              onClick={() => setNewsOpen((prev) => !prev)}
              className="text-xs text-cyan-200 underline-offset-4 hover:underline"
            >
              {newsOpen ? '收起全部新闻' : '查看全部引用新闻'}
            </button>
          </div>
          {newsOpen && (
            <div className="mt-3 space-y-2">
              {brief.top_news.length ? (
                brief.top_news.map((news, idx) => (
                  <a
                    key={`${news.id}-${idx}`}
                    href={news.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col gap-1 rounded-xl border border-slate-700/60 bg-slate-900/70 p-3 text-sm text-slate-200 transition hover:border-cyan-300/40"
                  >
                    <span className="text-[11px] text-slate-400">
                      [{idx + 1}] {news.published_at || '时间无'} · {news.source}
                    </span>
                    <span className="font-medium text-slate-100">{news.title}</span>
                    <span className="text-[11px] text-slate-400">{news.why_used || '无说明'}</span>
                    <span className="text-[11px] text-emerald-300">影响 {news.impact_score} · 风险 {news.risk_level}</span>
                  </a>
                ))
              ) : (
                <p className="text-xs text-slate-400">近72小时无足够高置信新闻可引用。</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">建议行动</p>
          <div className="mt-2 space-y-2">
            {brief.actions.length ? (
              brief.actions.slice(0, 3).map((action) => (
                <div
                  key={`${action.priority}-${action.owner}`}
                  className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 text-[13px] text-slate-200"
                >
                  <p className="text-[11px] text-slate-400">
                    {action.priority} · {action.owner}
                  </p>
                  <p className="mt-1 text-sm text-slate-100">{action.action}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">暂无可执行行动建议。</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {indexes.map((index) => (
          <article key={index.id} className="rounded-2xl border border-blue-300/20 bg-slate-900/70 p-4 transition hover:border-cyan-300/40">
            <p className="text-xs text-slate-400">{index.name}</p>
            <div className="mt-3 flex items-end gap-2">
              <p className="text-3xl font-semibold text-cyan-200">{index.value}</p>
              <p className="pb-1 text-xs text-emerald-300">{index.delta}</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{index.description}</p>
            <p className="mt-2 text-xs text-slate-500">引用新闻数量: {index.evidence.newsIds.length}</p>
            <button
              type="button"
              onClick={() => onOpenEvidence(index.evidence)}
              className="mt-3 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
            >
              查看引用来源
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export default StrategicOverview;
