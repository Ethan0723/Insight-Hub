import StrategicNewsCard from './StrategicNewsCard';

function IntelligenceFeed({ news, favorites, readIds, onToggleFavorite, onOpenDetail }) {
  return (
    <section className="app-section rounded-3xl p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="app-text-primary text-xl font-semibold lg:text-2xl">战略输入情报流</h2>
        <span className="app-accent-chip rounded-full px-3 py-1 text-xs">
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
