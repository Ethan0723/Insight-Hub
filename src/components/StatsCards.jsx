function StatsCards({ stats }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((item) => (
        <article
          key={item.label}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition-transform hover:-translate-y-0.5"
        >
          <p className="text-sm text-slate-500">{item.label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{item.value}</p>
          <p className="mt-2 text-xs text-blue-600">{item.hint}</p>
        </article>
      ))}
    </section>
  );
}

export default StatsCards;
