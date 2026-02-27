export interface AIChatPayload {
  userQuestion: string;
  baseline: number;
  delta: number;
  finalScore: number;
  exposureMatrix: Array<{
    id: string;
    name: string;
    externalRisk: number;
    internalSensitivity: number;
    exposureIndex: number;
    final: number;
  }>;
  priorityRanking: string[];
}

export interface AINewsSummaryPayload {
  task: 'news_summary';
  newsTitles: string[];
}

interface StreamOptions {
  onToken: (token: string) => void;
  signal?: AbortSignal;
}

function buildAiApiUrl(path: string): string {
  const base = (import.meta.env.VITE_AI_API_BASE as string | undefined)?.trim();
  if (!base) return path;
  return `${base.replace(/\/$/, '')}${path}`;
}

async function streamSseResponse(response: Response, onToken: (token: string) => void): Promise<string> {
  if (!response.body) {
    throw new Error('Empty response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const payload = trimmed.replace(/^data:\s*/, '');
      if (payload === '[DONE]') {
        return fullText;
      }

      try {
        const parsed = JSON.parse(payload) as { token?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.token) {
          fullText += parsed.token;
          onToken(parsed.token);
        }
      } catch (error) {
        throw new Error(String((error as Error)?.message || error));
      }
    }
  }

  return fullText;
}

export async function streamAiChat(payload: AIChatPayload, options: StreamOptions): Promise<string> {
  const response = await fetch(buildAiApiUrl('/api/ai_chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `AI API failed: ${response.status}`);
  }

  return streamSseResponse(response, options.onToken);
}

export async function streamNewsSummary(newsTitles: string[], options: StreamOptions): Promise<string> {
  const body: AINewsSummaryPayload = {
    task: 'news_summary',
    newsTitles
  };

  const response = await fetch(buildAiApiUrl('/api/ai_chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `AI summary API failed: ${response.status}`);
  }

  return streamSseResponse(response, options.onToken);
}
