import IntelCard from './IntelCard';

const tabs = ['平台', '政策', '财报', '支付', '广告', 'AI技术'];

function ModuleTabs({ activeTab, onChange, data }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">分模块情报</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                isActive ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {data.map((item) => (
          <IntelCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export default ModuleTabs;
