import { useEffect, useMemo, useRef, useState } from 'react';
import TopNav from './components/TopNav';
import AIAssistantPanel from './components/AIAssistantPanel';
import NewsDetailDrawer from './components/ui/NewsDetailDrawer';
import EvidenceDrawer from './components/ui/EvidenceDrawer';
import DashboardPage from './pages/DashboardPage';
import NewsLibraryPage from './pages/NewsLibraryPage';
import { api } from './services/api';
import { storage } from './services/storage';

const defaultScenario = {
  arpuDelta: 0,
  commissionDelta: 0,
  paymentSuccessDelta: 0
};

function App() {
  const [activeNav, setActiveNav] = useState('overview');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newsBase, setNewsBase] = useState([]);
  const [insight, setInsight] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [meta, setMeta] = useState({ assistant: { samples: [], response: { affectedModules: [], strategy: [] } }, explainers: [] });

  const [scenario, setScenario] = useState(defaultScenario);
  const [revenueResult, setRevenueResult] = useState(null);
  const [scoreBreakdown, setScoreBreakdown] = useState(null);

  const [favorites, setFavorites] = useState(storage.getFavorites());
  const [readIds, setReadIds] = useState(storage.getReadNewsIds());

  const [selectedNewsId, setSelectedNewsId] = useState(null);
  const [selectedNews, setSelectedNews] = useState(null);
  const [relatedNews, setRelatedNews] = useState([]);

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceData, setEvidenceData] = useState({ title: '', newsIds: [] });

  const [libraryPreset, setLibraryPreset] = useState(null);
  const [fabPos, setFabPos] = useState({ x: null, y: null });
  const dragStateRef = useRef({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0
  });

  useEffect(() => {
    let mounted = true;

    Promise.all([
      api.getNews({ page: 1, pageSize: 200 }),
      api.getDailyInsight(),
      api.getMatrix(),
      api.getAppMeta(),
      api.getRevenueImpact(defaultScenario),
      api.getScoreBreakdown(defaultScenario)
    ])
      .then(([newsRes, insightRes, matrixRes, metaRes, revenueRes, scoreRes]) => {
        if (!mounted) return;
        setNewsBase(newsRes.list);
        setInsight(insightRes);
        setMatrix(matrixRes);
        setMeta(metaRes);
        setRevenueResult(revenueRes);
        setScoreBreakdown(scoreRes);
      })
      .catch(() => {
        if (mounted) setError('初始化数据失败，请刷新重试。');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.getRevenueImpact(scenario), api.getScoreBreakdown(scenario)]).then(([revenueRes, scoreRes]) => {
      if (!mounted) return;
      setRevenueResult(revenueRes);
      setScoreBreakdown(scoreRes);
    });
    return () => {
      mounted = false;
    };
  }, [scenario]);

  useEffect(() => {
    if (!selectedNewsId) return;
    let mounted = true;

    Promise.all([api.getNewsById(selectedNewsId), api.getRelatedNews(selectedNewsId)]).then(([news, related]) => {
      if (!mounted) return;
      setSelectedNews(news);
      setRelatedNews(related);
      if (news) {
        const nextRead = storage.markRead(news.id);
        setReadIds(nextRead);
      }
    });

    return () => {
      mounted = false;
    };
  }, [selectedNewsId]);

  useEffect(() => {
    if (fabPos.x !== null && fabPos.y !== null) return;
    const initialX = Math.max(12, window.innerWidth - 180);
    const initialY = Math.max(110, Math.round(window.innerHeight * 0.55));
    setFabPos({ x: initialX, y: initialY });
  }, [fabPos.x, fabPos.y]);

  useEffect(() => {
    const onMove = (event) => {
      if (!dragStateRef.current.dragging) return;
      if (
        Math.abs(event.clientX - dragStateRef.current.startX) > 4 ||
        Math.abs(event.clientY - dragStateRef.current.startY) > 4
      ) {
        dragStateRef.current.moved = true;
      }
      const x = Math.min(
        window.innerWidth - 150,
        Math.max(8, event.clientX - dragStateRef.current.offsetX)
      );
      const y = Math.min(
        window.innerHeight - 46,
        Math.max(72, event.clientY - dragStateRef.current.offsetY)
      );
      setFabPos({ x, y });
    };

    const onUp = () => {
      dragStateRef.current.dragging = false;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const newsMap = useMemo(() => {
    const map = new Map();
    newsBase.forEach((item) => map.set(item.id, item));
    return map;
  }, [newsBase]);

  const evidenceNews = useMemo(() => {
    const unique = [...new Set(evidenceData.newsIds)];
    return unique.map((id) => newsMap.get(id)).filter(Boolean);
  }, [evidenceData.newsIds, newsMap]);

  const indexMap = useMemo(() => {
    const map = {};
    if (!insight) return map;
    insight.indexes.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [insight]);

  const onNavigate = (key) => {
    setActiveNav(key);
    setTimeout(() => {
      if (key === 'library') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 10);
  };

  const onOpenEvidence = (evidence) => {
    setEvidenceData({ title: evidence.title, newsIds: evidence.newsIds });
    setEvidenceOpen(true);
  };

  const onOpenLibraryByIds = (ids) => {
    setActiveNav('library');
    setLibraryPreset({ ids, page: 1 });
    setEvidenceOpen(false);
  };

  const onToggleFavorite = (id) => {
    setFavorites(storage.toggleFavorite(id));
  };

  const onScenarioChange = (key, value) => {
    setScenario((prev) => ({ ...prev, [key]: value }));
  };

  const onScenarioApply = (patch) => {
    setScenario((prev) => ({ ...prev, ...patch }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-[1400px] px-4 py-20 lg:px-8">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-800" />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-40 animate-pulse rounded-2xl border border-slate-700 bg-slate-900/60" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !insight || !revenueResult || !scoreBreakdown) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-xl px-4 py-32 text-center lg:px-8">
          <p className="text-sm text-rose-300">{error || '系统加载异常'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_20%,rgba(56,189,248,0.2),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.14),transparent_35%),linear-gradient(180deg,#030712_0%,#020617_65%,#000000_100%)]" />

      <TopNav activeKey={activeNav} onNavigate={onNavigate} aiPanelOpen={aiPanelOpen} onToggleAI={() => setAiPanelOpen((v) => !v)} />

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-8">
        {activeNav === 'library' ? (
          <NewsLibraryPage
            initialQuery={libraryPreset}
            favorites={favorites}
            readIds={readIds}
            onToggleFavorite={onToggleFavorite}
            onOpenNews={setSelectedNewsId}
            onOpenEvidence={onOpenEvidence}
            indexMap={indexMap}
          />
        ) : (
          <DashboardPage
            insight={insight}
            matrix={matrix}
            explainers={meta.explainers}
            revenueResult={revenueResult}
            scoreBreakdown={scoreBreakdown}
            revenueScenario={scenario}
            onRevenueScenarioChange={onScenarioChange}
            onRevenueScenarioApply={onScenarioApply}
            news={newsBase}
            favorites={favorites}
            readIds={readIds}
            onToggleFavorite={onToggleFavorite}
            onOpenNews={setSelectedNewsId}
            onOpenEvidence={onOpenEvidence}
            onOpenLibraryByIds={onOpenLibraryByIds}
          />
        )}
      </main>

      {!aiPanelOpen ? (
        <button
          type="button"
          onClick={() => setAiPanelOpen(true)}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            dragStateRef.current = {
              dragging: true,
              moved: false,
              startX: event.clientX,
              startY: event.clientY,
              offsetX: event.clientX - rect.left,
              offsetY: event.clientY - rect.top
            };
          }}
          onPointerUp={() => {
            if (!dragStateRef.current.moved) {
              setAiPanelOpen(true);
            }
          }}
          style={{
            left: fabPos.x ?? undefined,
            top: fabPos.y ?? undefined
          }}
          className="fixed z-30 cursor-move rounded-full border border-cyan-300/40 bg-slate-900/90 px-4 py-2 text-xs text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.22)] hover:bg-slate-800"
        >
          🧠 展开 AI 助手
        </button>
      ) : null}

      <AIAssistantPanel
        data={meta.assistant}
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        insight={insight}
        scoreBreakdown={scoreBreakdown}
        revenueResult={revenueResult}
        news={newsBase}
        onOpenEvidence={onOpenEvidence}
      />

      <EvidenceDrawer
        open={evidenceOpen}
        title={evidenceData.title}
        newsList={evidenceNews}
        onClose={() => setEvidenceOpen(false)}
        onOpenNews={setSelectedNewsId}
        onOpenLibraryByIds={onOpenLibraryByIds}
      />

      <NewsDetailDrawer
        open={Boolean(selectedNews)}
        news={selectedNews}
        relatedNews={relatedNews}
        onOpenNews={setSelectedNewsId}
        onClose={() => {
          setSelectedNewsId(null);
          setSelectedNews(null);
          setRelatedNews([]);
        }}
      />
    </div>
  );
}

export default App;
