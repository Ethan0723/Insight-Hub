import { useMemo } from 'react';
import StrategicOverview from '../components/StrategicOverview';
import ReasoningEngine from '../components/ReasoningEngine';
import RevenueImpact from '../components/RevenueImpact';
import IntelligenceFeed from '../components/IntelligenceFeed';
import CompetitionMatrix from '../components/CompetitionMatrix';
import ModelExplainPanel from '../components/ModelExplainPanel';

function DashboardPage({
  insight,
  matrix,
  explainers,
  revenueResult,
  scoreBreakdown,
  revenueScenario,
  onRevenueScenarioChange,
  onRevenueScenarioApply,
  news,
  favorites,
  readIds,
  onToggleFavorite,
  onOpenNews,
  onOpenEvidence,
  onOpenLibraryByIds
}) {
  const feedNews = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayNews = news.filter((item) => item.publishDate === today);
    return [...todayNews]
      .sort((a, b) => b.impactScore - a.impactScore || new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
      .slice(0, 8);
  }, [news]);

  return (
    <>
      <div id="overview">
        <StrategicOverview brief={insight.brief} indexes={insight.indexes} onOpenEvidence={onOpenEvidence} />
      </div>

      <div id="revenue">
        <RevenueImpact
          insight={insight}
          news={news}
          scenario={revenueScenario}
          onScenarioChange={onRevenueScenarioChange}
          onScenarioApply={onRevenueScenarioApply}
          result={revenueResult}
          scoreBreakdown={scoreBreakdown}
          onOpenEvidence={onOpenEvidence}
        />
      </div>

      <div id="reasoning">
        <ReasoningEngine insight={insight} scoreBreakdown={scoreBreakdown} onOpenEvidence={onOpenEvidence} />
      </div>

      <div id="feed">
        <IntelligenceFeed
          news={feedNews}
          favorites={favorites}
          readIds={readIds}
          onToggleFavorite={onToggleFavorite}
          onOpenDetail={onOpenNews}
        />
      </div>

      <div id="matrix">
        <CompetitionMatrix rows={matrix} onOpenEvidence={onOpenEvidence} onOpenLibraryByIds={onOpenLibraryByIds} />
      </div>

      <ModelExplainPanel explainers={explainers} />
    </>
  );
}

export default DashboardPage;
