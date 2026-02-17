import { useMemo, useState } from 'react';
import Navbar from './components/Navbar';
import StatCards from './components/StatCards';
import IntelCard from './components/IntelCard';
import ModuleTabs from './components/ModuleTabs';
import SidebarFilters from './components/SidebarFilters';
import AIChatPanel from './components/AIChatPanel';
import { aiChatMock, intelligenceData } from './data/mockIntel';

const categoryOptions = ['全部', '平台', '政策', '财报', '支付', '广告', 'AI技术', '宏观经济'];

function App() {
  const [activeTab, setActiveTab] = useState('平台');
  const [filter, setFilter] = useState('全部');
  const [chatOpen, setChatOpen] = useState(false);

  const statData = [
    { label: '今日情报数量', value: intelligenceData.length, desc: '+12% vs 昨日' },
    { label: '本周新增', value: 48, desc: '覆盖 6 大主题模块' },
    { label: '覆盖平台数量', value: 11, desc: 'Amazon / Shopify / TikTok 等' },
    { label: 'AI分析次数', value: 326, desc: '近 7 日会话热度上升' }
  ];

  const filtered = useMemo(() => {
    if (filter === '全部') return intelligenceData;
    return intelligenceData.filter((item) => item.category === filter);
  }, [filter]);

  const dailyIntel = filtered.slice(0, 6);

  const tabData = intelligenceData.filter((item) => item.category === activeTab).slice(0, 4);

  return (
    <div className="min-h-screen">
      <Navbar onOpenAI={() => setChatOpen(true)} />

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <SidebarFilters categories={categoryOptions} selected={filter} onSelect={setFilter} />

        <div className="space-y-6">
          <StatCards stats={statData} />

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">今日情报（AI 生成摘要）</h2>
              <span className="text-sm text-slate-500">共 {dailyIntel.length} 条</span>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {dailyIntel.map((item) => (
                <IntelCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-slate-900">分模块情报</h2>
            <ModuleTabs activeTab={activeTab} onChange={setActiveTab} data={tabData} />
          </section>
        </div>
      </main>

      <AIChatPanel open={chatOpen} onClose={() => setChatOpen(false)} messages={aiChatMock} />
      {chatOpen && (
        <button
          className="fixed inset-0 z-20 bg-slate-950/20"
          type="button"
          aria-label="关闭 AI 面板"
          onClick={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
