import { useEffect, useMemo, useState } from 'react';
import TopNav from './components/TopNav';
import StrategicOverview from './components/StrategicOverview';
import ReasoningEngine from './components/ReasoningEngine';
import RevenueImpact from './components/RevenueImpact';
import IntelligenceFeed from './components/IntelligenceFeed';
import CompetitionMatrix from './components/CompetitionMatrix';
import AIAssistantPanel from './components/AIAssistantPanel';
import ModelExplainPanel from './components/ModelExplainPanel';
import StrategicNewsLibrary from './components/StrategicNewsLibrary';
import NewsDetailDrawer from './components/ui/NewsDetailDrawer';
import ReferenceModal from './components/ui/ReferenceModal';
import { fetchDashboardData } from './services/mockApi';

const anchorMap = {
  reasoning: 'reasoning',
  revenue: 'revenue',
  feed: 'feed',
  matrix: 'matrix',
  dashboard: 'overview'
};

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState([]);
  const [indexesData, setIndexesData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [selectedNews, setSelectedNews] = useState(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [referenceState, setReferenceState] = useState({ open: false, title: '', ids: [] });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchDashboardData();
        if (!mounted) return;
        setNews(res.news);
        setIndexesData(res.indexes);
        setRevenueData(res.revenueImpact);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const newsMap = useMemo(() => {
    const map = new Map();
    news.forEach((item) => map.set(item.id, item));
    return map;
  }, [news]);

  const referenceNewsList = useMemo(() => {
    const unique = [...new Set(referenceState.ids)];
    return unique.map((id) => newsMap.get(id)).filter(Boolean);
  }, [newsMap, referenceState.ids]);

  const openReferences = (title, ids) => {
    setReferenceState({ open: true, title, ids });
  };

  const getNewsCount = (ids) => ids.filter((id) => newsMap.has(id)).length;

  const handleNavigate = (key) => {
    if (key === 'library') {
      setActivePage('library');
      return;
    }
    setActivePage('dashboard');
    const anchor = anchorMap[key];
    if (anchor) {
      setTimeout(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 20);
    }
  };

  if (loading || !indexesData || !revenueData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <div className="mx-auto flex max-w-[1400px] items-center justify-center px-4 py-40">
          <p className="animate-pulse text-sm text-cyan-200">AI Strategic Engine 加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_20%,rgba(56,189,248,0.2),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.14),transparent_35%),linear-gradient(180deg,#030712_0%,#020617_65%,#000000_100%)]" />

      <TopNav
        activePage={activePage}
        onNavigate={handleNavigate}
        aiPanelOpen={aiPanelOpen}
        onToggleAI={() => setAiPanelOpen((prev) => !prev)}
      />

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-8">
        {activePage === 'library' ? (
          <StrategicNewsLibrary
            news={news}
            indexes={indexesData.strategicIndexes}
            onOpenDetail={setSelectedNews}
            onOpenReferences={openReferences}
          />
        ) : (
          <>
            <div id="overview">
              <StrategicOverview
                brief={indexesData.strategicBrief}
                indexes={indexesData.strategicIndexes}
                getNewsCount={getNewsCount}
                onOpenReferences={openReferences}
              />
            </div>
            <div id="reasoning">
              <ReasoningEngine data={indexesData.reasoningEngine} onOpenReferences={openReferences} />
            </div>
            <div id="revenue">
              <RevenueImpact data={revenueData} onOpenReferences={openReferences} />
            </div>
            <div id="feed">
              <IntelligenceFeed news={news.slice(0, 8)} onOpenDetail={setSelectedNews} />
            </div>
            <div id="matrix">
              <CompetitionMatrix
                competitors={indexesData.competitors}
                aiInterpretation={indexesData.aiInterpretation}
                news={news}
                onOpenReferences={openReferences}
              />
            </div>
            <ModelExplainPanel explainers={indexesData.modelExplainers} />
          </>
        )}
      </main>

      {!aiPanelOpen ? (
        <button
          type="button"
          onClick={() => setAiPanelOpen(true)}
          className="fixed bottom-6 right-6 z-30 rounded-full border border-cyan-300/40 bg-slate-900/90 px-4 py-2 text-xs text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.22)] hover:bg-slate-800"
        >
          🧠 展开 AI 助手
        </button>
      ) : null}

      <AIAssistantPanel data={indexesData.aiAssistant} open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />

      <ReferenceModal
        open={referenceState.open}
        title={referenceState.title}
        newsList={referenceNewsList}
        onClose={() => setReferenceState({ open: false, title: '', ids: [] })}
        onSelectNews={setSelectedNews}
      />

      <NewsDetailDrawer open={Boolean(selectedNews)} news={selectedNews} onClose={() => setSelectedNews(null)} />
    </div>
  );
}

export default App;
