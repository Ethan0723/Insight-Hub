import { useMemo, useState } from 'react';
import Navbar from './components/Navbar';
import StatsCards from './components/StatsCards';
import DailyIntelSection from './components/DailyIntelSection';
import ModuleTabs from './components/ModuleTabs';
import SidebarFilters from './components/SidebarFilters';
import AIChatPanel from './components/AIChatPanel';
import { mockIntelData } from './data/mockIntel';

function App() {
  const [activeTab, setActiveTab] = useState('平台');
  const [chatOpen, setChatOpen] = useState(false);

  const stats = useMemo(
    () => [
      {
        label: '今日情报数量',
        value: '42',
        hint: '+12.6% vs 昨日'
      },
      {
        label: '本周新增',
        value: '186',
        hint: '覆盖 6 个核心模块'
      },
      {
        label: '覆盖平台数量',
        value: '27',
        hint: '平台 + 独立站 + 支付渠道'
      },
      {
        label: 'AI分析次数',
        value: '1,024',
        hint: '近 7 日累计'
      }
    ],
    []
  );

  const dailyIntel = useMemo(() => mockIntelData.slice(0, 6), []);

  const moduleData = useMemo(
    () => mockIntelData.filter((item) => item.category === activeTab),
    [activeTab]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar onOpenAI={() => setChatOpen(true)} />

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:px-8 xl:grid-cols-[260px_1fr]">
        <SidebarFilters />

        <section>
          <StatsCards stats={stats} />
          <DailyIntelSection data={dailyIntel} />
          <ModuleTabs activeTab={activeTab} onChange={setActiveTab} data={moduleData} />
        </section>
      </main>

      <AIChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

export default App;
