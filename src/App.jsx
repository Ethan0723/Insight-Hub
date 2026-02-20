import TopNav from './components/TopNav';
import StrategicOverview from './components/StrategicOverview';
import ReasoningEngine from './components/ReasoningEngine';
import RevenueImpact from './components/RevenueImpact';
import IntelligenceFeed from './components/IntelligenceFeed';
import CompetitionMatrix from './components/CompetitionMatrix';
import AIAssistantPanel from './components/AIAssistantPanel';
import ModelExplainPanel from './components/ModelExplainPanel';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_20%,rgba(56,189,248,0.2),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.14),transparent_35%),linear-gradient(180deg,#030712_0%,#020617_65%,#000000_100%)]" />

      <TopNav />

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-8 xl:pr-[410px]">
        <StrategicOverview />
        <ReasoningEngine />
        <RevenueImpact />
        <IntelligenceFeed />
        <CompetitionMatrix />
        <ModelExplainPanel />

        <div className="xl:hidden">
          <AIAssistantPanel />
        </div>
      </main>

      <div className="hidden xl:block">
        <AIAssistantPanel />
      </div>
    </div>
  );
}

export default App;
