function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timeout after ${ms}ms`)), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function safeText(value) {
  return String(value || '').trim();
}

export function buildDbOnlyRagPrompt(question, context) {
  return `
用户问题：
${safeText(question)}

你可用的新闻库（只允许引用这里）：
${safeText(context)}

请输出：
1) 结论摘要（2-3行）
2) 命中的相关新闻（Top N，最多8条，每条带 [编号] + 日期 + 来源 + 标题 + 链接）
3) 影响分析（分点，每点末尾必须带引用编号，如 [1][3]）
4) 建议行动（P0/P1/P2，各1条，必须与引用对应）
若信息不足：在结论里说明“新闻库信息不足/覆盖不够”，并建议需要补充哪些RSS源或关键词。
`.trim();
}

export async function generateDbOnlyAnswer({
  question,
  context,
  apiUrl,
  apiKey,
  model,
  timeoutMs = 45000
}) {
  if (!apiUrl || !apiKey || !model) {
    throw new Error('generateDbOnlyAnswer missing apiUrl/apiKey/model');
  }

  const systemPrompt =
    '你是跨境电商SaaS的战略分析师。你只能基于我提供的新闻DOC作答。若DOC不包含信息，请明确说信息不足，不要编造。';
  const userPrompt = buildDbOnlyRagPrompt(question, context);
  const { signal, clear } = timeoutSignal(timeoutMs);

  try {
    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.35,
        max_tokens: 900,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      throw new Error(`llm failed ${upstream.status}: ${text.slice(0, 220)}`);
    }

    const parsed = JSON.parse(text);
    const answer = String(parsed?.choices?.[0]?.message?.content || '').trim();
    if (!answer) {
      throw new Error('llm returned empty answer');
    }
    return answer;
  } finally {
    clear();
  }
}

export function splitIntoStreamTokens(text, chunkSize = 80) {
  const clean = String(text || '');
  const chunks = [];
  for (let i = 0; i < clean.length; i += chunkSize) {
    chunks.push(clean.slice(i, i + chunkSize));
  }
  return chunks;
}
