import { useMemo } from "react";

const riskRank = { 高: 3, 中: 2, 低: 1 };

const clamp = (lines) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

const safeText = (value, fallback = "") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const safeDateValue = (value) => {
  const ts = Date.parse(String(value || ""));
  return Number.isNaN(ts) ? 0 : ts;
};

function sortByPriority(items) {
  return [...items].sort((a, b) => {
    const impactDiff = Number(b?.impact_score || 0) - Number(a?.impact_score || 0);
    if (impactDiff !== 0) return impactDiff;
    const riskDiff = (riskRank[b?.risk_level] || 0) - (riskRank[a?.risk_level] || 0);
    if (riskDiff !== 0) return riskDiff;
    return safeDateValue(b?.created_at || b?.published_at) - safeDateValue(a?.created_at || a?.published_at);
  });
}

function inferDirection(text, riskLevel) {
  const content = String(text || "").toLowerCase();
  if (/(增长|回暖|提升|走强|扩张|改善|上行|加速|机会)/.test(content)) return "↑";
  if (/(下降|收缩|承压|风险|下滑|走弱|恶化|放缓|波动)/.test(content)) return "↓";
  if (riskLevel === "高") return "↓";
  return "=";
}

function normalizeVariableName(raw, index) {
  const seed = safeText(raw, `变量${index + 1}`)
    .split(/[：:，,。；;|/]/)[0]
    .trim();
  return seed.length > 10 ? `${seed.slice(0, 10)}…` : seed;
}

function buildCoreVariables(brief) {
  const drivers = sortByPriority(Array.isArray(brief?.top_drivers) ? brief.top_drivers : []).slice(0, 3);
  if (drivers.length) {
    return drivers.map((item, idx) => {
      const explain = safeText(item?.why, safeText(brief?.one_liner, "暂无影响解释"));
      return {
        name: normalizeVariableName(item?.title, idx),
        direction: inferDirection(`${item?.title} ${explain}`, item?.risk_level),
        note: explain,
      };
    });
  }

  const fallback = [
    { name: "商家需求", note: safeText(brief?.impacts?.merchant_demand, "需求侧暂无明显波动。") },
    { name: "支付稳定", note: safeText(brief?.impacts?.payments_risk, "支付链路整体可控。") },
    { name: "竞争压力", note: safeText(brief?.impacts?.competition, "竞争态势维持观察。") },
  ];

  return fallback.map((item) => ({ ...item, direction: inferDirection(item.note, "中") }));
}

function buildImpactGrid(brief) {
  const model = brief?.impact_on_revenue_model || {};
  const impacts = brief?.impacts || {};

  return [
    {
      id: "subscription",
      title: "订阅",
      text: safeText(impacts?.merchant_demand, safeText(model?.subscription?.note, "订阅侧暂无明显变化")),
    },
    {
      id: "commission",
      title: "佣金",
      text: safeText(impacts?.acquisition, safeText(model?.commission?.note, "佣金侧暂无明显变化")),
    },
    {
      id: "payment",
      title: "支付",
      text: safeText(impacts?.payments_risk, safeText(model?.payment?.note, "支付侧暂无明显变化")),
    },
    {
      id: "ecosystem",
      title: "生态",
      text: safeText(impacts?.competition, safeText(model?.ecosystem?.note, "生态侧暂无明显变化")),
    },
  ];
}

function buildPriorityActions(brief) {
  const list = Array.isArray(brief?.actions) ? brief.actions : [];

  const findByPriority = (priority) => list.find((item) => safeText(item?.priority) === priority);
  const mapTime = (priority) => (priority === "P0" ? "24-72h" : priority === "P1" ? "1-2w" : "本月");

  return ["P0", "P1", "P2"].map((priority) => {
    const hit = findByPriority(priority);
    return {
      priority,
      timeframe: safeText(hit?.time_horizon, mapTime(priority)),
      owner: safeText(hit?.owner, "战略"),
      action: safeText(hit?.action, "暂无明确行动，建议保持跟踪。"),
    };
  });
}

function StrategicOverview({ strategyBrief, indexes, onOpenEvidence }) {
  const brief = strategyBrief || {
    headline: "今日未发现高影响信号",
    one_liner: "暂无可用结论，继续观察。",
    time_window: "今天",
    top_drivers: [],
    impact_on_revenue_model: {
      subscription: { direction: "→", note: "无数据" },
      commission: { direction: "→", note: "无数据" },
      payment: { direction: "→", note: "无数据" },
      ecosystem: { direction: "→", note: "无数据" },
    },
    actions: [],
    impacts: {},
  };

  const coreVariables = useMemo(() => buildCoreVariables(brief), [brief]);
  const impactGrid = useMemo(() => buildImpactGrid(brief), [brief]);
  const actions = useMemo(() => buildPriorityActions(brief), [brief]);

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-900/60 p-4 shadow-[0_0_45px_rgba(56,189,248,0.12)] backdrop-blur-xl lg:p-5">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/75 p-3.5 lg:p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">AI 今日战略判断</p>
        <h3 className="mt-1.5 text-2xl font-semibold text-slate-100" style={clamp(1)}>{safeText(brief.headline, "今日暂无清晰结论")}</h3>
        <p className="mt-1.5 text-sm text-slate-300" style={clamp(1)}>{safeText(brief.one_liner, "暂无结论解释")}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => document.getElementById("strategic-actions")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-300/20"
          >
            查看行动板
          </button>
          <button
            type="button"
            onClick={() => onOpenEvidence({ title: "战略证据", newsIds: (indexes || []).flatMap((i) => i?.evidence?.newsIds || []) })}
            className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            查看证据
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">核心变量</p>
          <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-3">
            {coreVariables.map((item, idx) => (
              <article key={`${item.name}-${idx}`} className="rounded-lg border border-slate-700/60 bg-slate-900/75 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-100" style={clamp(1)}>{item.name}</p>
                  <span className="text-sm font-semibold text-cyan-200">{item.direction}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400" style={clamp(1)}>{item.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">SaaS 影响</p>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {impactGrid.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-700/60 bg-slate-900/75 p-2.5">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{item.title}</p>
                <p className="mt-1 text-xs text-slate-100" style={clamp(1)}>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section id="strategic-actions" className="mt-3 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">优先行动</p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {actions.map((item) => (
            <article key={item.priority} className="rounded-lg border border-slate-700/60 bg-slate-900/75 p-2.5">
              <p className="text-[11px] text-slate-400">{item.priority} · {item.timeframe} · {item.owner}</p>
              <p className="mt-1 text-xs text-slate-100" style={clamp(1)}>{item.action}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-slate-700/60 bg-slate-950/50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">指数明细</p>
          <button
            type="button"
            onClick={() => onOpenEvidence({ title: "战略指数证据", newsIds: (indexes || []).flatMap((i) => i?.evidence?.newsIds || []) })}
            className="text-xs text-cyan-200 underline-offset-4 hover:underline"
          >
            查看指数证据
          </button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {(indexes || []).map((index) => (
            <article key={index.id} className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-3">
              <p className="text-xs text-slate-400">{index.name}</p>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-2xl font-semibold text-cyan-200">{index.value}</p>
                <p className="pb-0.5 text-xs text-emerald-300">{index.delta}</p>
              </div>
              <p className="mt-2 text-[11px] text-slate-500" style={clamp(2)}>{index.description}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default StrategicOverview;
