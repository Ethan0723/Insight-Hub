function AIChatPanel({ open, onClose, messages }) {
  return (
    <div
      className={`fixed right-0 top-0 z-30 h-full w-full max-w-md transform border-l border-slate-200 bg-white shadow-2xl transition duration-200 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900">AI 分析中枢</h3>
        <button className="text-sm text-slate-500 hover:text-slate-700" type="button" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
          示例问题：最近一个月跨境政策趋势？ / Shopify 财报有哪些关键信号？ / AI对独立站有什么影响？
        </div>
        <div className="h-[62vh] space-y-3 overflow-y-auto pr-1">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-2 text-sm leading-6 ${
                  msg.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 w-full border-t border-slate-200 bg-white p-4">
        <div className="flex gap-2">
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="输入你的问题（Demo 不连接后端）"
            type="text"
          />
          <button className="rounded-xl bg-brand-600 px-3 text-sm text-white hover:bg-brand-700" type="button">
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChatPanel;
