import { useEffect, useState } from 'react';

function AnimatedValue({ value }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const duration = 800;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(value * progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display}</>;
}

function StrategicOverview({ brief, indexes, onOpenEvidence }) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    let i = 0;
    setTyped('');
    const timer = setInterval(() => {
      i += 1;
      setTyped(brief.slice(0, i));
      if (i >= brief.length) clearInterval(timer);
    }, 12);

    return () => clearInterval(timer);
  }, [brief]);

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-900/60 p-6 shadow-[0_0_45px_rgba(56,189,248,0.12)] backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100 lg:text-2xl">AI 战略总览</h2>
        <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">今日战略输出</span>
      </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 lg:p-5">
        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">AI 今日战略判断</p>
        <p className="min-h-[92px] whitespace-pre-line text-sm leading-7 text-slate-100 lg:text-base">
          {typed}
          <span className="ml-1 inline-block h-5 w-[2px] animate-pulse bg-cyan-300 align-middle" />
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {indexes.map((index) => (
          <article key={index.id} className="rounded-2xl border border-blue-300/20 bg-slate-900/70 p-4 transition hover:border-cyan-300/40">
            <p className="text-xs text-slate-400">{index.name}</p>
            <div className="mt-3 flex items-end gap-2">
              <p className="text-3xl font-semibold text-cyan-200">
                <AnimatedValue value={index.value} />
              </p>
              <p className="pb-1 text-xs text-emerald-300">{index.delta}</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{index.description}</p>
            <p className="mt-2 text-xs text-slate-500">引用新闻数量: {index.evidence.newsIds.length}</p>
            <button
              type="button"
              onClick={() => onOpenEvidence(index.evidence)}
              className="mt-3 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
            >
              查看引用来源
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export default StrategicOverview;
