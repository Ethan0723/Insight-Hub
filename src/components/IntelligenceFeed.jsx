import StrategicNewsCard from './StrategicNewsCard';

function IntelligenceFeed({ news, favorites, readIds, onToggleFavorite, onOpenDetail }) {
  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100 lg:text-2xl">📡 战略输入情报流</h2>
        <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
          High Impact {news.length} 条
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {news.map((item) => (
          <StrategicNewsCard
            key={item.id}
            news={item}
            onDetail={onOpenDetail}
            onToggleFavorite={onToggleFavorite}
            isFavorite={favorites.includes(item.id)}
            isRead={readIds.includes(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

export default IntelligenceFeed;
