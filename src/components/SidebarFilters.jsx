const filters = {
  平台: ['Amazon', 'Shopify', 'TikTok Shop', 'Temu'],
  地区: ['US', 'EU', 'UK', 'SEA', 'Global'],
  标签: ['GMV', 'Tariff', 'AI', 'Ads', 'Payment']
};

function SidebarFilters() {
  return (
    <aside className="sticky top-24 hidden h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-card xl:block">
      <h3 className="text-sm font-semibold text-slate-900">筛选器</h3>
      <div className="mt-4 space-y-4">
        {Object.entries(filters).map(([title, options]) => (
          <section key={title}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
                >
                  {option}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

export default SidebarFilters;
