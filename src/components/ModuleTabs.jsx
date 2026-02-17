import IntelCard from './IntelCard';

const tabs = ['平台', '政策', '财报', '支付', '广告', 'AI技术'];

function ModuleTabs({ activeTab, onChange, data }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`rounded-full px-4 py-2 text-sm transition ${
              activeTab === tab
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-600'
            }`}
            type="button"
            onClick={() => onChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.map((item) => (
          <IntelCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export default ModuleTabs;
