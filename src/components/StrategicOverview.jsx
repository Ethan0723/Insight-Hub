import { useMemo, useState } from "react";
import DriversPanel, { buildDriverItems } from "./strategy/DriversPanel";
import ExpandableText from "./strategy/ExpandableText";

const safeText = (value, fallback = "") => {
  const text = String(value || "").trim();
  return text || fallback;
};

function sanitizeTechPhrase(text) {
  return String(text || "")
    .replace(/由\s*daily_brief\s*提供结构化结论/g, "")
    .replace(/仅基于\s*news_raw/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildImpactGrid(brief) {
  const model = brief?.impact_on_revenue_model || {};
  const impacts = brief?.impacts || {};

  const rows = [
    {
      id: "subscription",
      title: "订阅",
      text: safeText(impacts?.merchant_demand, safeText(model?.subscription?.note, "订阅侧暂无明显变化")),
      tag: model?.subscription?.direction === "↑" ? "上行" : model?.subscription?.direction === "↓" ? "下行" : "中性",
    },
    {
      id: "commission",
      title: "佣金",
      text: safeText(impacts?.acquisition, safeText(model?.commission?.note, "佣金侧暂无明显变化")),
      tag: model?.commission?.direction === "↑" ? "上行" : model?.commission?.direction === "↓" ? "下行" : "中性",
    },
    {
      id: "payment",
      title: "支付",
      text: safeText(impacts?.payments_risk, safeText(model?.payment?.note, "支付侧暂无明显变化")),
      tag: model?.payment?.direction === "↑" ? "上行" : model?.payment?.direction === "↓" ? "下行" : "中性",
    },
    {
      id: "ecosystem",
      title: "生态",
      text: safeText(impacts?.competition, safeText(model?.ecosystem?.note, "生态侧暂无明显变化")),
      tag: model?.ecosystem?.direction === "↑" ? "上行" : model?.ecosystem?.direction === "↓" ? "下行" : "中性",
    },
  ];

  return rows.map((item) => ({ ...item, text: sanitizeTechPhrase(item.text) || "暂无扩展内容" }));
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
      owner: safeText(hit?.owner, "待定"),
      action: safeText(hit?.action, "暂无明确行动，建议保持跟踪。"),
    };
  });
}

function StrategicOverview({ strategyBrief, indexes, onOpenEvidence }) {
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [citationsOpen, setCitationsOpen] = useState(false);

  const brief = strategyBrief || {
    headline: "今日未发现高影响信号",
    one_liner: "暂无可用结论，继续观察。",
    time_window: "今天",
    top_drivers: [],
    citations: [],
    impact_on_revenue_model: {
      subscription: { direction: "→", note: "无数据" },
      commission: { direction: "→", note: "无数据" },
      payment: { direction: "→", note: "无数据" },
      ecosystem: { direction: "→", note: "无数据" },
    },
    actions: [],
    impacts: {},
    meta: { news_count_scanned: 0, news_count_used: 0, generated_at: "", direct_signal_count: undefined },
  };

  const drivers = useMemo(() => buildDriverItems(brief), [brief]);
  const impactGrid = useMemo(() => buildImpactGrid(brief), [brief]);
  const actions = useMemo(() => buildPriorityActions(brief), [brief]);
  const citations = useMemo(() => (Array.isArray(brief?.citations) ? brief.citations : []), [brief]);

  const coverageText = typeof brief?.meta?.direct_signal_count === "number"
    ? `数据覆盖：${brief?.meta?.news_count_scanned || 0} 条（业务相关：${brief.meta.direct_signal_count}）`
    : `数据覆盖：${brief?.meta?.news_count_scanned || 0} 条`;

  const sourceText = brief?.meta?.brief_source === "daily_brief"
    ? "来源：news_raw + daily_brief"
    : "来源：news_raw";

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-900/60 p-3 shadow-[0_0_32px_rgba(56,189,248,0.10)] backdrop-blur-xl lg:p-3.5">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/75 p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">AI 今日战略判断</p>
            <h3 className="mt-1 text-xl font-semibold leading-tight text-slate-100 whitespace-normal break-words">
              {safeText(brief.headline, "今日暂无清晰结论")}
            </h3>
            <p className="mt-1 text-sm leading-snug text-slate-300 whitespace-normal break-words">
              {sanitizeTechPhrase(safeText(brief.one_liner, "暂无结论解释")) || "暂无结论解释"}
            </p>
          </div>

          <div className="flex items-start gap-1.5 md:flex-col md:items-end">
            <span className="group relative rounded-full border border-slate-700/90 bg-slate-900/85 px-2 py-0.5 text-[10px] text-slate-300 cursor-default">
              {coverageText}
              <span className="strategic-tooltip">业务相关用于提示样本命中质量，仅作阅读参考。</span>
            </span>
            <span className="text-[10px] text-slate-500">{sourceText}</span>
            <span className="text-[10px] text-slate-500">{safeText(brief.time_window, "今天")} (UTC+8)</span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
          <button
            type="button"
            onClick={() => document.getElementById("strategic-actions")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-md border border-cyan-300/40 bg-cyan-300/15 px-2.5 py-1 text-[11px] font-medium text-cyan-100 hover:bg-cyan-300/25"
          >
            查看行动板
          </button>
          <button
            type="button"
            onClick={() => onOpenEvidence({ title: "战略证据", newsIds: (indexes || []).flatMap((i) => i?.evidence?.newsIds || []) })}
            className="rounded-md border border-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            查看证据
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-2 xl:grid-cols-[1.15fr_1fr]">
        <DriversPanel drivers={drivers} />

        <section className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">SaaS 影响拆解</p>
          <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {impactGrid.map((item) => (
              <article key={item.id} className="rounded-md border border-slate-700/60 bg-slate-900/75 p-2">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{item.title}</p>
                  {item.tag ? <span className="text-[10px] text-slate-500">{item.tag}</span> : null}
                </div>
                <div className="mt-1 max-h-24 overflow-auto strategic-scroll pr-1">
                  <ExpandableText text={item.text} collapsedChars={120} className="text-[12px] leading-snug text-slate-100" />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section id="strategic-actions" className="mt-2 rounded-xl border border-slate-700/70 bg-slate-950/70 p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">优先行动</p>
        <div className="mt-1.5 grid gap-1.5 md:grid-cols-3">
          {actions.map((item) => (
            <article key={item.priority} className="rounded-md border border-slate-700/60 bg-slate-900/75 p-2">
              <p className="text-[11px] text-slate-400">{item.priority} · {item.timeframe} · Owner：{item.owner}</p>
              <div className="mt-1 max-h-28 overflow-auto strategic-scroll pr-1">
                <ExpandableText text={item.action} collapsedChars={150} className="text-[12px] leading-snug text-slate-100" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-2 rounded-xl border border-slate-700/60 bg-slate-950/55 p-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">战略指标</p>
          <button
            type="button"
            onClick={() => setMetricsOpen((v) => !v)}
            className="text-xs text-cyan-200 underline-offset-4 hover:underline"
          >
            {metricsOpen ? "收起指标" : "查看指标证据"}
          </button>
        </div>

        {metricsOpen ? (
          <div className="mt-1.5 grid gap-1.5 md:grid-cols-2 xl:grid-cols-5">
            {(indexes || []).map((index) => (
              <article key={index.id} className="rounded-md border border-slate-700/60 bg-slate-900/75 p-2">
                <p className="text-[11px] text-slate-400 whitespace-normal break-words">{index.name}</p>
                <div className="mt-1 flex items-end gap-1.5">
                  <p className="text-xl font-semibold leading-none text-cyan-200">{index.value}</p>
                  <p className="text-[11px] text-emerald-300">{index.delta}</p>
                </div>
                <div className="mt-1 max-h-16 overflow-auto strategic-scroll pr-1">
                  <p className="text-[11px] leading-snug text-slate-400 whitespace-normal break-words">{index.description}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[10px] text-slate-500">引用新闻</p>
          <button
            type="button"
            onClick={() => setCitationsOpen((v) => !v)}
            className="text-xs text-cyan-200 underline-offset-4 hover:underline"
          >
            {citationsOpen ? "收起引用" : `展开引用（${citations.length}）`}
          </button>
        </div>

        {citationsOpen ? (
          <ul className="mt-1.5 grid gap-1.5 md:grid-cols-2">
            {citations.slice(0, 3).map((news, idx) => (
              <li key={`${safeText(news?.id, `cite-${idx}`)}-${idx}`} className="rounded border border-slate-700/50 bg-slate-900/70 p-2">
                <a href={safeText(news?.url, "#")} target="_blank" rel="noreferrer" className="text-[11px] text-slate-300 hover:text-cyan-200 whitespace-normal break-words">
                  <span className="text-slate-400">{safeText(news?.source, "Unknown")}：</span>
                  {safeText(news?.title, "来源条目（标题缺失）")}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  );
}

export default StrategicOverview;
