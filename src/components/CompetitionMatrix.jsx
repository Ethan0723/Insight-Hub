function utc8Today() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function shiftUtc8Days(days) {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  now.setUTCDate(now.getUTCDate() + days);
  return now.toISOString().slice(0, 10);
}

function CompetitionMatrix({ rows, range, onRangeChange, onOpenEvidence, onOpenLibraryByIds }) {
  const targetPlatforms = ['Shopify', 'Amazon', 'TikTok Shop'];
  const platformSet = new Set(targetPlatforms);
  const incomingRows = (Array.isArray(rows) ? rows : []).filter((item) => platformSet.has(item?.name));
  const byName = new Map(incomingRows.map((item) => [item.name, item]));
  const matrixRows = targetPlatforms.map((platform) => {
    const hit = byName.get(platform);
    if (hit) return hit;
    return {
      name: platform,
      weeklyMove: `暂无 ${platform} 本周关键动作，建议继续追踪。`,
      productUpdate: '暂无显著产品更新',
      aiUpdate: '暂无明确 AI 动态',
      evidence: {
        id: `ev-m-${platform.toLowerCase().replace(/\s+/g, '-')}`,
        title: `${platform} 竞争引用`,
        newsIds: []
      }
    };
  });

  return (
    <section className="app-section rounded-3xl p-6 backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="app-text-primary text-xl font-semibold lg:text-2xl">竞争动态矩阵</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRangeChange({ from: shiftUtc8Days(-6), to: utc8Today() })}
            className="rounded-lg app-button-secondary px-2 py-1 text-xs"
          >
            近7天
          </button>
          <button
            type="button"
            onClick={() => onRangeChange({ from: shiftUtc8Days(-14), to: utc8Today() })}
            className="rounded-lg app-button-secondary px-2 py-1 text-xs"
          >
            近15天
          </button>
          <input
            type="date"
            value={range?.from || ''}
            onChange={(e) => onRangeChange({ ...(range || {}), from: e.target.value })}
            className="rounded-md app-input px-1.5 py-0.5 text-[11px]"
          />
          <span className="app-text-muted text-xs">至</span>
          <input
            type="date"
            value={range?.to || ''}
            onChange={(e) => onRangeChange({ ...(range || {}), to: e.target.value })}
            className="rounded-md app-input px-1.5 py-0.5 text-[11px]"
          />
          <span className="rounded-full border border-indigo-300/30 bg-indigo-300/10 px-3 py-1 text-xs text-indigo-200">
            可溯源竞争情报
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl app-card">
        <div className="app-table-head grid grid-cols-5 px-4 py-3 text-xs">
          <span>平台</span>
          <span>本周关键动作</span>
          <span>产品更新</span>
          <span>AI 动态</span>
          <span>引用新闻</span>
        </div>

        <div className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
          {matrixRows.map((item) => (
            <div key={item.name} className="app-card-soft grid grid-cols-5 gap-3 px-4 py-4 text-xs app-text-secondary">
              <p className="app-accent-text font-semibold">{item.name}</p>
              <p>{item.weeklyMove}</p>
              <p>{item.productUpdate}</p>
              <p>{item.aiUpdate}</p>
              <div className="space-y-2">
                <p className="app-text-muted">{item.evidence.newsIds.length} 条</p>
                <button
                  type="button"
                  onClick={() => onOpenEvidence(item.evidence)}
                  className="rounded-lg app-button-secondary px-2 py-1 text-[11px]"
                >
                  查看新闻来源
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLibraryByIds(item.evidence.newsIds)}
                  className="app-accent-chip rounded-lg px-2 py-1 text-[11px] hover:bg-cyan-300/20"
                >
                  去新闻库
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CompetitionMatrix;
