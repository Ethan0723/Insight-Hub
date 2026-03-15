import { useEffect, useMemo, useState } from 'react';
import StrategicNewsCard from '../components/StrategicNewsCard';
import { api } from '../services/api';
import { storage } from '../services/storage';

function NewsLibraryPage({
  initialQuery,
  favorites,
  readIds,
  onToggleFavorite,
  onOpenNews,
  onOpenEvidence,
  indexMap
}) {
  const HIGH_PAGE_SIZE = 6;
  const LOW_PAGE_SIZE = 6;
  const INITIAL_BATCH = 60;
  const NEXT_BATCH = 20;
  const [query, setQuery] = useState({
    sortBy: 'time',
    platforms: [],
    regions: [],
    moduleTags: [],
    riskLevels: [],
    impactDimensions: [],
    keyword: '',
    dateFrom: '',
    dateTo: '',
    ids: []
  });
  const [loadedNews, setLoadedNews] = useState([]);
  const [dbTotal, setDbTotal] = useState(0);
  const [highDbTotal, setHighDbTotal] = useState(0);
  const [lowDbTotal, setLowDbTotal] = useState(0);
  const [cursorOffset, setCursorOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [highImpactAll, setHighImpactAll] = useState([]);
  const [lowImpactAll, setLowImpactAll] = useState([]);
  const [highPage, setHighPage] = useState(1);
  const [lowPage, setLowPage] = useState(1);
  const [stats, setStats] = useState({ total: 0, highRisk: 0, thisWeek: 0, avgImpact: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedViews, setSavedViews] = useState(storage.getSavedViews());
  const [exportOpen, setExportOpen] = useState(false);
  const [markdown, setMarkdown] = useState(storage.getBriefDraft());

  useEffect(() => {
    if (!initialQuery) return;
    setQuery((prev) => ({ ...prev, ...initialQuery }));
    setHighPage(1);
    setLowPage(1);
  }, [initialQuery]);

  const applyLocalFilters = (list) => {
    let result = [...list];
    if (query.ids && query.ids.length > 0) {
      const set = new Set(query.ids);
      result = result.filter((item) => set.has(item.id));
    }
    if (query.platforms && query.platforms.length > 0) {
      result = result.filter((item) => query.platforms.includes(item.platform));
    }
    if (query.regions && query.regions.length > 0) {
      result = result.filter((item) => query.regions.includes(item.region));
    }
    if (query.moduleTags && query.moduleTags.length > 0) {
      result = result.filter((item) => query.moduleTags.some((tag) => item.moduleTags.includes(tag)));
    }
    if (query.riskLevels && query.riskLevels.length > 0) {
      result = result.filter((item) => query.riskLevels.includes(item.riskLevel));
    }
    if (query.impactDimensions && query.impactDimensions.length > 0) {
      result = result.filter((item) => query.impactDimensions.some((dim) => item.impactDimensions.includes(dim)));
    }
    if (query.dateFrom) {
      const from = new Date(query.dateFrom).getTime();
      result = result.filter((item) => new Date(item.publishDate).getTime() >= from);
    }
    if (query.dateTo) {
      const to = new Date(query.dateTo).getTime();
      result = result.filter((item) => new Date(item.publishDate).getTime() <= to);
    }
    if (query.keyword?.trim()) {
      const key = query.keyword.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(key) ||
          item.summary.toLowerCase().includes(key) ||
          item.entities.join(' ').toLowerCase().includes(key)
      );
    }

    result.sort((a, b) => {
      if (query.sortBy === 'impact') return b.impactScore - a.impactScore;
      if (query.sortBy === 'risk') {
        const rank = { 高: 3, 中: 2, 低: 1 };
        return (rank[b.riskLevel] || 1) - (rank[a.riskLevel] || 1);
      }
      return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
    });
    return result;
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    setHasMore(true);
    setCursorOffset(0);
    setLoadedNews([]);
    setHighPage(1);
    setLowPage(1);

    Promise.allSettled([
      api.getNewsTotal(query.dateFrom, query.dateTo),
      api.getNewsTotal(query.dateFrom, query.dateTo, { impactGt: 20 }),
      api.getNewsTotal(query.dateFrom, query.dateTo, { impactLte: 20 }),
      api.getNewsBatch({
        offset: 0,
        limit: INITIAL_BATCH,
        dateFrom: query.dateFrom || undefined,
        dateTo: query.dateTo || undefined
      })
    ])
      .then(([totalRes, highTotalRes, lowTotalRes, batchRes]) => {
        if (!mounted) return;
        const batchObj = batchRes.status === 'fulfilled' ? batchRes.value : { list: [], fetchedCount: 0 };
        const batch = Array.isArray(batchObj.list) ? batchObj.list : [];
        const fetchedCount = Number(batchObj.fetchedCount || 0);
        const total = totalRes.status === 'fulfilled' ? totalRes.value : batch.length;
        const highTotal = highTotalRes.status === 'fulfilled' ? highTotalRes.value : batch.filter((item) => item.impactScore > 20).length;
        const lowTotal = lowTotalRes.status === 'fulfilled' ? lowTotalRes.value : batch.filter((item) => item.impactScore <= 20).length;
        if (batchRes.status !== 'fulfilled') {
          setError('新闻明细加载失败，请稍后重试。');
        } else if (totalRes.status !== 'fulfilled') {
          setError('总数统计加载较慢，已先展示已加载新闻。');
        }
        setDbTotal(total);
        setHighDbTotal(highTotal);
        setLowDbTotal(lowTotal);
        setCursorOffset(fetchedCount);
        setHasMore(fetchedCount >= INITIAL_BATCH && fetchedCount < total);
        setLoadedNews(batch);
        const filtered = applyLocalFilters(batch);
        const highAll = filtered.filter((item) => item.impactScore > 20);
        const lowAll = filtered.filter((item) => item.impactScore <= 20);
        setHighImpactAll(highAll);
        setLowImpactAll(lowAll);

        const now = new Date();
        const highRisk = filtered.filter((item) => item.riskLevel === '高').length;
        const thisWeek = filtered.filter((item) => {
          const diff = (now.getTime() - new Date(item.publishDate).getTime()) / (1000 * 60 * 60 * 24);
          return diff >= 0 && diff <= 7;
        }).length;
        const avgImpact = filtered.length > 0 ? Math.round(filtered.reduce((sum, item) => sum + item.impactScore, 0) / filtered.length) : 0;

        setStats({
          total,
          highRisk,
          thisWeek,
          avgImpact
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [query.dateFrom, query.dateTo]);

  useEffect(() => {
    const filtered = applyLocalFilters(loadedNews);
    const highAll = filtered.filter((item) => item.impactScore > 20);
    const lowAll = filtered.filter((item) => item.impactScore <= 20);
    setHighImpactAll(highAll);
    setLowImpactAll(lowAll);

    const now = new Date();
    const highRisk = filtered.filter((item) => item.riskLevel === '高').length;
    const thisWeek = filtered.filter((item) => {
      const diff = (now.getTime() - new Date(item.publishDate).getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;
    const avgImpact = filtered.length > 0 ? Math.round(filtered.reduce((sum, item) => sum + item.impactScore, 0) / filtered.length) : 0;
    setStats((prev) => ({ ...prev, total: dbTotal, highRisk, thisWeek, avgImpact }));
  }, [query, loadedNews, dbTotal]);

  const hasAdvancedFilters =
    query.platforms.length > 0 ||
    query.regions.length > 0 ||
    query.moduleTags.length > 0 ||
    query.riskLevels.length > 0 ||
    query.impactDimensions.length > 0 ||
    Boolean(query.keyword?.trim()) ||
    (query.ids && query.ids.length > 0);

  useEffect(() => {
    const total = Math.max(1, Math.ceil(highImpactAll.length / HIGH_PAGE_SIZE));
    if (!hasMore && highPage > total) setHighPage(total);
  }, [highImpactAll.length, highPage, hasMore]);

  useEffect(() => {
    const total = Math.max(1, Math.ceil(lowImpactAll.length / LOW_PAGE_SIZE));
    if (!hasMore && lowPage > total) setLowPage(total);
  }, [lowImpactAll.length, lowPage, hasMore]);

  const allPlatforms = useMemo(() => ['Shopify', 'Shopline', 'Shoplazza', 'Amazon', 'TikTok Shop', 'Temu'], []);
  const allRegions = useMemo(() => ['US', 'EU', 'UK', 'SEA', 'Global'], []);
  const allModules = useMemo(() => ['政策', '平台', '财报', '支付', '广告', '物流', 'AI', '宏观'], []);
  const allDims = useMemo(() => ['订阅', '佣金', '支付', '生态'], []);

  const highTotalCount = hasAdvancedFilters ? highImpactAll.length : highDbTotal;
  const lowTotalCount = hasAdvancedFilters ? lowImpactAll.length : lowDbTotal;
  const highTotalPages = Math.max(1, Math.ceil(highTotalCount / HIGH_PAGE_SIZE));
  const lowTotalPages = Math.max(1, Math.ceil(lowTotalCount / LOW_PAGE_SIZE));
  const highStart = (highPage - 1) * HIGH_PAGE_SIZE;
  const lowStart = (lowPage - 1) * LOW_PAGE_SIZE;
  const highPageList = highImpactAll.slice(highStart, highStart + HIGH_PAGE_SIZE);
  const lowPageList = lowImpactAll.slice(lowStart, lowStart + LOW_PAGE_SIZE);

  const updateMulti = (field, value) => {
    setQuery((prev) => {
      const list = prev[field] || [];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...prev, [field]: next };
    });
    setHighPage(1);
    setLowPage(1);
  };

  const getNewsReferenceIds = (newsId) =>
    Object.values(indexMap)
      .filter((indexItem) => indexItem.evidence.newsIds.includes(newsId))
      .flatMap((indexItem) => indexItem.evidence.newsIds);

  const saveCurrentView = () => {
    const name = window.prompt('输入筛选视图名称');
    if (!name) return;
    const saved = storage.saveView({
      id: `view-${Date.now()}`,
      name,
      query,
      createdAt: new Date().toISOString()
    });
    setSavedViews(saved);
  };

  const applySavedView = (view) => {
    setQuery({ ...query, ...view.query });
    setHighPage(1);
    setLowPage(1);
  };

  const removeSavedView = (id) => {
    setSavedViews(storage.removeView(id));
  };

  const createMarkdownBrief = () => {
    const lines = [
      '# Strategic News Brief',
      '',
      `生成时间: ${new Date().toLocaleString()}`,
      '',
      ...highPageList.map(
        (item, index) =>
          `${index + 1}. **${item.title}**\n   - 来源: ${item.source}\n   - 时间: ${item.publishDate}\n   - 风险: ${item.riskLevel} | 影响评分: ${item.impactScore}\n   - TL;DR: ${item.aiTldr}\n   - 链接: ${item.originalUrl}`
      )
    ];
    const md = lines.join('\n');
    setMarkdown(md);
    storage.setBriefDraft(md);
    setExportOpen(true);
  };

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(markdown);
  };

  const loadMore = async (batch = NEXT_BATCH) => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextObj = await api.getNewsBatch({
        offset: cursorOffset,
        limit: batch,
        dateFrom: query.dateFrom || undefined,
        dateTo: query.dateTo || undefined
      });
      const next = Array.isArray(nextObj.list) ? nextObj.list : [];
      const fetchedCount = Number(nextObj.fetchedCount || 0);
      if (fetchedCount === 0) {
        setHasMore(false);
        return;
      }
      const nextOffset = cursorOffset + fetchedCount;
      setCursorOffset(nextOffset);
      setLoadedNews((prev) => [...prev, ...next]);
      if (fetchedCount < batch || nextOffset >= dbTotal) setHasMore(false);
    } catch {
      setError('加载更多新闻失败，请稍后重试。');
    } finally {
      setLoadingMore(false);
    }
  };

  const gotoHighPage = async (nextPage) => {
    if (nextPage <= 1) {
      setHighPage(1);
      return;
    }
    const target = Math.max(1, nextPage);
    const cap = hasAdvancedFilters ? (hasMore ? target : Math.max(1, Math.ceil(highImpactAll.length / HIGH_PAGE_SIZE))) : highTotalPages;
    setHighPage(Math.max(1, Math.min(target, cap)));
  };

  const gotoLowPage = async (nextPage) => {
    if (nextPage <= 1) {
      setLowPage(1);
      return;
    }
    const target = Math.max(1, nextPage);
    const cap = hasAdvancedFilters ? (hasMore ? target : Math.max(1, Math.ceil(lowImpactAll.length / LOW_PAGE_SIZE))) : lowTotalPages;
    setLowPage(Math.max(1, Math.min(target, cap)));
  };

  useEffect(() => {
    const needed = highPage * HIGH_PAGE_SIZE;
    if (highImpactAll.length < needed && hasMore && !loadingMore) {
      loadMore(NEXT_BATCH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highPage, highImpactAll.length, hasMore, loadingMore]);

  useEffect(() => {
    const needed = lowPage * LOW_PAGE_SIZE;
    if (lowImpactAll.length < needed && hasMore && !loadingMore) {
      loadMore(NEXT_BATCH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowPage, lowImpactAll.length, hasMore, loadingMore]);

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-cyan-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">Strategic News Library</h2>
            <p className="mt-1 text-sm text-slate-400">可追溯检索系统 / Saved Views / 简报导出</p>
          </div>
          <div className="flex gap-2">
            <button onClick={saveCurrentView} type="button" className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/40">
              保存筛选视图
            </button>
            <button onClick={createMarkdownBrief} type="button" className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-cyan-400">
              导出为简报
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3"><p className="text-xs text-slate-400">总新闻数量</p><p className="mt-2 text-2xl text-cyan-200">{stats.total}</p></div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3"><p className="text-xs text-slate-400">高风险数量</p><p className="mt-2 text-2xl text-rose-300">{stats.highRisk}</p></div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3"><p className="text-xs text-slate-400">本周新增数量</p><p className="mt-2 text-2xl text-emerald-300">{stats.thisWeek}</p></div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3"><p className="text-xs text-slate-400">平均影响评分</p><p className="mt-2 text-2xl text-fuchsia-200">{stats.avgImpact}</p></div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
            <p className="text-xs text-slate-400">排序方式</p>
            <select value={query.sortBy} onChange={(e) => { setQuery((prev) => ({ ...prev, sortBy: e.target.value })); setHighPage(1); setLowPage(1); }} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200">
              <option value="time">按发布时间</option>
              <option value="impact">按影响评分</option>
              <option value="risk">按风险等级</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-blue-300/20 bg-slate-900/60 p-6 backdrop-blur-xl">
        <div className="mb-4 flex flex-wrap gap-2">
          {savedViews.map((view) => (
            <div key={view.id} className="flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-2 py-1">
              <button type="button" onClick={() => applySavedView(view)} className="text-xs text-slate-200 hover:text-cyan-200">{view.name}</button>
              <button type="button" onClick={() => removeSavedView(view.id)} className="text-xs text-slate-500 hover:text-rose-300">×</button>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
          <div className="xl:col-span-3">
            <p className="mb-2 text-xs text-slate-400">平台筛选（多选）</p>
            <div className="flex flex-wrap gap-2">{allPlatforms.map((item) => <button key={item} type="button" onClick={() => updateMulti('platforms', item)} className={`rounded-full border px-2 py-1 text-xs ${query.platforms.includes(item) ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : 'border-slate-600 text-slate-300'}`}>{item}</button>)}</div>
          </div>
          <div className="xl:col-span-2">
            <p className="mb-2 text-xs text-slate-400">地区筛选</p>
            <div className="flex flex-wrap gap-2">{allRegions.map((item) => <button key={item} type="button" onClick={() => updateMulti('regions', item)} className={`rounded-full border px-2 py-1 text-xs ${query.regions.includes(item) ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : 'border-slate-600 text-slate-300'}`}>{item}</button>)}</div>
          </div>
          <div className="xl:col-span-2">
            <p className="mb-2 text-xs text-slate-400">风险等级</p>
            <div className="flex flex-wrap gap-2">{['低', '中', '高'].map((item) => <button key={item} type="button" onClick={() => updateMulti('riskLevels', item)} className={`rounded-full border px-2 py-1 text-xs ${query.riskLevels.includes(item) ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : 'border-slate-600 text-slate-300'}`}>{item}</button>)}</div>
          </div>
          <div className="xl:col-span-2">
            <p className="mb-2 text-xs text-slate-400">模块标签</p>
            <div className="flex flex-wrap gap-2">{allModules.map((item) => <button key={item} type="button" onClick={() => updateMulti('moduleTags', item)} className={`rounded-full border px-2 py-1 text-xs ${query.moduleTags.includes(item) ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : 'border-slate-600 text-slate-300'}`}>{item}</button>)}</div>
          </div>
          <div className="xl:col-span-2">
            <p className="mb-2 text-xs text-slate-400">影响维度</p>
            <div className="flex flex-wrap gap-2">{allDims.map((item) => <button key={item} type="button" onClick={() => updateMulti('impactDimensions', item)} className={`rounded-full border px-2 py-1 text-xs ${query.impactDimensions.includes(item) ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : 'border-slate-600 text-slate-300'}`}>{item}</button>)}</div>
          </div>
          <div className="xl:col-span-1">
            <p className="mb-2 text-xs text-slate-400">起始日期</p>
            <input type="date" value={query.dateFrom} onChange={(e) => { setQuery((prev) => ({ ...prev, dateFrom: e.target.value })); setHighPage(1); setLowPage(1); }} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200" />
            <input type="date" value={query.dateTo} onChange={(e) => { setQuery((prev) => ({ ...prev, dateTo: e.target.value })); setHighPage(1); setLowPage(1); }} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200" />
          </div>
        </div>

        <div className="mt-4">
          <input value={query.keyword} onChange={(e) => { setQuery((prev) => ({ ...prev, keyword: e.target.value })); setHighPage(1); setLowPage(1); }} placeholder="关键词搜索（标题 + 摘要 + 实体）" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500" />
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-72 animate-pulse rounded-2xl border border-slate-700 bg-slate-900/60" />
          ))}
        </div>
      ) : highPageList.length === 0 && lowPageList.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-8 text-center text-slate-400">暂无符合条件的新闻</div>
      ) : (
        <>
          <div className="space-y-3 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.03] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">主新闻区（Impact &gt; 20）</h3>
              <span className="text-xs text-cyan-200">共 {highTotalCount} 条</span>
            </div>
            <p className="text-[11px] text-slate-400">高影响事件区：用于优先决策，建议先看本区。</p>
            {highPageList.length === 0 ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-5 text-sm text-slate-400">
                {loadingMore || hasMore ? '正在加载更多新闻，请稍候…' : '当前筛选条件下暂无 Impact > 20 的新闻。'}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {highPageList.map((item) => (
                  <StrategicNewsCard
                    key={item.id}
                    news={item}
                    onDetail={onOpenNews}
                    onToggleFavorite={onToggleFavorite}
                    isFavorite={favorites.includes(item.id)}
                    isRead={readIds.includes(item.id)}
                    onOpenReference={() =>
                      onOpenEvidence({
                        id: `news-${item.id}`,
                        title: `${item.title} 被引用关系`,
                        newsIds: getNewsReferenceIds(item.id)
                      })
                    }
                  />
                ))}
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2">
              <p className="text-xs text-slate-400">
                主新闻区第 {highPage} / {highTotalPages} 页
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={highPage <= 1}
                  onClick={() => gotoHighPage(highPage - 1)}
                  className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  type="button"
                  disabled={hasAdvancedFilters ? highPage >= highTotalPages && !hasMore : highPage >= highTotalPages}
                  onClick={() => gotoHighPage(highPage + 1)}
                  className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-slate-700/70" />
            <span className="text-[11px] tracking-[0.16em] uppercase text-slate-500">低影响区（可延后阅读）</span>
            <div className="h-px flex-1 bg-slate-700/70" />
          </div>

          {lowImpactAll.length > 0 ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-slate-700/80 bg-slate-900/30 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">低影响新闻区（Impact ≤ 20）</h3>
                <span className="text-xs text-slate-400">共 {lowTotalCount} 条</span>
              </div>
              <p className="text-[11px] text-slate-500">背景信号区：用于补充上下文与跟踪长期变化。</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {lowPageList.map((item) => (
                  <StrategicNewsCard
                    key={item.id}
                    news={item}
                    onDetail={onOpenNews}
                    onToggleFavorite={onToggleFavorite}
                    isFavorite={favorites.includes(item.id)}
                    isRead={readIds.includes(item.id)}
                    onOpenReference={() =>
                      onOpenEvidence({
                        id: `news-low-${item.id}`,
                        title: `${item.title} 被引用关系`,
                        newsIds: getNewsReferenceIds(item.id)
                      })
                    }
                  />
                ))}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2">
                <p className="text-xs text-slate-400">
                  低影响区第 {lowPage} / {lowTotalPages} 页
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={lowPage <= 1}
                    onClick={() => gotoLowPage(lowPage - 1)}
                    className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={hasAdvancedFilters ? lowPage >= lowTotalPages && !hasMore : lowPage >= lowTotalPages}
                    onClick={() => gotoLowPage(lowPage + 1)}
                    className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {exportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-cyan-300/20 bg-slate-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">简报 Markdown 预览</h3>
              <button type="button" onClick={() => setExportOpen(false)} className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300">关闭</button>
            </div>
            <textarea
              value={markdown}
              onChange={(e) => {
                setMarkdown(e.target.value);
                storage.setBriefDraft(e.target.value);
              }}
              rows={16}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
            />
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={copyMarkdown} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-medium text-slate-950">
                复制 Markdown
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default NewsLibraryPage;
