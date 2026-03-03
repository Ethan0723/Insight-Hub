import { useState } from 'react';
import { askAiChatV2 } from '../services/ai';
import { track } from '../lib/analytics';

const FIXED_SAMPLE_QUESTIONS = [
  { id: 'q0', text: '帮我总结近3天新闻' },
  { id: 'q00', text: '总结最近7天新闻' },
  { id: 'q000', text: '今天有什么需要关注' },
  { id: 'q0000', text: '今日重点扫描' },
  { id: 'q1', text: '当前结论中，最值得质疑的假设是什么？' },
  { id: 'q2', text: '如果只能保留一个行动，应该保留哪一个？为什么？' },
  { id: 'q3', text: '在当前判断下，最容易被低估的风险是什么？' }
];

function sanitizePlainText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`{1,3}/g, '')
    .replace(/战略摘要（100字）/g, '战略结论')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s*/g, '')
        .replace(/^\s*[-*+]\s+/g, '')
        .replace(/^\s*>\s*/g, '')
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderParagraphs(text) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return <p className="whitespace-pre-wrap"> </p>;
  }

  return paragraphs.map((paragraph, idx) => (
    <p key={`${idx}-${paragraph.slice(0, 12)}`} className="whitespace-pre-wrap">
      {paragraph}
    </p>
  ));
}

function parseAiV2Payload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const cards = payload.cards && typeof payload.cards === 'object' ? payload.cards : {};
  const sections = [
    {
      heading: '结论',
      bullets: [String(payload.answer || cards.headline || '').trim()].filter(Boolean)
    },
    {
      heading: '关键驱动',
      bullets: (Array.isArray(cards.key_drivers) ? cards.key_drivers : [])
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    },
    {
      heading: '影响路径',
      bullets: (Array.isArray(cards.impacts) ? cards.impacts : [])
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    },
    {
      heading: '建议动作',
      bullets: (Array.isArray(cards.actions) ? cards.actions : [])
        .map((a) => {
          const p = String(a?.priority || '').trim();
          const t = String(a?.title || '').trim();
          const w = String(a?.why || '').trim();
          const o = String(a?.owner_suggest || '').trim();
          const tf = String(a?.timeframe || '').trim();
          if (!t) return '';
          return `${p ? `${p} · ` : ''}${t}${w ? `｜${w}` : ''}${o ? `｜Owner: ${o}` : ''}${tf ? `｜${tf}` : ''}`;
        })
        .filter(Boolean)
    }
  ].filter((s) => s.bullets.length > 0);

  const sources = (Array.isArray(payload.sources) ? payload.sources : [])
    .map((src) => ({
      news_id: String(src?.news_id || '').trim(),
      title: String(src?.title || '').trim(),
      url: String(src?.url || '').trim(),
      source: String(src?.domain || src?.source || '').trim(),
      published_at: String(src?.published_at || '').trim(),
      score: Number(src?.score || 0)
    }))
    .filter((item) => item.url);

  return {
    title: String(cards.headline || 'Insight Copilot').trim(),
    sections,
    sources,
    reasoningView: payload.reasoning_view && typeof payload.reasoning_view === 'object' ? payload.reasoning_view : null
  };
}

function renderSections(message) {
  const sections = Array.isArray(message?.sections) ? message.sections : [];
  if (!sections.length) return renderParagraphs(message.text || '');
  return (
    <div className="space-y-2">
      {message.title ? <p className="text-sm font-semibold text-cyan-100">{message.title}</p> : null}
      {sections.map((section, idx) => (
        <article key={`${section.heading}-${idx}`} className="rounded-lg border border-slate-700/70 bg-slate-950/45 p-2">
          <p className="text-xs font-semibold text-slate-200">{section.heading}</p>
          <div className="mt-1 space-y-1">
            {section.bullets.map((bullet, bIdx) => (
              <p key={`${idx}-${bIdx}`} className="text-sm text-slate-100 leading-[1.6]">
                {bIdx + 1}. {bullet}
              </p>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function AssistantBubble({ message, onOpenEvidence }) {
  const [showStructure, setShowStructure] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-sm text-cyan-100">{message.text}</div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-3 text-sm text-slate-100">
        <div className="mb-2 flex items-center gap-2 text-xs text-cyan-300">
          <span>🤖 AI 助手</span>
          {message.pending ? <span className="text-slate-400">生成中...</span> : null}
        </div>

        <div className="space-y-2.5 text-sm leading-[1.62] text-slate-100">
          {message.pending && !message.text
            ? renderParagraphs('正在模拟不同决策路径的风险与收益…')
            : renderSections(message)}
        </div>

        {Array.isArray(message.sources) && message.sources.length > 0 ? (
          <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/40 p-2">
            <p className="mb-1 text-[11px] text-cyan-200">引用来源</p>
            <div className="space-y-1">
              {message.sources.map((src, idx) => (
                <a
                  key={`${src.url}-${idx}`}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    let domain = '';
                    try {
                      domain = src?.url ? new URL(src.url).hostname : '';
                    } catch {
                      domain = '';
                    }
                    track('citation_click', { domain });
                  }}
                  className="block text-[11px] text-slate-300 hover:text-cyan-200"
                >
                  [{idx + 1}] {src.published_at || ''} {src.source || ''} {src.title}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {message.error ? <p className="mt-2 text-xs text-rose-300">{message.error}</p> : null}

        {message.reasoningView ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowStructure((v) => !v)}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
            >
              {showStructure ? '收起推理结构' : '查看推理结构'}
            </button>

            {showStructure ? (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300 space-y-2">
                  <p>意图识别：{message.reasoningView.intent || '-'}</p>
                  <p>时间窗口：{message.reasoningView.time_range || '-'}</p>
                  <p>
                    检索命中：{message.reasoningView.retrieval?.returned ?? 0} / {message.reasoningView.retrieval?.total_candidates ?? 0}
                  </p>
                  <p>检索策略：{message.reasoningView.retrieval?.strategy || 'hybrid'}</p>
                  {Array.isArray(message.reasoningView.clusters) && message.reasoningView.clusters.length ? (
                    <p>聚类主题：{message.reasoningView.clusters.join(' / ')}</p>
                  ) : null}
                  {Array.isArray(message.reasoningView.synthesis_steps) && message.reasoningView.synthesis_steps.length ? (
                    <div>
                      <p className="text-cyan-200">生成步骤：</p>
                      <div className="mt-1 space-y-1">
                        {message.reasoningView.synthesis_steps.map((step, idx) => (
                          <p key={`${step}-${idx}`}>{idx + 1}. {step}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                {Array.isArray(message.sources) && message.sources.length ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenEvidence({
                        id: `ev-ai-v2-${message.id}`,
                        title: 'AI 对话引用新闻',
                        newsIds: message.sources.map((s) => s.news_id).filter(Boolean)
                      })
                    }
                    className="rounded-lg border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200"
                  >
                    查看证据新闻
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AIAssistantPanel({ open, onClose, onOpenEvidence }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: '基于全球信号生成可执行决策。',
      title: '🧠 Insight Copilot',
      sections: [],
      sources: [],
      reasoningView: null,
      structure: null,
      pending: false,
      error: ''
    }
  ]);

  if (!open) return null;

  const submitQuestion = async (rawQuestion, options = {}) => {
    const question = String(rawQuestion || '').trim();
    const isSample = Boolean(options.isSample);
    const sampleId = String(options.sampleId || '').trim();
    if (!question) return;

    if (isSample && sampleId) {
      track('ai_example_click', { q_id: sampleId });
    } else if (!isSample) {
      track('ai_ask_submit', { input_len: question.length });
    }

    const userMessage = { id: `u-${Date.now()}`, role: 'user', text: question };
    const assistantId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: 'assistant',
        text: '',
        title: '',
        sections: [],
        sources: [],
        reasoningView: null,
        pending: true,
        error: ''
      }
    ]);
    setInput('');

    try {
      let mode = 'auto';
      let rangeDays = 3;
      if (/近7天|最近7天|过去7天|一周|7天/.test(question)) {
        mode = 'news_summary';
        rangeDays = 7;
      } else if (/近3天|最近3天|过去3天|三天|总结|汇总|盘点|扫描/.test(question)) {
        mode = 'news_summary';
        rangeDays = 3;
      } else if (/今天|今日/.test(question)) {
        mode = 'brief_today';
        rangeDays = 1;
      }

      const payload = await askAiChatV2({
        query: question,
        mode,
        range_days: rangeDays,
        top_k: 12,
        timezone: '+08:00',
        debug: true
      });

      const structured = parseAiV2Payload(payload);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text: structured ? '' : sanitizePlainText(payload.answer || ''),
                title: structured?.title || '',
                sections: structured?.sections || [],
                sources: structured?.sources || [],
                reasoningView: structured?.reasoningView || null,
                pending: false
              }
            : item
        )
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text: '',
                title: '检索失败',
                sections: [
                  {
                    heading: '系统提示',
                    bullets: ['当前请求失败，请稍后重试；如持续失败请检查后端日志与 LLM 配置。']
                  }
                ],
                sources: [],
                reasoningView: null,
                pending: false,
                error: String(error?.message || error || 'AI 服务暂不可用')
              }
            : item
        )
      );
    }
  };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-950/70" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md animate-[slideIn_220ms_ease-out] border-l border-cyan-300/20 bg-slate-950/95 p-5 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">🧠 Insight Copilot</h3>
            <p className="mt-0.5 text-xs text-slate-400">基于全球信号生成可执行决策</p>
          </div>
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
            {FIXED_SAMPLE_QUESTIONS.map((question) => (
              <button
                key={question.id}
                type="button"
                onClick={() => submitQuestion(question.text, { isSample: true, sampleId: question.id })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
              >
                {question.text}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {messages.map((message) => (
              <AssistantBubble key={message.id} message={message} onOpenEvidence={onOpenEvidence} />
            ))}
          </div>

          <div className="mt-5 flex gap-2 rounded-xl border border-slate-700 bg-slate-950/60 p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitQuestion(input);
              }}
              placeholder="输入你的战略问题..."
              className="w-full bg-transparent px-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => submitQuestion(input)}
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
