import { useMemo } from 'react';
import StrategicOverview from '../components/StrategicOverview';
import ReasoningEngine from '../components/ReasoningEngine';
import RevenueImpact from '../components/RevenueImpact';
import IntelligenceFeed from '../components/IntelligenceFeed';
import CompetitionMatrix from '../components/CompetitionMatrix';
import ModelExplainPanel from '../components/ModelExplainPanel';

function toUtc8DayKey(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const withZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  if (Number.isNaN(date.getTime())) return '';
  const utc8Ms = date.getTime() + 8 * 60 * 60 * 1000;
  return new Date(utc8Ms).toISOString().slice(0, 10);
}

function utc8TodayKey() {
  const utc8Ms = Date.now() + 8 * 60 * 60 * 1000;
  return new Date(utc8Ms).toISOString().slice(0, 10);
}

function DashboardPage({
  insight,
  selectedBriefDate,
  onSelectedBriefDateChange,
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
  const effectiveDate = String(selectedBriefDate || '').slice(0, 10) || utc8TodayKey();

  const selectedDateNews = useMemo(() => {
    return news.filter((item) => toUtc8DayKey(item.createdAt || item.publishDate) === effectiveDate);
  }, [news, effectiveDate]);

  const feedNews = useMemo(() => {
    const primary = [...selectedDateNews]
      .sort((a, b) => b.impactScore - a.impactScore || new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
      .slice(0, 8);
    if (primary.length > 0) return primary;
    return [...news]
      .sort((a, b) => b.impactScore - a.impactScore || new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
      .slice(0, 8);
  }, [selectedDateNews, news]);

  return (
    <>
      <div id="overview" className="scroll-mt-24">
        <StrategicOverview
          strategyBrief={insight.strategyBrief}
          indexes={insight.indexes}
          selectedDate={effectiveDate}
          onSelectedDateChange={onSelectedBriefDateChange}
          availableNewsIds={selectedDateNews.map((item) => item.id)}
          onOpenEvidence={onOpenEvidence}
        />
      </div>

      <div id="revenue" className="scroll-mt-24">
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

      <div id="reasoning" className="scroll-mt-24">
        <ReasoningEngine insight={insight} scoreBreakdown={scoreBreakdown} onOpenEvidence={onOpenEvidence} />
      </div>

      <div id="feed" className="scroll-mt-24">
        <IntelligenceFeed
          news={feedNews}
          favorites={favorites}
          readIds={readIds}
          onToggleFavorite={onToggleFavorite}
          onOpenDetail={onOpenNews}
        />
      </div>

      <div id="matrix" className="scroll-mt-24">
        <CompetitionMatrix rows={matrix} onOpenEvidence={onOpenEvidence} onOpenLibraryByIds={onOpenLibraryByIds} />
      </div>

      <ModelExplainPanel explainers={explainers} />
    </>
  );
}

export default DashboardPage;
