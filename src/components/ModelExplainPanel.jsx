import { modelExplainers } from '../data/strategicMockData';

function ModelExplainPanel() {
  return (
    <section className="rounded-3xl border border-emerald-300/20 bg-slate-900/60 p-6 backdrop-blur-xl lg:p-8">
      <details>
        <summary className="cursor-pointer list-none text-xl font-semibold text-slate-100 lg:text-2xl">
          ⚙ AI 战略模型说明
        </summary>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {modelExplainers.map((item) => (
            <article key={item.title} className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
              <p className="text-sm font-medium text-emerald-200">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}

export default ModelExplainPanel;
