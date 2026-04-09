function ModelExplainPanel({ explainers }) {
  return (
    <section className="app-section rounded-3xl p-6 backdrop-blur-xl lg:p-8">
      <details>
        <summary className="app-text-primary cursor-pointer list-none text-xl font-semibold lg:text-2xl">AI 战略模型说明</summary>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {explainers.map((item) => (
            <article key={item.title} className="app-card rounded-2xl p-4">
              <p className="app-accent-text text-sm font-medium">{item.title}</p>
              <p className="app-text-secondary mt-2 text-sm leading-6">{item.text}</p>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}

export default ModelExplainPanel;
