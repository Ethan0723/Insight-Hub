function utc8Window(day) {
  const startLocal = new Date(`${day}T00:00:00+08:00`);
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
  return { start: startLocal.toISOString(), end: endLocal.toISOString() };
}

async function getJson(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`);
  return JSON.parse(text);
}

function buildRangeUrl(base, day) {
  const { start, end } = utc8Window(day);
  const url = new URL(`${base}/news_raw`);
  url.searchParams.set('select', 'id,title,impact_score,created_at,publish_time,source,url');
  url.searchParams.set('created_at', `gte.${start}`);
  url.searchParams.append('created_at', `lt.${end}`);
  url.searchParams.set('order', 'impact_score.desc.nullslast,created_at.desc');
  url.searchParams.set('limit', '200');
  return url;
}

function pickRows(rows, citations) {
  const citationSet = new Set((Array.isArray(citations) ? citations : []).map((item) => String(item || '').trim()));
  return rows.filter((row) => citationSet.has(String(row.id || '')) || citationSet.has(String(row.url || '')));
}

async function main() {
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
  };
  const base = `${process.env.SUPABASE_URL}/rest/v1`;
  const briefUrl = new URL(`${base}/daily_brief`);
  briefUrl.searchParams.set('select', 'brief_date,headline,citations,stats,generated_at');
  briefUrl.searchParams.set('order', 'brief_date.desc');
  briefUrl.searchParams.set('limit', process.argv[2] || '30');

  const briefs = await getJson(briefUrl, headers);
  const results = [];

  for (const brief of briefs) {
    const rows = await getJson(buildRangeUrl(base, brief.brief_date), headers);
    const citedRows = pickRows(rows, brief.citations);
    const maxDay = Math.max(...rows.map((row) => Number(row.impact_score || 0)), 0);
    const maxCited = Math.max(...citedRows.map((row) => Number(row.impact_score || 0)), 0);
    const top3 = rows.slice(0, 3).map((row) => ({
      id: row.id,
      score: Number(row.impact_score || 0),
      title: row.title
    }));
    const missingTop3 = top3.filter((row) => !citedRows.some((cited) => String(cited.id) === String(row.id)));
    results.push({
      date: brief.brief_date,
      generated_at: brief.generated_at,
      headline: brief.headline,
      scanned: Number(brief.stats?.scanned || 0),
      used: Number(brief.stats?.used || 0),
      day_count: rows.length,
      max_day: maxDay,
      max_cited: maxCited,
      gap: maxDay - maxCited,
      missing_top3: missingTop3.length,
      top3,
      cited: citedRows.map((row) => ({
        id: row.id,
        score: Number(row.impact_score || 0),
        title: row.title
      }))
    });
  }

  const suspicious = results.filter(
    (row) => row.gap >= 8 || (row.max_day > 0 && row.max_cited === 0) || (row.gap >= 5 && row.missing_top3 > 0)
  );

  console.log(
    JSON.stringify(
      {
        suspicious_count: suspicious.length,
        suspicious,
        sample: results.slice(0, 10)
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('[audit_daily_brief] failed:', err?.message || err);
  process.exit(1);
});
