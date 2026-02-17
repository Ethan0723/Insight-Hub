function SidebarFilters({ categories, selected, onSelect }) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-slate-900">快速筛选</h2>
      <div className="mt-4 flex flex-wrap gap-2 lg:flex-col">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(category)}
            className={`rounded-xl px-3 py-2 text-left text-sm transition ${
              selected === category
                ? 'bg-brand-50 font-medium text-brand-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </aside>
  );
}

export default SidebarFilters;
