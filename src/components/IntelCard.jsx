function IntelCard({ item }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{item.category}</span>
        <span className="text-xs text-slate-400">{item.publish_time}</span>
      </div>

      <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-900">{item.title}</h3>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.summary}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <span key={`${item.id}-${tag}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>{item.source}</span>
        <span>
          {item.platform} · {item.country}
        </span>
      </div>
    </article>
  );
}

export default IntelCard;
