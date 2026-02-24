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
  news,
  favorites,
  readIds,
  onToggleFavorite,
  onOpenNews,
  onOpenEvidence,
  onOpenLibraryByIds
}) {
  return (
    <>
      <div id="overview">
        <StrategicOverview brief={insight.brief} indexes={insight.indexes} onOpenEvidence={onOpenEvidence} />
      </div>

      <div id="reasoning">
        <ReasoningEngine insight={insight} scoreBreakdown={scoreBreakdown} onOpenEvidence={onOpenEvidence} />
      </div>

      <div id="revenue">
        <RevenueImpact
          scenario={revenueScenario}
          onScenarioChange={onRevenueScenarioChange}
          result={revenueResult}
          scoreBreakdown={scoreBreakdown}
          onOpenEvidence={onOpenEvidence}
        />
      </div>

      <div id="feed">
        <IntelligenceFeed
          news={news.slice(0, 8)}
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
