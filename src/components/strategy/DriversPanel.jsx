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

function applySpotlight(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  event.currentTarget.style.setProperty("--spotlight-x", `${x}px`);
  event.currentTarget.style.setProperty("--spotlight-y", `${y}px`);
}

function deriveFromCitations(citations = [], oneLiner = "") {
  return sortBySignalScore(citations)
    .slice(0, 3)
    .map((item, idx) => ({
      id: safeText(item?.id, `citation-${idx}`),
      title: safeText(item?.title || item?.headline || item?.news_title, `驱动${idx + 1}`),
      note: safeText(item?.summary || item?.why_it_matters || oneLiner, "暂无解释"),
      source: safeText(item?.source, "news_raw"),
      impact_score: Number(item?.impact_score || 0),
      risk_level: safeText(item?.risk_level, "中"),
      created_at: safeText(item?.created_at || item?.published_at, ""),
    }));
}

export function buildDriverItems(brief) {
  const briefCitations = Array.isArray(brief?.citations) ? brief.citations : [];
  const isDailyBrief = brief?.meta?.brief_source === "daily_brief";
  const candidates = Array.isArray(brief?.top_drivers) ? brief.top_drivers : [];
  if (isDailyBrief && candidates.length > 0) {
    return candidates.slice(0, 5).map((item, idx) => ({
      id: safeText(item?.id, `driver-${idx}`),
      title: safeText(item?.title, `驱动${idx + 1}`),
      note: safeText(item?.why || item?.why_it_matters || brief?.one_liner, "暂无解释"),
      source: safeText(item?.source, "daily_brief"),
      impact_score: Number(item?.impact_score || 0),
      risk_level: safeText(item?.risk_level, "中"),
      created_at: safeText(item?.created_at || "", ""),
    }));
  }

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
    <section data-ga-section="drivers" className="app-card rounded-[22px] p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="app-section-label">核心变量 / 今日驱动</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {shown.length ? (
          shown.map((item, idx) => (
            <article
              key={`${item.id}-${idx}`}
              onPointerMove={applySpotlight}
              className="app-card-soft app-card-hoverable app-card-spotlight flex min-h-[290px] flex-col rounded-2xl p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full app-chip-neutral px-2 py-1 text-[10px]">{item.risk_level}</span>
              </div>
              <p className="app-text-primary mt-3 text-[13px] font-medium leading-6 whitespace-normal break-words">{item.title}</p>
              <div className="mt-2 max-h-36 flex-1 overflow-auto strategic-scroll pr-1">
                <p className="app-text-secondary text-[11px] leading-6 whitespace-normal break-words">{item.note}</p>
              </div>
              <div className="app-text-faint mt-3 flex items-center justify-between gap-1 text-[10px]">
                <span>影响分 {item.impact_score || 0}</span>
              </div>
            </article>
          ))
        ) : (
          <p className="app-text-muted text-xs">暂无驱动信息。</p>
        )}
      </div>
    </section>
  );
}

export default DriversPanel;
