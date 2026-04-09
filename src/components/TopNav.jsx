const menus = [
  { key: 'overview', label: '战略总览' },
  { key: 'revenue', label: '收入影响沙盘' },
  { key: 'reasoning', label: '外部信号引擎' },
  { key: 'feed', label: '战略输入情报流' },
  { key: 'matrix', label: '竞争动态矩阵' },
  { key: 'library', label: '新闻库' }
];

function TopNav({ activeKey, onNavigate, aiPanelOpen, onToggleAI, theme, onToggleTheme }) {
  return (
    <header className="app-nav sticky top-0 z-30 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="app-logo-badge flex h-10 w-10 items-center justify-center rounded-xl text-lg">
            🧠
          </div>
          <div>
            <p className="app-text-muted text-sm">AI SaaS Strategic Intelligence Engine</p>
            <h1 className="app-text-primary text-base font-semibold lg:text-lg">战略决策中枢</h1>
          </div>
        </div>

        <nav className="hidden items-center gap-2 xl:flex">
          {menus.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`app-nav-pill rounded-xl border border-transparent px-3.5 py-2 text-sm ${
                activeKey === item.key
                  ? 'app-nav-active'
                  : ''
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-full app-button-secondary px-3.5 py-1.5 text-xs font-medium"
          >
            {theme === 'dark' ? '浅色驾驶舱' : '深色驾驶舱'}
          </button>

          <button
            type="button"
            onClick={onToggleAI}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                aiPanelOpen
                ? 'app-accent-chip'
                : 'app-button-secondary'
            }`}
          >
            {aiPanelOpen ? '收起 AI 助手' : '展开 AI 助手'}
          </button>

          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/8 px-3 py-1.5 text-xs app-success-text">
            系统状态: 在线
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopNav;
