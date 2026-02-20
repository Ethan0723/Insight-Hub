function AIAssistantPanel({ data, open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-950/70" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md animate-[slideIn_220ms_ease-out] border-l border-cyan-300/20 bg-slate-950/95 p-5 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">🧠 向 AI 询问战略问题</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
          >
            关闭
          </button>
        </div>

        <div className="h-[calc(100vh-7rem)] overflow-y-auto pr-1">
          <div className="mt-4 space-y-2">
            {data.samples.map((question) => (
              <button
                key={question}
                type="button"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
              >
                {question}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-300/25 bg-cyan-400/5 p-4">
            <p className="text-sm font-medium text-cyan-200">结构化回答</p>

            <div className="mt-3 space-y-2 text-xs text-slate-200">
              <p>
                <span className="text-slate-400">威胁等级：</span>
                {data.response.threatLevel}
              </p>
              <p>
                <span className="text-slate-400">时间窗口：</span>
                {data.response.timeWindow}
              </p>
              <p className="text-slate-400">受影响业务模块：</p>
              <div className="flex flex-wrap gap-2">
                {data.response.affectedModules.map((item) => (
                  <span key={item} className="rounded-full border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
                    {item}
                  </span>
                ))}
              </div>

              <p className="pt-1 text-slate-400">建议战略方向：</p>
              <div className="space-y-2 text-[11px] text-slate-200">
                {data.response.strategy.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2 rounded-xl border border-slate-700 bg-slate-950/60 p-2">
            <input
              type="text"
              placeholder="输入你的战略问题..."
              className="w-full bg-transparent px-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-cyan-400"
            >
              发送
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default AIAssistantPanel;
