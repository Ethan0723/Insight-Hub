const menus = ['战略总览', '推理引擎', '收入影响', '情报输入层', '竞争矩阵'];

function TopNav() {
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

        <nav className="hidden items-center gap-5 xl:flex">
          {menus.map((item) => (
            <a
              key={item}
              href="#"
              className="text-sm text-slate-300 transition hover:text-cyan-300"
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
          系统状态: 在线
        </div>
      </div>
    </header>
  );
}

export default TopNav;
