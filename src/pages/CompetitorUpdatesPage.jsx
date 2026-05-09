import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const platformOptions = ['Shopify', 'Shopline'];
const sourceTypeOptions = [
  { value: 'product_changelog', label: '产品功能' },
  { value: 'policy_terms', label: '政策条款' },
  { value: 'api_terms', label: 'API 条款' },
  { value: 'privacy', label: '隐私政策' },
  { value: 'payments_privacy', label: '支付隐私' },
  { value: 'dpa', label: '数据处理' }
];
const eventTypeLabels = {
  product_update: '产品更新',
  policy_update: '政策更新',
  api_change: 'API 变化',
  deprecation: '弃用/迁移',
  pricing_change: '价格/套餐',
  payment_change: '支付变化',
  privacy_change: '隐私变化',
  security_change: '安全变化',
  other: '其他'
};
const impactStyles = {
  高: 'app-chip-risk-high',
  中: 'app-chip-risk-mid',
  低: 'app-chip-risk-low'
};

function SelectFilter({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="app-input h-10 rounded-lg px-3 text-sm outline-none"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => {
        const item = typeof option === 'string' ? { value: option, label: option } : option;
        return (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        );
      })}
    </select>
  );
}

function displayText(value) {
  return String(value || '')
    .replace(/我们平台/g, '自有平台')
    .replace(/我们在/g, '当前在')
    .replace(/若我们/g, '若当前')
    .replace(/如果我们/g, '如果当前')
    .replace(/我们缺少/g, '当前缺少')
    .trim();
}

function SummaryPanel({ latestHigh }) {
  const headline = latestHigh ? latestHigh.title : '暂无高影响官方动态';
  const oneLiner = displayText(latestHigh?.impactReason) || '当前筛选范围内未发现高影响信号，可继续观察产品功能与政策快照变化。';

  return (
    <section className="app-hero-card rounded-lg p-5">
      <div>
        <p className="app-section-label">竞品官方动态汇总</p>
        <h2 className="app-text-primary mt-3 text-2xl font-semibold leading-8">最新高影响信号</h2>
        <p className="app-accent-text mt-2 line-clamp-2 max-w-5xl text-base font-medium leading-6">
          {latestHigh ? `${latestHigh.platform} · ${headline}` : headline}
        </p>
        <p className="app-text-secondary mt-3 max-w-5xl text-sm leading-6">{oneLiner}</p>
      </div>
    </section>
  );
}

function CompetitorUpdateDrawer({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="app-overlay absolute inset-0" onClick={onClose} />
      <aside
        className="app-drawer strategic-scroll absolute right-0 top-0 h-full w-full max-w-3xl animate-[slideIn_220ms_ease-out] overflow-y-auto p-6 backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="app-text-primary text-lg font-semibold">官方动态详情</h3>
          <button type="button" onClick={onClose} className="rounded-lg app-button-secondary px-3 py-1.5 text-xs">
            关闭
          </button>
        </div>

        <article className="app-card space-y-5 rounded-2xl p-5">
          <div>
            <p className="app-section-label">{item.platform} / {item.productArea || 'Platform'}</p>
            <h2 className="app-text-primary mt-3 text-2xl font-semibold leading-9">{item.title}</h2>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 ${impactStyles[item.competitiveImpact] || 'app-chip-neutral'}`}>
              竞争影响: {item.competitiveImpact || '中'} / {item.importanceScore || 0}
            </span>
            <span className="rounded-full app-chip-info px-2.5 py-1">
              {eventTypeLabels[item.eventType] || item.eventType}
            </span>
            <span className="rounded-full app-chip-neutral px-2.5 py-1">{item.sourceName}</span>
            <span className="rounded-full app-chip-neutral px-2.5 py-1">{item.displayDate || '待确认时间'}</span>
          </div>

          <section>
            <p className="app-accent-text text-sm font-medium">摘要</p>
            <p className="app-text-secondary mt-2 text-sm leading-6">{displayText(item.summary) || '暂无摘要'}</p>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="app-card-soft rounded-lg p-3">
              <p className="app-text-muted text-xs">影响判断</p>
              <p className="app-text-secondary mt-2 text-xs leading-5">{displayText(item.impactReason) || '待补充'}</p>
            </div>
            <div className="app-card-soft rounded-lg p-3">
              <p className="app-text-muted text-xs">差距假设</p>
              <p className="app-text-secondary mt-2 text-xs leading-5">{displayText(item.gapAssumption) || '待补充'}</p>
            </div>
            <div className="app-card-soft rounded-lg p-3">
              <p className="app-text-muted text-xs">建议动作</p>
              <p className="app-text-secondary mt-2 text-xs leading-5">{displayText(item.recommendedAction) || '待补充'}</p>
            </div>
          </section>

          <section>
            <p className="app-accent-text text-sm font-medium">内容解读</p>
            <p className="app-text-secondary mt-2 whitespace-pre-line text-sm leading-6">
              {displayText(item.content || item.summary) || '暂无正文'}
            </p>
          </section>

          {item.originalContent ? (
            <details className="rounded-lg app-card-soft p-4">
              <summary className="cursor-pointer text-sm app-text-secondary">查看官方英文原文</summary>
              <p className="app-text-muted mt-3 whitespace-pre-line text-xs leading-5">{item.originalContent}</p>
            </details>
          ) : null}

          <a
            href={item.detailUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-lg app-button-primary px-4 py-2 text-sm font-medium"
          >
            打开官方原文
          </a>
        </article>
      </aside>
    </div>
  );
}

function CompetitorUpdatesPage() {
  const [filters, setFilters] = useState({
    platform: '',
    sourceType: '',
    eventType: '',
    competitiveImpact: '',
    keyword: '',
    dateFrom: '2026-01-01',
    dateTo: ''
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    api
      .getCompetitorUpdates({
        offset: 0,
        limit: 200,
        ...filters
      })
      .then((res) => {
        if (!mounted) return;
        setItems(res.list || []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(String(err?.message || err || '平台动态加载失败'));
        setItems([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [
    filters.platform,
    filters.sourceType,
    filters.eventType,
    filters.competitiveImpact,
    filters.keyword,
    filters.dateFrom,
    filters.dateTo
  ]);

  const latestHigh = useMemo(() => {
    return items.find((item) => item.competitiveImpact === '高') || null;
  }, [items]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <SummaryPanel latestHigh={latestHigh} />

      <section className="app-section rounded-lg p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="app-section-label">筛选与范围</p>
            <h2 className="app-text-primary mt-2 text-xl font-semibold">Shopify / SHOPLINE 产品与政策动态</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <input
            value={filters.keyword}
            onChange={(event) => updateFilter('keyword', event.target.value)}
            placeholder="搜索标题、摘要、产品领域"
            className="app-input h-10 rounded-lg px-3 text-sm outline-none xl:col-span-2"
          />
          <SelectFilter value={filters.platform} onChange={(v) => updateFilter('platform', v)} options={platformOptions} placeholder="全部平台" />
          <SelectFilter value={filters.sourceType} onChange={(v) => updateFilter('sourceType', v)} options={sourceTypeOptions} placeholder="全部来源类型" />
          <SelectFilter
            value={filters.competitiveImpact}
            onChange={(v) => updateFilter('competitiveImpact', v)}
            options={['高', '中', '低']}
            placeholder="全部影响"
          />
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => updateFilter('dateFrom', event.target.value)}
            className="app-input h-10 rounded-lg px-3 text-sm outline-none"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => updateFilter('dateTo', event.target.value)}
            className="app-input h-10 rounded-lg px-3 text-sm outline-none"
          />
        </div>
      </section>

      <section className="app-section overflow-hidden rounded-lg">
        <div className="app-table-head grid grid-cols-12 gap-4 border-b border-[var(--app-border)] px-4 py-3 text-xs font-medium">
          <div className="col-span-5">动态</div>
          <div className="col-span-2">分类</div>
          <div className="col-span-2">影响</div>
          <div className="col-span-2">时间</div>
          <div className="col-span-1 text-right">详情</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm app-text-muted">正在加载平台动态…</div>
        ) : error ? (
          <div className="p-6 text-sm app-danger-text">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm app-text-muted">暂无符合条件的平台动态。</div>
        ) : (
          <div className="divide-y divide-[var(--app-border)]">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="grid w-full grid-cols-12 gap-4 px-4 py-4 text-left transition hover:bg-[var(--app-surface-hover)]"
              >
                <div className="col-span-12 md:col-span-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full app-chip-neutral px-2 py-1 text-[11px]">{item.platform}</span>
                    <span className="rounded-full app-chip-info px-2 py-1 text-[11px]">{item.sourceName}</span>
                  </div>
                  <h3 className="app-text-primary mt-2 text-sm font-semibold leading-6">{item.title}</h3>
                  <p className="app-text-muted mt-1 line-clamp-2 text-xs leading-5">{item.summary}</p>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <p className="app-text-secondary text-sm">{item.productArea || 'Platform'}</p>
                  <p className="app-text-muted mt-1 text-xs">{eventTypeLabels[item.eventType] || item.eventType}</p>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${impactStyles[item.competitiveImpact] || 'app-chip-neutral'}`}>
                    {item.competitiveImpact || '中'} / {item.importanceScore || 0}
                  </span>
                  <p className="app-text-muted mt-2 line-clamp-2 text-xs leading-5">{displayText(item.impactReason)}</p>
                </div>
                <div className="col-span-8 md:col-span-2">
                  <p className="app-text-secondary text-sm">{item.displayDate || '待确认'}</p>
                </div>
                <div className="col-span-4 self-center text-right md:col-span-1">
                  <span className="rounded-lg app-button-secondary px-3 py-1.5 text-xs">查看</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <CompetitorUpdateDrawer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export default CompetitorUpdatesPage;
