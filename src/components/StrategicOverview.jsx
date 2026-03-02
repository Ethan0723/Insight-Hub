import { useMemo, useState } from "react";

const riskRank = { 高: 3, 中: 2, 低: 1 };

const clamp = (lines) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

const isUuidLike = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());

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

function mapActionsByWindow(actions) {
  const groups = {
    "24-72h": [],
    "1-2w": [],
    "本月": []
  };

  (actions || []).forEach((action) => {
    const priority = safeText(action?.priority, "P1");
    let bucket = "1-2w";
    if (priority === "P0") bucket = "24-72h";
    if (priority === "P2") bucket = "本月";

    groups[bucket].push({
      priority,
      owner: safeText(action?.owner, "战略"),
      action: safeText(action?.action, "暂无行动描述"),
      expected_effect: safeText(action?.expected_effect, "待补充指标"),
      time_horizon: safeText(action?.time_horizon, bucket),
    });
  });

  return groups;
}

function getCiteTitle(item) {
  const title = safeText(item?.title);
  if (!title || isUuidLike(title)) return "来源条目（标题缺失）";
  return title;
}

function getCitationSummary(item, fallbackOneLiner) {
  const keys = Array.isArray(item?.matched_keywords) ? item.matched_keywords.filter(Boolean) : [];
  if (keys.length > 0) return `关键词：${keys.slice(0, 3).join(" / ")}`;
  if (safeText(item?.risk_level)) return `风险${item.risk_level}，影响分${item.impact_score ?? 0}。`;
  return safeText(fallbackOneLiner, "暂无摘要");
}

function ImpactCell({ title, data, detail, expanded, onToggle }) {
  const direction = safeText(data?.direction, "→");
  const note = safeText(data?.note, "暂无影响结论");
  const short = note.length > 16 ? `${note.slice(0, 16)}…` : note;
  const variable = detail ? safeText(detail) : note;
  const tag = direction === "↑" ? "上行" : direction === "↓" ? "下行" : "中性";

  return (
    <article className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">{title}</p>
        <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] text-cyan-200">{tag}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-slate-100">{short}</p>
      <p className="mt-1 text-xs text-slate-400" style={clamp(1)}>关键变量：{variable}</p>
      <button
        type="button"
        onClick={onToggle}
        className="mt-2 text-[11px] text-cyan-200 underline-offset-4 hover:underline"
      >
        {expanded ? "收起分析" : "展开分析"}
      </button>
      {expanded ? <p className="mt-2 text-xs leading-5 text-slate-300">{variable}</p> : null}
    </article>
  );
}

function StrategicOverview({ strategyBrief, indexes, onOpenEvidence }) {
  const [driversExpanded, setDriversExpanded] = useState(false);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [impactOpenKey, setImpactOpenKey] = useState("");
  const [actionsExpanded, setActionsExpanded] = useState({
    "24-72h": false,
    "1-2w": false,
    "本月": false,
  });

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
    meta: { news_count_scanned: 0, news_count_used: 0, generated_at: "" },
  };

  const chips = useMemo(
    () => [
      "仅基于 news_raw",
      `扫描 ${brief?.meta?.news_count_scanned || 0} 条`,
      `引用 ${brief?.meta?.news_count_used || 0} 条`,
      safeText(brief?.time_window, "今天")
    ],
    [brief]
  );

  const sortedDrivers = useMemo(() => {
    const list = sortByPriority(Array.isArray(brief?.top_drivers) ? brief.top_drivers : []);
    return list.slice(0, 5);
  }, [brief]);

  const shownDrivers = driversExpanded ? sortedDrivers : sortedDrivers.slice(0, 3);

  const sortedCitations = useMemo(() => {
    const list = sortByPriority(Array.isArray(brief?.citations) ? brief.citations : []);
    return list.sort((a, b) => {
      const aBad = getCiteTitle(a) === "来源条目（标题缺失）" ? 1 : 0;
      const bBad = getCiteTitle(b) === "来源条目（标题缺失）" ? 1 : 0;
      return aBad - bBad;
    });
  }, [brief]);

  const groupedActions = useMemo(() => mapActionsByWindow(Array.isArray(brief?.actions) ? brief.actions : []), [brief]);

  const impactDetail = brief?.impacts || {};
  const impactModel = brief?.impact_on_revenue_model || {};

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-900/60 p-5 shadow-[0_0_45px_rgba(56,189,248,0.12)] backdrop-blur-xl lg:p-6">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/75 p-4 lg:p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">AI 今日战略判断</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-100" style={clamp(1)}>{safeText(brief.headline, "今日暂无清晰结论")}</h3>
        <p className="mt-2 text-sm text-slate-300" style={clamp(2)}>{safeText(brief.one_liner, "暂无结论解释")}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.slice(0, 4).map((chip) => (
            <span key={chip} className="rounded-full border border-slate-700/80 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-300">
              {chip}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => document.getElementById("strategic-actions")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-300/20"
          >
            查看行动板
          </button>
          <button
            type="button"
            onClick={() => setCitationsOpen(true)}
            className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            查看全部证据
          </button>
          <span className="ml-auto text-[11px] text-slate-400">
            生成于 {brief?.meta?.generated_at ? new Date(brief.meta.generated_at).toLocaleString() : "—"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">今日驱动</p>
            {sortedDrivers.length > 3 ? (
              <button
                type="button"
                onClick={() => setDriversExpanded((v) => !v)}
                className="text-xs text-cyan-200 underline-offset-4 hover:underline"
              >
                {driversExpanded ? "收起" : "展开更多"}
              </button>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2">
            {shownDrivers.length ? shownDrivers.map((driver, idx) => (
              <article key={`${safeText(driver?.title, "driver")}-${idx}`} className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-3">
                <p className="text-[11px] text-slate-400">
                  {safeText(driver?.source, "LLM综合")} · 影响分 {Number(driver?.impact_score || 0)} · 风险 {safeText(driver?.risk_level, "中")}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-100" style={clamp(1)}>{safeText(driver?.title, "未命名驱动")}</p>
                <p className="mt-1 text-xs text-slate-400" style={clamp(2)}>为何重要：{safeText(driver?.why, "暂无说明")}</p>
              </article>
            )) : <p className="text-xs text-slate-400">暂未识别今日驱动因素。</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">SaaS 影响拆解</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              ["subscription", "订阅", impactDetail?.merchant_demand],
              ["commission", "佣金", impactDetail?.acquisition],
              ["payment", "支付", impactDetail?.payments_risk],
              ["ecosystem", "生态", impactDetail?.competition],
            ].map(([key, label, detail]) => (
              <ImpactCell
                key={key}
                title={label}
                data={impactModel?.[key] || { direction: "→", note: "暂无结论" }}
                detail={safeText(detail, safeText(impactModel?.[key]?.note, "暂无补充分析"))}
                expanded={impactOpenKey === key}
                onToggle={() => setImpactOpenKey((current) => (current === key ? "" : key))}
              />
            ))}
          </div>
        </section>
      </div>

      <section id="strategic-actions" className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Action Board</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            ["24-72h", groupedActions["24-72h"]],
            ["1-2w", groupedActions["1-2w"]],
            ["本月", groupedActions["本月"]],
          ].map(([bucket, items]) => {
            const list = Array.isArray(items) ? items : [];
            const expanded = actionsExpanded[bucket];
            const shown = expanded ? list : list.slice(0, 3);

            return (
              <div key={bucket} className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-100">{bucket}</p>
                  {list.length > 3 ? (
                    <button
                      type="button"
                      onClick={() => setActionsExpanded((prev) => ({ ...prev, [bucket]: !prev[bucket] }))}
                      className="text-[11px] text-cyan-200 underline-offset-4 hover:underline"
                    >
                      {expanded ? "收起" : "展开全部"}
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {shown.length ? shown.map((action, idx) => (
                    <article key={`${bucket}-${idx}`} className="rounded-lg border border-slate-700/70 bg-slate-950/80 p-2.5">
                      <p className="text-[11px] text-slate-400">{safeText(action.priority)} · {safeText(action.owner)} · {safeText(action.time_horizon, bucket)}</p>
                      <p className="mt-1 text-xs text-slate-100" style={clamp(2)}>{safeText(action.action)}</p>
                      <p className="mt-1 text-[11px] text-slate-500" style={clamp(1)}>指标：{safeText(action.expected_effect, "待补充")}</p>
                    </article>
                  )) : <p className="text-xs text-slate-400">暂无行动建议。</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">引用新闻</p>
          <button
            type="button"
            onClick={() => setCitationsOpen(true)}
            className="text-xs text-cyan-200 underline-offset-4 hover:underline"
          >
            查看全部引用新闻（{sortedCitations.length}）
          </button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {sortedCitations.slice(0, 3).map((item, idx) => (
            <a
              key={`${safeText(item?.id, `cite-${idx}`)}-${idx}`}
              href={safeText(item?.url, "#")}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-3 transition hover:border-cyan-300/40"
            >
              <p className="text-[11px] text-slate-400">{safeText(item?.source, "Unknown")} · 影响 {Number(item?.impact_score || 0)} / 风险 {safeText(item?.risk_level, "中")}</p>
              <p className="mt-1 text-sm font-medium text-slate-100" style={clamp(2)}>{getCiteTitle(item)}</p>
              <p className="mt-1 text-xs text-slate-400" style={clamp(2)}>{getCitationSummary(item, brief.one_liner)}</p>
            </a>
          ))}
          {!sortedCitations.length ? <p className="text-xs text-slate-400">今日暂无引用新闻。</p> : null}
        </div>
      </section>

      {citationsOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
          <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-950 sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <h4 className="text-sm font-semibold text-slate-100">全部引用新闻（{sortedCitations.length}）</h4>
              <button
                type="button"
                onClick={() => setCitationsOpen(false)}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
              >
                关闭
              </button>
            </div>
            <div className="max-h-[76vh] space-y-2 overflow-y-auto px-4 py-3">
              {sortedCitations.map((item, idx) => (
                <a
                  key={`${safeText(item?.id, `modal-cite-${idx}`)}-${idx}`}
                  href={safeText(item?.url, "#")}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-slate-800 bg-slate-900/70 p-3 transition hover:border-cyan-300/40"
                >
                  <p className="text-[11px] text-slate-400">{safeText(item?.source, "Unknown")} · 影响 {Number(item?.impact_score || 0)} / 风险 {safeText(item?.risk_level, "中")}</p>
                  <p className="mt-1 text-sm font-medium text-slate-100" style={clamp(2)}>{getCiteTitle(item)}</p>
                  <p className="mt-1 text-xs text-slate-400" style={clamp(2)}>{getCitationSummary(item, brief.one_liner)}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <section className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-950/50 p-4">
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
