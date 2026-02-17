const menus = ['总览', '平台动态', '政策监管', '财务数据', '支付与广告', 'AI趋势', '宏观经济'];

function Navbar({ onOpenAI }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
        <div className="flex items-center gap-8">
          <div className="text-lg font-semibold tracking-tight text-slate-900">跨境电商情报中枢</div>
          <nav className="hidden items-center gap-6 lg:flex">
            {menus.map((menu) => (
              <button
                key={menu}
                type="button"
                className="text-sm text-slate-600 transition-colors hover:text-blue-600"
              >
                {menu}
              </button>
            ))}
          </nav>
        </div>
        <button
          type="button"
          onClick={onOpenAI}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          AI 分析
        </button>
      </div>
    </header>
  );
}

export default Navbar;
