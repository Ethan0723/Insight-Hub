import { useMemo, useState } from 'react';
import StrategicNewsCard from './StrategicNewsCard';

const riskOrder = { 高: 3, 中: 2, 低: 1 };

function StrategicNewsLibrary({ news, indexes, onOpenDetail, onOpenReferences }) {
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [selectedRisks, setSelectedRisks] = useState([]);
  const [selectedDimensions, setSelectedDimensions] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');

  const platforms = useMemo(() => [...new Set(news.map((item) => item.platform))], [news]);
  const dimensions = useMemo(
    () => [...new Set(news.flatMap((item) => item.impact_dimension))],
    [news]
  );

  const toggleValue = (value, list, setList) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const filteredNews = useMemo(() => {
    const searched = news.filter((item) => {
      const byPlatform = selectedPlatforms.length === 0 || selectedPlatforms.includes(item.platform);
      const byRisk = selectedRisks.length === 0 || selectedRisks.includes(item.risk_level);
      const byDimension =
        selectedDimensions.length === 0 ||
        selectedDimensions.some((dim) => item.impact_dimension.includes(dim));
      const byKeyword = item.title.toLowerCase().includes(search.toLowerCase());
      const byFrom = !dateFrom || new Date(item.publish_date) >= new Date(dateFrom);
      const byTo = !dateTo || new Date(item.publish_date) <= new Date(dateTo);

      return byPlatform && byRisk && byDimension && byKeyword && byFrom && byTo;
    });

    const sorted = [...searched].sort((a, b) => {
      if (sortBy === 'date') return new Date(b.publish_date) - new Date(a.publish_date);
      if (sortBy === 'impact') return b.impact_score - a.impact_score;
      return riskOrder[b.risk_level] - riskOrder[a.risk_level];
    });

    return sorted;
  }, [dateFrom, dateTo, news, search, selectedDimensions, selectedPlatforms, selectedRisks, sortBy]);

  const stats = useMemo(() => {
    const total = filteredNews.length;
    const highRisk = filteredNews.filter((item) => item.risk_level === '高').length;
    const now = new Date();
    const thisWeek = filteredNews.filter((item) => {
      const diff = (now.getTime() - new Date(item.publish_date).getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;
    const avgImpact = total ? Math.round(filteredNews.reduce((sum, item) => sum + item.impact_score, 0) / total) : 0;

    return { total, highRisk, thisWeek, avgImpact };
  }, [filteredNews]);

  const getReferenceNewsIds = (item) => {
    const ids = indexes
      .filter((index) => index.citedNewsIds.includes(item.id))
      .map((index) => index.id);

    return ids;
  };

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-cyan-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">Strategic News Library</h2>
            <p className="mt-1 text-sm text-slate-400">可追溯的战略输入新闻库与引用关系检索</p>
          </div>
          <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
            /api/news
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
            <p className="text-xs text-slate-400">总新闻数量</p>
            <p className="mt-2 text-2xl text-cyan-200">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
            <p className="text-xs text-slate-400">高风险数量</p>
            <p className="mt-2 text-2xl text-rose-300">{stats.highRisk}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
            <p className="text-xs text-slate-400">本周新增数量</p>
            <p className="mt-2 text-2xl text-emerald-300">{stats.thisWeek}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
            <p className="text-xs text-slate-400">平均影响评分</p>
            <p className="mt-2 text-2xl text-fuchsia-200">{stats.avgImpact}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
            <p className="text-xs text-slate-400">排序方式</p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200"
            >
              <option value="date">按发布时间</option>
              <option value="impact">按影响评分</option>
              <option value="risk">按风险等级</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-blue-300/20 bg-slate-900/60 p-6 backdrop-blur-xl">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
          <div>
            <p className="mb-2 text-xs text-slate-400">平台筛选（多选）</p>
            <div className="flex flex-wrap gap-2">
              {platforms.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleValue(item, selectedPlatforms, setSelectedPlatforms)}
                  className={`rounded-full border px-2 py-1 text-xs ${
                    selectedPlatforms.includes(item)
                      ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200'
                      : 'border-slate-600 text-slate-300'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-slate-400">风险等级筛选</p>
            <div className="flex flex-wrap gap-2">
              {['低', '中', '高'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleValue(item, selectedRisks, setSelectedRisks)}
                  className={`rounded-full border px-2 py-1 text-xs ${
                    selectedRisks.includes(item)
                      ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200'
                      : 'border-slate-600 text-slate-300'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-slate-400">影响维度筛选</p>
            <div className="flex flex-wrap gap-2">
              {dimensions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleValue(item, selectedDimensions, setSelectedDimensions)}
                  className={`rounded-full border px-2 py-1 text-xs ${
                    selectedDimensions.includes(item)
                      ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200'
                      : 'border-slate-600 text-slate-300'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-slate-400">时间区间筛选</p>
            <div className="grid gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-slate-400">搜索标题关键词</p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="例如：AI Agent"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredNews.map((item) => (
          <div key={item.id} className="space-y-2">
            <StrategicNewsCard news={item} onDetail={onOpenDetail} />
            <button
              type="button"
              onClick={() =>
                onOpenReferences(
                  `${item.title} 被引用关系`,
                  indexes.filter((idx) => idx.citedNewsIds.includes(item.id)).flatMap((idx) => idx.citedNewsIds)
                )
              }
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
            >
              查看被引用关系（{getReferenceNewsIds(item).length} 个战略指数）
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default StrategicNewsLibrary;
