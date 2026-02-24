import { useMemo, useState } from 'react';
import MethodPopover from './ui/MethodPopover';

const DIMENSIONS = [
  { id: 'subscription', name: '订阅价格' },
  { id: 'commission', name: '佣金结构' },
  { id: 'payment', name: '支付链路' },
  { id: 'ecosystem', name: '生态扩展' }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getRiskLevel(finalOverall) {
  if (finalOverall >= 75) return '高风险';
  if (finalOverall >= 60) return '中高';
  if (finalOverall >= 45) return '中性';
  return '低风险';
}

function getRiskTone(level) {
  if (level === '高风险') return 'text-rose-300 border-rose-400/40 bg-rose-400/10';
  if (level === '中高') return 'text-amber-200 border-amber-300/40 bg-amber-300/10';
  if (level === '中性') return 'text-sky-200 border-sky-300/40 bg-sky-300/10';
  return 'text-emerald-200 border-emerald-300/40 bg-emerald-300/10';
}

function getExposureTone(index) {
  if (index >= 0.7) return 'text-rose-300';
  if (index >= 0.4) return 'text-amber-200';
  return 'text-emerald-200';
}

function toDimensionScore(scoreBreakdown, id) {
  if (!scoreBreakdown) return { baseline: 0, delta: 0, final: 0 };
  return {
    baseline: scoreBreakdown.baseline[id] ?? 0,
    delta: scoreBreakdown.delta[id] ?? 0,
    final: scoreBreakdown.final[id] ?? 0
  };
}

function formatDelta(value) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function buildRiskSubtitle(insight, topDimensionName) {
  const policy = insight?.indexes?.find((item) => item.id === 'policy')?.value ?? 0;
  const payment = insight?.indexes?.find((item) => item.id === 'agent')?.value ?? 0;
  if (policy >= 70 || payment >= 70) {
    return `外部支付与政策信号增强，收入结构对${topDimensionName}敏感度上升。`;
  }
  return `外部波动中等，当前主要暴露集中在${topDimensionName}，建议优先做参数对冲。`;
}

function applyScenarioPatch(base, patch) {
  return {
    arpuDelta: clamp(base.arpuDelta + (patch.arpuDelta || 0), -10, 10),
    commissionDelta: clamp(base.commissionDelta + (patch.commissionDelta || 0), -1, 1),
    paymentSuccessDelta: clamp(base.paymentSuccessDelta + (patch.paymentSuccessDelta || 0), -5, 5)
  };
}

function RevenueImpact({ insight, news, scenario, onScenarioChange, onScenarioApply, result, scoreBreakdown, onOpenEvidence }) {
  const [expandedId, setExpandedId] = useState('payment');

  const sliders = useMemo(
    () => [
      { key: 'arpuDelta', label: '订阅 ARPU 调整', min: -10, max: 10, step: 0.5, value: scenario.arpuDelta },
      { key: 'commissionDelta', label: '佣金率调整 (pp)', min: -1, max: 1, step: 0.05, value: scenario.commissionDelta },
      { key: 'paymentSuccessDelta', label: '支付成功率调整 (pp)', min: -5, max: 5, step: 0.5, value: scenario.paymentSuccessDelta }
    ],
    [scenario]
  );

  const exposureRows = useMemo(() => {
    return DIMENSIONS.map((dim) => {
      const score = toDimensionScore(scoreBreakdown, dim.id);
      const externalRisk = score.baseline / 100;
      const internalSensitivity = Math.min(Math.abs(score.delta) / 100, 1);
      const exposureIndex = (score.baseline * Math.abs(score.delta)) / 10000;
      const evidenceIds = scoreBreakdown?.evidence?.[dim.id] || [];
      return {
        ...dim,
        ...score,
        externalRisk,
        internalSensitivity,
        exposureIndex,
        evidenceIds
      };
    }).sort((a, b) => b.exposureIndex - a.exposureIndex);
  }, [scoreBreakdown]);

  const currentExpanded = exposureRows.find((item) => item.id === expandedId) || exposureRows[0];
  const expandedNews = useMemo(() => {
    if (!currentExpanded) return [];
    const set = new Set(currentExpanded.evidenceIds);
    return (news || []).filter((item) => set.has(item.id));
  }, [currentExpanded, news]);

  const riskLevel = getRiskLevel(scoreBreakdown?.final?.overall ?? 0);
  const riskSubtitle = buildRiskSubtitle(insight, exposureRows[0]?.name || '支付链路');

  const simulationActions = [
    { label: '优化支付成功率 1pp', patch: { paymentSuccessDelta: 1 } },
    { label: '上调佣金 0.5pp', patch: { commissionDelta: 0.5 } },
    { label: '提升 ARPU 3%', patch: { arpuDelta: 3 } },
    { label: 'AI 功能升级', patch: { arpuDelta: 1.5, paymentSuccessDelta: 0.5, commissionDelta: -0.1 } }
  ];

  const formatSliderValue = (key, value) => {
    if (key === 'commissionDelta') return `${value.toFixed(2)}pp`;
    return `${value.toFixed(1)}%`;
  };

  return (
    <section className="rounded-3xl border border-blue-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100 lg:text-2xl">收入影响沙盘</h2>
        <div className="flex items-center gap-2">
          <MethodPopover />
          <button
            type="button"
            onClick={() => onOpenEvidence(result.evidence)}
            className="rounded-full border border-blue-300/35 bg-blue-300/10 px-3 py-1 text-xs text-blue-200"
          >
            数据接口: {result.endpoint} · 查看引用新闻
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
          <p className="mb-4 text-sm text-slate-300">行动模拟</p>
          <div className="space-y-4">
            {sliders.map((item) => (
              <div key={item.key}>
                <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                  <span>{item.label}</span>
                  <span className="text-cyan-200">{formatSliderValue(item.key, Number(item.value))}</span>
                </div>
                <input
                  type="range"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={item.value}
                  onChange={(e) => onScenarioChange(item.key, Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {simulationActions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onScenarioApply(applyScenarioPatch(scenario, item.patch))}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-slate-400">GMV 影响区间</p>
              <p className="mt-1 text-cyan-200">{result.outputs.gmv}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-slate-400">订阅影响</p>
              <p className="mt-1 text-cyan-200">{result.outputs.subscription}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-slate-400">佣金影响</p>
              <p className="mt-1 text-cyan-200">{result.outputs.commission}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <p className="text-slate-400">支付成本变化</p>
              <p className="mt-1 text-cyan-200">{result.outputs.paymentCost}</p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4">
          <p className="mb-3 text-sm font-medium text-cyan-200">Strategic Dashboard Panel</p>

          <div className={`rounded-xl border px-4 py-3 ${getRiskTone(riskLevel)}`}>
            <p className="text-xs">当前战略风险等级</p>
            <p className="mt-1 text-2xl font-semibold">{riskLevel}</p>
            <p className="mt-2 text-xs opacity-90">{riskSubtitle}</p>
            <p className="mt-2 text-[11px] opacity-80">
              Final {scoreBreakdown?.final?.overall ?? 0}（Baseline {scoreBreakdown?.baseline?.overall ?? 0} / Δ{' '}
              {formatDelta(scoreBreakdown?.delta?.overall ?? 0)}）
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <p className="mb-2 text-sm text-slate-200">收入结构暴露矩阵</p>
            <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-2 text-[11px] text-slate-400">
              <span>维度</span>
              <span>外部风险</span>
              <span>内部敏感度</span>
              <span>综合暴露</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {exposureRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setExpandedId(row.id)}
                  className={`grid w-full grid-cols-[1.1fr_1fr_1fr_1fr] items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs ${
                    expandedId === row.id ? 'border-cyan-300/40 bg-cyan-400/5' : 'border-slate-700 bg-slate-900/50'
                  }`}
                  title={`Baseline ${row.baseline} / Δ ${formatDelta(row.delta)} / Final ${row.final}`}
                >
                  <span className="text-slate-200">{row.name}</span>
                  <span className="text-slate-300">{row.externalRisk.toFixed(2)}</span>
                  <span className="text-slate-300">{row.internalSensitivity.toFixed(2)}</span>
                  <span className={getExposureTone(row.exposureIndex)}>{row.exposureIndex.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
            <p className="mb-2 text-sm text-slate-200">战略优先级排序</p>
            <div className="space-y-1.5 text-xs">
              {exposureRows.map((row, index) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5">
                  <span className="text-slate-100">
                    <span className="mr-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-cyan-200">P{index}</span>
                    {row.name}
                  </span>
                  <span className={getExposureTone(row.exposureIndex)}>{row.exposureIndex.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      {currentExpanded ? (
        <article className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <p className="text-sm font-medium text-cyan-200">可解释因果链：{currentExpanded.name}</p>
          <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-5">
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2">
              <p className="text-slate-400">政策/新闻信号数量</p>
              <p className="mt-1">{currentExpanded.evidenceIds.length}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2">
              <p className="text-slate-400">Baseline</p>
              <p className="mt-1">{currentExpanded.baseline}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2">
              <p className="text-slate-400">内部敏感度</p>
              <p className="mt-1">{currentExpanded.internalSensitivity.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2">
              <p className="text-slate-400">Δ 影响</p>
              <p className="mt-1">{formatDelta(currentExpanded.delta)}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2">
              <p className="text-slate-400">Final</p>
              <p className="mt-1">{currentExpanded.final}</p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-slate-300">引用新闻</p>
              <button
                type="button"
                onClick={() =>
                  onOpenEvidence({
                    id: `ev-chain-${currentExpanded.id}`,
                    title: `${currentExpanded.name} 因果链引用`,
                    newsIds: currentExpanded.evidenceIds
                  })
                }
                className="text-xs text-cyan-200 hover:underline"
              >
                查看全部证据
              </button>
            </div>
            <div className="space-y-2">
              {expandedNews.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-2">
                  <p className="text-xs text-slate-100">{item.title}</p>
                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{item.aiTldr}</p>
                  <a
                    href={item.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-[11px] text-cyan-200 hover:underline"
                  >
                    打开原文
                  </a>
                </div>
              ))}
              {expandedNews.length === 0 ? <p className="text-xs text-slate-500">暂无引用新闻</p> : null}
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}

export default RevenueImpact;
