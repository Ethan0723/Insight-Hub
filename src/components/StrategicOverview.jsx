import { useState } from "react";

function StrategicOverview({ strategyBrief, indexes, onOpenEvidence }) {
  const [newsOpen, setNewsOpen] = useState(false);
  const brief = strategyBrief || {
    headline: "今日未发现高影响信号",
    time_window: "今天",
    top_drivers: [],
    top_news: [],
    citations: [],
    impact_on_revenue_model: {
      subscription: { direction: '→', note: '无数据' },
      commission: { direction: '→', note: '无数据' },
      payment: { direction: '→', note: '无数据' },
      ecosystem: { direction: '→', note: '无数据' }
    },
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

        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-5 lg:p-6 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">今日驱动</p>
            <div className="mt-3 grid gap-3">
              {brief.top_drivers.length ? (
                brief.top_drivers.map((driver, idx) => (
                  <div key={`${driver.title}-${idx}`} className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3">
                    <p className="text-xs text-slate-400">{driver.source} · 影响分 {driver.impact_score} · 风险 {driver.risk_level}</p>
                    <p className="mt-1 font-medium text-slate-100">{driver.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{driver.why}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">暂未识别今日驱动因素。</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">SaaS 影响拆解</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.entries(brief.impact_on_revenue_model || {}).map(([key, info]) => (
                <div key={key} className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3 text-xs text-slate-200">
                  <p className="text-[11px] text-slate-400">{key}</p>
                  <p className="text-sm text-cyan-200">{info.direction}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{info.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">建议行动</p>
            <div className="mt-2 grid gap-2">
              {brief.actions.length ? (
                brief.actions.map((action) => (
                  <div
                    key={`${action.priority}-${action.owner}`}
                    className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 text-[13px] text-slate-200"
                  >
                    <p className="text-[11px] text-slate-400">
                      {action.priority} · {action.owner} · {action.time_horizon || '待定'}
                    </p>
                    <p className="mt-1 text-sm text-slate-100">{action.action}</p>
                    <p className="text-[11px] text-slate-400">{action.expected_effect || '效果描述正在补充'}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">暂无可执行行动建议。</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-slate-500">
              <p>引用新闻（{brief.citations?.length || 0} 条）</p>
              <button
                type="button"
                onClick={() => setNewsOpen((prev) => !prev)}
                className="text-xs text-cyan-200 underline-offset-4 hover:underline"
              >
                {newsOpen ? '收起' : '展开'}
              </button>
            </div>
            {brief.citations?.length ? (
              <div className="mt-2 grid gap-2">
                {(newsOpen ? brief.citations : brief.citations.slice(0, 3)).map((news, idx) => (
                  <a
                    key={`${news.id}-${idx}`}
                    href={news.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col gap-1 rounded-xl border border-slate-700/60 bg-slate-900/70 p-3 text-sm text-slate-200 transition hover:border-cyan-300/40"
                  >
                    <p className="text-[11px] text-slate-400">
                      [{idx + 1}] {news.source} · {news.risk_level}
                    </p>
                    <p className="font-medium text-slate-100">{news.title}</p>
                    <p className="text-[11px] text-slate-400">影响 {news.impact_score}</p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">今日暂无引用新闻。</p>
            )}
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
