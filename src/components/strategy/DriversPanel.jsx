import ExpandableText from "./ExpandableText";

const riskRank = { 高: 3, 中: 2, 低: 1 };

const safeText = (value, fallback = "") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const parseDate = (value) => {
  const ts = Date.parse(String(value || ""));
  return Number.isNaN(ts) ? 0 : ts;
};

function sortBySignalScore(items) {
  return [...items].sort((a, b) => {
    const impact = Number(b?.impact_score || 0) - Number(a?.impact_score || 0);
    if (impact !== 0) return impact;
    const risk = (riskRank[b?.risk_level] || 0) - (riskRank[a?.risk_level] || 0);
    if (risk !== 0) return risk;
    return parseDate(b?.created_at || b?.published_at) - parseDate(a?.created_at || a?.published_at);
  });
}

function deriveFromCitations(citations = [], oneLiner = "") {
  return sortBySignalScore(citations)
    .slice(0, 3)
    .map((item, idx) => ({
      id: safeText(item?.id, `citation-${idx}`),
      title: safeText(item?.title, "来源条目"),
      note: safeText(item?.summary || item?.why_it_matters || oneLiner, "暂无解释"),
      source: safeText(item?.source, "news_raw"),
      impact_score: Number(item?.impact_score || 0),
      risk_level: safeText(item?.risk_level, "中"),
      created_at: safeText(item?.created_at || item?.published_at, ""),
    }));
}

export function buildDriverItems(brief) {
  const candidates = Array.isArray(brief?.top_drivers) ? brief.top_drivers : [];
  if (candidates.length > 0) {
    return sortBySignalScore(candidates)
      .slice(0, 5)
      .map((item, idx) => ({
        id: safeText(item?.id, `driver-${idx}`),
        title: safeText(item?.title, `驱动${idx + 1}`),
        note: safeText(item?.why || item?.why_it_matters || brief?.one_liner, "暂无解释"),
        source: safeText(item?.source, brief?.meta?.brief_source === "daily_brief" ? "daily_brief" : "news_raw"),
        impact_score: Number(item?.impact_score || 0),
        risk_level: safeText(item?.risk_level, "中"),
        created_at: safeText(item?.created_at || "", ""),
      }));
  }

  return deriveFromCitations(Array.isArray(brief?.citations) ? brief.citations : [], brief?.one_liner || "");
}

function DriversPanel({ drivers = [] }) {
  const shown = drivers.slice(0, 5);

  return (
    <section className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">核心变量 / 今日驱动</p>
      </div>

      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
        {shown.length ? (
          shown.map((item, idx) => (
            <article key={`${item.id}-${idx}`} className="rounded-md border border-slate-700/60 bg-slate-900/75 p-2">
              <p className="text-[12px] font-medium leading-tight text-slate-100 whitespace-normal break-words">{item.title}</p>
              <div className="mt-1 max-h-24 overflow-auto strategic-scroll pr-1">
                <ExpandableText text={item.note} collapsedChars={90} className="text-[11px] leading-snug text-slate-300" />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] text-slate-500">
                <span className="rounded border border-slate-700/70 px-1.5 py-0.5">{item.risk_level}</span>
                <span className="group relative cursor-default">
                  来源
                  <span className="strategic-tooltip">{item.source}</span>
                </span>
              </div>
            </article>
          ))
        ) : (
          <p className="text-xs text-slate-400">暂无驱动信息。</p>
        )}
      </div>
    </section>
  );
}

export default DriversPanel;
