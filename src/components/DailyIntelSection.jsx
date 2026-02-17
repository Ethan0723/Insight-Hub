import IntelCard from './IntelCard';

function DailyIntelSection({ data }) {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">今日情报（AI生成）</h2>
        <button type="button" className="text-sm text-blue-600 hover:text-blue-700">
          查看全部
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((item) => (
          <IntelCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export default DailyIntelSection;
