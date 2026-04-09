import { useEffect, useMemo, useState } from "react";
import DriversPanel, { buildDriverItems } from "./strategy/DriversPanel";
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

function applySpotlight(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  event.currentTarget.style.setProperty("--spotlight-x", `${x}px`);
  event.currentTarget.style.setProperty("--spotlight-y", `${y}px`);
}

function StrategicOverview({
  strategyBrief,
  indexes,
  selectedDate,
  onSelectedDateChange,
  availableNewsIds = [],
  onOpenEvidence
}) {
  const [metricsOpen, setMetricsOpen] = useState(false);
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
  const evidenceNewsIds = useMemo(() => {
    const citationIds = citations
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean);
    if (citationIds.length > 0) return citationIds;
    return availableNewsIds;
  }, [citations, availableNewsIds]);

  const coverageText = `数据覆盖：${brief?.meta?.news_count_scanned || 0} | 命中：${brief?.meta?.news_count_used || 0} | 高影响：${brief?.meta?.high_impact || 0}`;

  const heroBriefs = [
    {
      label: "关键驱动",
      title: safeText(drivers?.[0]?.title, "暂无高优先驱动"),
      body: safeText(drivers?.[0]?.note, safeText(brief.one_liner, "继续观察外部信号变化。"))
    },
    {
      label: "主要影响面",
      title: safeText(impactGrid?.[0]?.title, "影响拆解"),
      body: safeText(impactGrid?.[0]?.text, "当前暂无更细拆解。")
    },
    {
      label: "当前优先行动",
      title: `${safeText(actions?.[0]?.priority, "P0")} · ${safeText(actions?.[0]?.timeframe, "24-72h")}`,
      body: safeText(actions?.[0]?.action, "暂无更高优先动作，建议保持跟踪。")
    }
  ];

  return (
    <section data-ga-section="overview" className="app-section rounded-[28px] p-4 backdrop-blur-xl lg:p-5">
      <div className="app-hero-card rounded-[24px] p-4 lg:p-5">
        <div className="app-info-rail rounded-[20px] p-3.5 lg:p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,360px)_1fr_auto] xl:items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="brief-date" className="app-text-muted min-w-[32px] whitespace-nowrap text-[11px]">日期</label>
              <input
                id="brief-date"
                type="date"
                value={selectedDate}
                onChange={(e) => onSelectedDateChange(String(e.target.value || "").slice(0, 10))}
                className="app-input w-full rounded-xl px-2.5 py-2 text-[11px] outline-none focus:border-cyan-300/50"
              />
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
                    onSelectedDateChange(now.toISOString().slice(0, 10));
                  }}
                  className="rounded-xl app-button-secondary min-w-[64px] whitespace-nowrap px-3 py-2 text-[11px]"
                >
                  今天
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="app-pill">{coverageText}</span>
              {briefLoading ? <span className="app-pill app-accent-text">加载中...</span> : null}
              {!briefLoading && briefHint ? <span className="app-pill app-warning-text">{briefHint}</span> : null}
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
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
                className="app-button-primary rounded-xl px-4 py-2 text-[11px] font-medium"
              >
                查看证据
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="app-section-label">Today Strategic Thesis</p>
          <h3 className="app-text-primary mt-3 max-w-5xl text-2xl font-semibold leading-tight whitespace-normal break-words lg:text-[30px]">
            {safeText(brief.headline, "今日暂无清晰结论")}
          </h3>
          <p className="app-text-secondary mt-3 max-w-4xl text-sm leading-7 whitespace-normal break-words lg:text-[15px]">
            {sanitizeTechPhrase(safeText(brief.one_liner, "暂无结论解释")) || "暂无结论解释"}
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {heroBriefs.map((item) => (
            <article
              key={item.label}
              onPointerMove={applySpotlight}
              className="app-card-soft app-card-hoverable app-card-spotlight rounded-2xl p-3.5"
            >
              <p className="app-text-faint text-[10px] uppercase tracking-[0.18em]">{item.label}</p>
              <p className="app-text-primary mt-2 text-[13px] font-medium leading-6">{item.title}</p>
              <div className="mt-2 max-h-32 overflow-auto strategic-scroll pr-1">
                <p className="app-text-secondary text-[11px] leading-6 whitespace-normal break-words">{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <DriversPanel drivers={drivers} />

        <section data-ga-section="impacts" className="app-card rounded-[22px] p-4">
          <p className="app-section-label">SaaS 影响拆解</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {impactGrid.map((item) => (
              <article
                key={item.id}
                onPointerMove={applySpotlight}
                className="app-card-soft app-card-hoverable app-card-spotlight rounded-2xl p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="app-text-muted text-[11px] uppercase tracking-[0.18em]">{item.title}</p>
                  {item.tag ? <span className="rounded-full app-chip-neutral px-2 py-1 text-[10px]">{item.tag}</span> : null}
                </div>
                <div className="mt-2 max-h-24 overflow-auto strategic-scroll pr-1">
                  <p className="app-text-primary text-[12px] leading-6 whitespace-normal break-words">{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section id="strategic-actions" data-ga-section="actions" className="app-card mt-4 rounded-[22px] p-4">
        <p className="app-section-label">优先行动</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {actions.map((item) => (
            <article
              key={item.priority}
              data-action-priority={item.priority}
              onPointerMove={applySpotlight}
              className="app-card-soft app-card-hoverable app-card-spotlight rounded-2xl p-3.5"
              onClick={() =>
                track('action_item_click', {
                  priority: item.priority,
                  owner: item.owner,
                  timeframe: item.timeframe
                })
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="app-accent-chip rounded-full px-2.5 py-1 text-[10px] font-medium">{item.priority}</span>
                <span className="app-text-faint text-[10px]">{item.timeframe}</span>
              </div>
              <p className="app-text-muted mt-2 text-[11px]">Owner：{item.owner}</p>
              <div className="mt-2 max-h-28 overflow-auto strategic-scroll pr-1">
                <p className="app-text-primary text-[12px] leading-6 whitespace-normal break-words">{item.action}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section data-ga-section="kpi" className="app-card mt-4 rounded-[22px] p-4">
        <div className="flex items-center justify-between">
          <p className="app-section-label">战略指标</p>
          <button
            type="button"
            onClick={() => setMetricsOpen((v) => !v)}
            className="app-accent-text text-xs underline-offset-4 hover:underline"
          >
            {metricsOpen ? "收起指标" : "查看指标证据"}
          </button>
        </div>

        {metricsOpen ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {(indexes || []).map((index, idx) => (
              <article
                key={index.id}
                data-emphasis={idx === 0 ? "true" : "false"}
                className="app-metric-card app-card-soft rounded-2xl p-3.5"
              >
                <p className="app-text-muted text-[11px] whitespace-normal break-words">{index.name}</p>
                <div className="mt-3 flex items-end gap-2">
                  <p className="app-accent-text text-[28px] font-semibold leading-none">{index.value}</p>
                  <p className="app-success-text text-[11px] font-medium">{index.delta}</p>
                </div>
                <div className="mt-3 max-h-16 overflow-auto strategic-scroll pr-1">
                  <p className="app-text-muted text-[11px] leading-5 whitespace-normal break-words">{index.description}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <p className="app-text-faint text-[10px]">引用新闻</p>
          <button
            type="button"
            onClick={() => setCitationsOpen((v) => !v)}
            className="app-accent-text text-xs underline-offset-4 hover:underline"
          >
            {citationsOpen ? "收起引用" : `展开引用（${citations.length}）`}
          </button>
        </div>

        {citationsOpen ? (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {citations.slice(0, 3).map((news, idx) => (
              <li key={`${safeText(news?.id, `cite-${idx}`)}-${idx}`} className="app-card-soft rounded-2xl p-3">
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
                  className="app-text-secondary text-[11px] leading-5 whitespace-normal break-words"
                >
                  <span className="app-text-muted">{safeText(news?.source, "Unknown")}：</span>
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
