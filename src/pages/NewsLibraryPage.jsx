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
  const [query, setQuery] = useState({
    page: 1,
    pageSize: 9,
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
  const [newsPage, setNewsPage] = useState({ list: [], total: 0, page: 1, pageSize: 9 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedViews, setSavedViews] = useState(storage.getSavedViews());
  const [exportOpen, setExportOpen] = useState(false);
  const [markdown, setMarkdown] = useState(storage.getBriefDraft());

  useEffect(() => {
    if (!initialQuery) return;
    setQuery((prev) => ({ ...prev, ...initialQuery, page: 1 }));
  }, [initialQuery]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');

    api
      .searchNews(query)
      .then((res) => {
        if (mounted) setNewsPage(res);
      })
      .catch(() => {
        if (mounted) setError('加载新闻失败，请稍后重试。');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [query]);

  const allPlatforms = useMemo(() => ['Shopify', 'Shopline', 'Shoplazza', 'Amazon', 'TikTok Shop', 'Temu'], []);
  const allRegions = useMemo(() => ['US', 'EU', 'UK', 'SEA', 'Global'], []);
  const allModules = useMemo(() => ['政策', '平台', '财报', '支付', '广告', '物流', 'AI', '宏观'], []);
  const allDims = useMemo(() => ['订阅', '佣金', '支付', '生态'], []);

  const stats = useMemo(() => {
    const total = newsPage.total;
    const highRisk = newsPage.list.filter((item) => item.riskLevel === '高').length;
    const now = new Date();
    const thisWeek = newsPage.list.filter((item) => {
      const diff = (now.getTime() - new Date(item.publishDate).getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;
    const avgImpact =
      newsPage.list.length > 0
        ? Math.round(newsPage.list.reduce((sum, item) => sum + item.impactScore, 0) / newsPage.list.length)
        : 0;

    return { total, highRisk, thisWeek, avgImpact };
  }, [newsPage]);

  const totalPages = Math.max(1, Math.ceil(newsPage.total / query.pageSize));

  const updateMulti = (field, value) => {
    setQuery((prev) => {
      const list = prev[field] || [];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...prev, [field]: next, page: 1 };
    });
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
    setQuery({ ...query, ...view.query, page: 1 });
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
      ...newsPage.list.map(
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
            <select value={query.sortBy} onChange={(e) => setQuery((prev) => ({ ...prev, sortBy: e.target.value, page: 1 }))} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200">
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
            <input type="date" value={query.dateFrom} onChange={(e) => setQuery((prev) => ({ ...prev, dateFrom: e.target.value, page: 1 }))} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200" />
            <input type="date" value={query.dateTo} onChange={(e) => setQuery((prev) => ({ ...prev, dateTo: e.target.value, page: 1 }))} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200" />
          </div>
        </div>

        <div className="mt-4">
          <input value={query.keyword} onChange={(e) => setQuery((prev) => ({ ...prev, keyword: e.target.value, page: 1 }))} placeholder="关键词搜索（标题 + 摘要 + 实体）" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500" />
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-72 animate-pulse rounded-2xl border border-slate-700 bg-slate-900/60" />
          ))}
        </div>
      ) : newsPage.list.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-8 text-center text-slate-400">暂无符合条件的新闻</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {newsPage.list.map((item) => (
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

      <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
        <p className="text-xs text-slate-400">
          第 {newsPage.page} / {totalPages} 页 · 共 {newsPage.total} 条
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={newsPage.page <= 1}
            onClick={() => setQuery((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一页
          </button>
          <button
            type="button"
            disabled={newsPage.page >= totalPages}
            onClick={() => setQuery((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
            className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>

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
