const menus = [
  { key: 'overview', label: '战略总览' },
  { key: 'reasoning', label: '推理引擎' },
  { key: 'revenue', label: '收入影响' },
  { key: 'feed', label: '情报输入层' },
  { key: 'matrix', label: '竞争矩阵' },
  { key: 'library', label: '新闻库' }
];

function TopNav({ activeKey, onNavigate, aiPanelOpen, onToggleAI }) {
  return (
    <header className="sticky top-0 z-30 border-b border-blue-400/10 bg-slate-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-lg">
            🧠
          </div>
          <div>
            <p className="text-sm text-slate-400">AI SaaS Strategic Intelligence Engine</p>
            <h1 className="text-base font-semibold text-slate-100 lg:text-lg">战略决策中枢</h1>
          </div>
        </div>

        <nav className="hidden items-center gap-2 xl:flex">
          {menus.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                activeKey === item.key
                  ? 'bg-cyan-400/20 text-cyan-200'
                  : 'text-slate-300 hover:text-cyan-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAI}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              aiPanelOpen
                ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-200'
                : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200'
            }`}
          >
            {aiPanelOpen ? '收起 AI 助手' : '展开 AI 助手'}
          </button>

          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
            系统状态: 在线
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopNav;
