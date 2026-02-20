const riskStyles = {
  低: 'text-emerald-300 border-emerald-300/40 bg-emerald-300/10',
  中: 'text-amber-200 border-amber-300/40 bg-amber-300/10',
  高: 'text-rose-300 border-rose-300/40 bg-rose-300/10'
};

function StrategicNewsCard({ news, onDetail }) {
  return (
    <article className="rounded-2xl border border-slate-700/70 bg-slate-950/65 p-4 transition duration-300 hover:border-cyan-300/40 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{news.source}</span>
        <span className="text-xs text-slate-500">{news.publish_date}</span>
      </div>

      <h3 className="text-base font-medium leading-6 text-slate-100">{news.title}</h3>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{news.ai_summary}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-2 py-1 text-xs ${riskStyles[news.risk_level]}`}>
          风险: {news.risk_level}
        </span>
        <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-2 py-1 text-xs text-fuchsia-200">
          影响评分: {news.impact_score}
        </span>
        <span className="rounded-full border border-blue-300/30 bg-blue-300/10 px-2 py-1 text-xs text-blue-200">
          平台: {news.platform}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {news.impact_dimension.map((item) => (
          <span key={item} className="rounded-full border border-slate-600 bg-slate-900 px-2 py-1 text-slate-200">
            {item}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDetail(news)}
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
  );
}

export default StrategicNewsCard;
