const quickQuestions = ['最近一个月跨境政策趋势？', 'Shopify 财报有哪些关键信号？', 'AI对独立站有什么影响？'];

const mockChats = [
  {
    role: 'user',
    content: '最近一个月跨境政策趋势？'
  },
  {
    role: 'assistant',
    content: '政策侧重点集中在合规披露、关税透明和广告可解释性。EU 与 UK 对商品与广告信息披露要求趋严，美国加强报关抽检。'
  },
  {
    role: 'user',
    content: 'Shopify 财报有哪些关键信号？'
  },
  {
    role: 'assistant',
    content: '核心信号包括商户解决方案占比持续提升，AI 工具推动运营效率改善，GMV 结构向多区域分散。'
  }
];

function AIChatPanel({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm">
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">AI 分析中枢</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">
            关闭
          </button>
        </header>

        <div className="border-b border-slate-100 px-5 py-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">示例问题</p>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((q) => (
              <button key={q} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100" type="button">
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {mockChats.map((chat, index) => {
            const isUser = chat.role === 'user';
            return (
              <div key={`${chat.role}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    isUser ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {chat.content}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
            <input
              type="text"
              placeholder="输入你的问题..."
              className="w-full border-0 px-2 py-1 text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
              发送
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default AIChatPanel;
