import { useMemo, useState } from 'react';
import MethodPopover from './ui/MethodPopover';
import { track } from '../lib/analytics';

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
  if (level === '高风险') return 'app-chip-risk-high';
  if (level === '中高') return 'app-chip-risk-mid';
  if (level === '中性') return 'app-chip-info';
  return 'app-chip-risk-low';
}

function getExposureTone(index) {
  if (index >= 0.7) return 'app-danger-text';
  if (index >= 0.4) return 'app-warning-text';
  return 'app-success-text';
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

function applySpotlight(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  event.currentTarget.style.setProperty('--spotlight-x', `${x}px`);
  event.currentTarget.style.setProperty('--spotlight-y', `${y}px`);
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

  if (!result || !scoreBreakdown) {
    return (
      <section data-ga-section="sandbox" className="app-section rounded-3xl p-6 backdrop-blur-xl lg:p-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="app-text-primary text-xl font-semibold lg:text-2xl">收入影响沙盘</h2>
          <span className="app-text-muted text-xs">加载中...</span>
        </div>
        <div className="app-card mt-4 rounded-xl p-4 text-sm app-text-muted">
          收入沙盘与评分拆解正在计算，请稍候。
        </div>
      </section>
    );
  }

  return (
    <section data-ga-section="sandbox" className="app-section rounded-3xl p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="app-text-primary text-xl font-semibold lg:text-2xl">收入影响沙盘</h2>
        <div className="flex items-center gap-2">
          <MethodPopover />
          <button
            type="button"
            onClick={() => onOpenEvidence(result.evidence)}
            className="rounded-full app-accent-chip px-3 py-1.5 text-xs"
          >
            数据接口: {result.endpoint} · 查看引用新闻
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <article onPointerMove={applySpotlight} className="app-card app-card-spotlight rounded-2xl p-4">
          <p className="app-text-secondary mb-4 text-sm">行动模拟</p>
          <div className="space-y-4">
            {sliders.map((item) => (
              <div key={item.key}>
                <div className="app-text-secondary mb-2 flex items-center justify-between text-xs">
                  <span>{item.label}</span>
                  <span className="app-accent-text">{formatSliderValue(item.key, Number(item.value))}</span>
                </div>
                <input
                  type="range"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={item.value}
                  onChange={(e) => onScenarioChange(item.key, Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: 'var(--app-accent)' }}
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
                className="rounded-lg app-button-secondary px-3 py-1.5 text-xs"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
            <div className="app-card-soft rounded-lg p-3">
              <p className="app-text-muted">GMV 影响区间</p>
              <p className="app-accent-text mt-1">{result.outputs.gmv}</p>
            </div>
            <div className="app-card-soft rounded-lg p-3">
              <p className="app-text-muted">订阅影响</p>
              <p className="app-accent-text mt-1">{result.outputs.subscription}</p>
            </div>
            <div className="app-card-soft rounded-lg p-3">
              <p className="app-text-muted">佣金影响</p>
              <p className="app-accent-text mt-1">{result.outputs.commission}</p>
            </div>
            <div className="app-card-soft rounded-lg p-3">
              <p className="app-text-muted">支付成本变化</p>
              <p className="app-accent-text mt-1">{result.outputs.paymentCost}</p>
            </div>
          </div>
        </article>

        <article onPointerMove={applySpotlight} className="app-accent-panel app-card-spotlight rounded-2xl p-4">
          <p className="app-accent-text mb-3 text-sm font-medium">Strategic Dashboard Panel</p>

          <div className={`rounded-xl border px-4 py-3 ${getRiskTone(riskLevel)}`}>
            <p className="text-xs">当前战略风险等级</p>
            <p className="mt-1 text-2xl font-semibold">{riskLevel}</p>
            <p className="mt-2 text-xs opacity-90">{riskSubtitle}</p>
            <p className="mt-2 text-[11px] opacity-80">
              Final {scoreBreakdown?.final?.overall ?? 0}（Baseline {scoreBreakdown?.baseline?.overall ?? 0} / Δ{' '}
              {formatDelta(scoreBreakdown?.delta?.overall ?? 0)}）
            </p>
          </div>

          <div onPointerMove={applySpotlight} className="app-card app-card-spotlight mt-4 rounded-xl p-3">
            <p className="app-text-primary mb-2 text-sm">收入结构暴露矩阵</p>
            <div className="app-text-muted grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-2 text-[11px]">
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
                  className={`grid w-full grid-cols-[1.1fr_1fr_1fr_1fr] items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs ${
                    expandedId === row.id ? 'app-card-selected' : 'app-card-soft app-card-hoverable'
                  }`}
                  title={`Baseline ${row.baseline} / Δ ${formatDelta(row.delta)} / Final ${row.final}`}
                >
                  <span className="app-text-primary">{row.name}</span>
                  <span className="app-text-secondary">{row.externalRisk.toFixed(2)}</span>
                  <span className="app-text-secondary">{row.internalSensitivity.toFixed(2)}</span>
                  <span className={getExposureTone(row.exposureIndex)}>{row.exposureIndex.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>

          <div onPointerMove={applySpotlight} className="app-card app-card-spotlight mt-4 rounded-xl p-3">
            <p className="app-text-primary mb-2 text-sm">战略优先级排序</p>
            <div className="space-y-1.5 text-xs">
              {exposureRows.map((row, index) => (
                <div key={row.id} className="app-card-soft flex items-center justify-between rounded-xl px-3 py-2">
                  <span className="app-text-primary">
                    <span className="app-accent-chip mr-2 rounded px-1.5 py-0.5 text-[10px]">P{index}</span>
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
        <article onPointerMove={applySpotlight} className="app-card app-card-spotlight mt-5 rounded-2xl p-4">
          <p className="app-accent-text text-sm font-medium">可解释因果链：{currentExpanded.name}</p>
          <div className="app-text-secondary mt-3 grid gap-2 text-xs md:grid-cols-5">
            <div className="app-card-soft rounded-lg p-2">
              <p className="app-text-muted">政策/新闻信号数量</p>
              <p className="mt-1">{currentExpanded.evidenceIds.length}</p>
            </div>
            <div className="app-card-soft rounded-lg p-2">
              <p className="app-text-muted">Baseline</p>
              <p className="mt-1">{currentExpanded.baseline}</p>
            </div>
            <div className="app-card-soft rounded-lg p-2">
              <p className="app-text-muted">内部敏感度</p>
              <p className="mt-1">{currentExpanded.internalSensitivity.toFixed(2)}</p>
            </div>
            <div className="app-card-soft rounded-lg p-2">
              <p className="app-text-muted">Δ 影响</p>
              <p className="mt-1">{formatDelta(currentExpanded.delta)}</p>
            </div>
            <div className="app-card-soft rounded-lg p-2">
              <p className="app-text-muted">Final</p>
              <p className="mt-1">{currentExpanded.final}</p>
            </div>
          </div>

          <div className="app-card-soft mt-3 rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="app-text-secondary text-xs">引用新闻</p>
              <button
                type="button"
                onClick={() =>
                  onOpenEvidence({
                    id: `ev-chain-${currentExpanded.id}`,
                    title: `${currentExpanded.name} 因果链引用`,
                    newsIds: currentExpanded.evidenceIds
                  })
                }
                className="app-accent-text text-xs hover:underline"
              >
                查看全部证据
              </button>
            </div>
            <div className="space-y-2">
              {expandedNews.slice(0, 6).map((item) => (
                <div key={item.id} className="app-card rounded-lg px-2 py-2">
                  <p className="app-text-primary text-xs">{item.title}</p>
                  <p className="app-text-muted mt-1 line-clamp-2 text-[11px]">{item.aiTldr}</p>
                  <a
                    href={item.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      let domain = '';
                      try {
                        domain = item?.originalUrl ? new URL(item.originalUrl).hostname : '';
                      } catch {
                        domain = '';
                      }
                      track('citation_click', { news_id: String(item?.id || ''), domain });
                    }}
                    className="app-accent-text mt-1 inline-block text-[11px] hover:underline"
                  >
                    打开原文
                  </a>
                </div>
              ))}
              {expandedNews.length === 0 ? <p className="app-text-faint text-xs">暂无引用新闻</p> : null}
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}

export default RevenueImpact;
