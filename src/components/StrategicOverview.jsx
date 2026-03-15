import { useEffect, useMemo, useState } from "react";
import DriversPanel, { buildDriverItems } from "./strategy/DriversPanel";
import ExpandableText from "./strategy/ExpandableText";
import { track } from "../lib/analytics";
import { api } from "../services/api";

const safeText = (value, fallback = "") => {
  const text = String(value || "").trim();
  return text || fallback;
};

function sanitizeTechPhrase(text) {
  return String(text || "")
    .replace(/由\s*daily_brief\s*提供结构化结论/g, "")
    .replace(/仅基于\s*news_raw/g, "")
    .replace(/样本少[（(].*?[）)][:：]?\s*/g, "")
    .replace(/样本少/g, "")
    .replace(/无关业务/g, "")
    .replace(/需观察/g, "")
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

function StrategicOverview({
  strategyBrief,
  indexes,
  selectedDate,
  onSelectedDateChange,
  availableNewsIds = [],
  onOpenEvidence
}) {
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [selectedBrief, setSelectedBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefHint, setBriefHint] = useState("");

  useEffect(() => {
    let mounted = true;
    setBriefLoading(true);
    setBriefHint("");

    api
      .getDailyBrief(selectedDate)
      .then((row) => {
        if (!mounted) return;
        if (row) {
          setSelectedBrief(row);
          return;
        }
        setSelectedBrief(null);
        setBriefHint(`所选日期 ${selectedDate} 暂无 daily_brief，已显示当前可用简报。`);
      })
      .catch(() => {
        if (!mounted) return;
        setSelectedBrief(null);
        setBriefHint("日期简报读取失败，已显示当前可用简报。");
      })
      .finally(() => {
        if (mounted) setBriefLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  const brief = selectedBrief || strategyBrief || {
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
  const availableNewsIdSet = useMemo(() => new Set(availableNewsIds), [availableNewsIds]);
  const evidenceNewsIds = useMemo(() => {
    const citationIds = citations
      .map((item) => String(item?.id || "").trim())
      .filter((id) => id && availableNewsIdSet.has(id));
    if (citationIds.length > 0) return citationIds;
    return availableNewsIds;
  }, [citations, availableNewsIds, availableNewsIdSet]);

  const coverageText = `数据覆盖：${brief?.meta?.news_count_scanned || 0} | 命中：${brief?.meta?.news_count_used || 0} | 高影响：${brief?.meta?.high_impact || 0}`;

  const sourceText = brief?.meta?.brief_source === "daily_brief"
    ? "来源：news_raw + daily_brief"
    : "来源：news_raw";

  return (
    <section data-ga-section="overview" className="rounded-3xl border border-cyan-300/20 bg-slate-900/60 p-3 shadow-[0_0_32px_rgba(56,189,248,0.10)] backdrop-blur-xl lg:p-3.5">
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
            <div className="flex items-center gap-1.5">
              <label htmlFor="brief-date" className="text-[10px] text-slate-400">日期</label>
              <input
                id="brief-date"
                type="date"
                value={selectedDate}
                onChange={(e) => onSelectedDateChange(String(e.target.value || "").slice(0, 10))}
                className="rounded-md border border-slate-700 bg-slate-900/85 px-1.5 py-0.5 text-[10px] text-slate-200 outline-none focus:border-cyan-300/50"
              />
              <button
                type="button"
                onClick={() => {
                  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
                  onSelectedDateChange(now.toISOString().slice(0, 10));
                }}
                className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
              >
                今天
              </button>
            </div>
            <span className="group relative rounded-full border border-slate-700/90 bg-slate-900/85 px-2 py-0.5 text-[10px] text-slate-300 cursor-default">
              {coverageText}
              <span className="strategic-tooltip">命中=被用于生成结论的新闻条数；数据覆盖=当天扫描条数。</span>
            </span>
            <span className="text-[10px] text-slate-500">{sourceText}</span>
            <span className="text-[10px] text-slate-500">{safeText(brief.time_window, "今天")} (UTC+8)</span>
            {briefLoading ? <span className="text-[10px] text-cyan-300">加载中...</span> : null}
            {!briefLoading && briefHint ? <span className="text-[10px] text-amber-300">{briefHint}</span> : null}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
          <button
            type="button"
            onClick={() =>
              onOpenEvidence({
                title: "战略证据",
                newsIds: evidenceNewsIds,
                source: "daily_brief",
                items: citations.map((item, idx) => ({
                  id: String(item?.id || `brief-citation-${idx}`),
                  title: safeText(item?.title, `引用新闻 ${idx + 1}`),
                  source: safeText(item?.source, "daily_brief"),
                  publishDate: safeText(item?.published_at, "").slice(0, 10),
                  impactScore: Number(item?.impact_score || 0),
                  aiTldr: safeText(item?.summary || item?.why_it_matters || brief?.one_liner, "暂无摘要"),
                  originalUrl: safeText(item?.url, "#")
                }))
              })
            }
            className="rounded-md border border-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            查看证据
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-2 xl:grid-cols-[1.15fr_1fr]">
        <DriversPanel drivers={drivers} />

        <section data-ga-section="impacts" className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-2.5">
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

      <section id="strategic-actions" data-ga-section="actions" className="mt-2 rounded-xl border border-slate-700/70 bg-slate-950/70 p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">优先行动</p>
        <div className="mt-1.5 grid gap-1.5 md:grid-cols-3">
          {actions.map((item) => (
            <article
              key={item.priority}
              data-action-priority={item.priority}
              className="rounded-md border border-slate-700/60 bg-slate-900/75 p-2"
              onClick={() =>
                track('action_item_click', {
                  priority: item.priority,
                  owner: item.owner,
                  timeframe: item.timeframe
                })
              }
            >
              <p className="text-[11px] text-slate-400">{item.priority} · {item.timeframe} · Owner：{item.owner}</p>
              <div className="mt-1 max-h-28 overflow-auto strategic-scroll pr-1">
                <ExpandableText text={item.action} collapsedChars={150} className="text-[12px] leading-snug text-slate-100" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section data-ga-section="kpi" className="mt-2 rounded-xl border border-slate-700/60 bg-slate-950/55 p-2.5">
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
                <a
                  href={safeText(news?.url, "#")}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    const href = safeText(news?.url, '');
                    let domain = '';
                    try {
                      domain = href ? new URL(href).hostname : '';
                    } catch {
                      domain = '';
                    }
                    track('citation_click', {
                      news_id: safeText(news?.id, ''),
                      domain
                    });
                  }}
                  className="text-[11px] text-slate-300 hover:text-cyan-200 whitespace-normal break-words"
                >
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
