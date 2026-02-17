const menus = ['总览', '平台动态', '政策监管', '财务数据', '支付与广告', 'AI趋势', '宏观经济'];

function Navbar({ onOpenAI }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-10">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">跨境电商情报中枢</h1>
          <nav className="hidden items-center gap-5 md:flex">
            {menus.map((menu) => (
              <button
                key={menu}
                className="text-sm text-slate-600 transition hover:text-brand-600"
                type="button"
              >
                {menu}
              </button>
            ))}
          </nav>
        </div>
        <button
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
          type="button"
          onClick={onOpenAI}
        >
          AI 分析
        </button>
      </div>
    </header>
  );
}

export default Navbar;
