function MethodPopover() {
  return (
    <details className="group relative">
      <summary className="list-none cursor-pointer rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
        ⓘ 口径说明
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-xs leading-5 text-slate-200 shadow-2xl">
        <p>Baseline：外部态势（新闻驱动，leading indicator）</p>
        <p className="mt-1">Δ：策略参数变化（沙盘仿真，what-if）</p>
        <p className="mt-1">Final：Baseline + Δ（用于决策优先级）</p>
      </div>
    </details>
  );
}

export default MethodPopover;
