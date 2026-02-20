import { useEffect, useMemo, useState } from 'react';
import { strategicBrief, strategicIndexes } from '../data/strategicMockData';

function AnimatedValue({ value }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const duration = 1000;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(value * progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span>{display}</span>;
}

function StrategicOverview() {
  const [typed, setTyped] = useState('');
  const fullText = useMemo(() => strategicBrief, []);

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(timer);
    }, 18);

    return () => clearInterval(timer);
  }, [fullText]);

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-900/60 p-6 shadow-[0_0_45px_rgba(56,189,248,0.12)] backdrop-blur-xl lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100 lg:text-2xl">AI 战略总览</h2>
        <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
          今日战略输出
        </span>
      </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 lg:p-5">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-slate-500">AI 今日战略判断</p>
        <p className="min-h-[96px] text-sm leading-7 text-slate-100 lg:text-base">
          {typed}
          <span className="ml-1 inline-block h-5 w-[2px] animate-pulse bg-cyan-300 align-middle" />
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {strategicIndexes.map((index) => (
          <article
            key={index.id}
            className="rounded-2xl border border-blue-300/20 bg-slate-900/70 p-4 transition duration-300 hover:border-cyan-300/40 hover:shadow-[0_0_30px_rgba(56,189,248,0.15)]"
          >
            <p className="text-xs text-slate-400">{index.name}</p>
            <div className="mt-3 flex items-end gap-2">
              <p className="text-3xl font-semibold text-cyan-200">
                <AnimatedValue value={index.value} />
              </p>
              <p className="pb-1 text-xs text-emerald-300">{index.delta}</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{index.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default StrategicOverview;
