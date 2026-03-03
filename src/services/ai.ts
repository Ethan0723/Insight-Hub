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
  newsItems: Array<{ title: string; summary?: string }>;
}

interface StreamOptions {
  onToken: (token: string) => void;
  onSources?: (sources: Array<{ title: string; url: string; published_at?: string; source?: string }>) => void;
  signal?: AbortSignal;
}

export interface AIChatV2Payload {
  query: string;
  mode?: 'auto' | 'news_summary' | 'brief_today' | 'qa';
  range_days?: number;
  top_k?: number;
  timezone?: string;
  debug?: boolean;
}

export interface AIChatV2Response {
  answer: string;
  cards: {
    headline: string;
    key_drivers: string[];
    impacts: string[];
    actions: Array<{
      priority: 'P0' | 'P1' | 'P2' | string;
      title: string;
      why: string;
      owner_suggest: string;
      timeframe: string;
    }>;
  };
  sources: Array<{
    news_id: string;
    title: string;
    url: string;
    domain: string;
    published_at: string;
    score: number;
  }>;
  reasoning_view: {
    intent: string;
    time_range: string;
    retrieval: {
      total_candidates: number;
      returned: number;
      strategy: string;
    };
    synthesis_steps: string[];
    clusters?: string[];
  };
}

function buildAiApiUrl(path: string): string {
  const base = (import.meta.env.VITE_AI_API_BASE as string | undefined)?.trim();
  if (!base) return path;
  return `${base.replace(/\/$/, '')}${path}`;
}

async function streamSseResponse(
  response: Response,
  onToken: (token: string) => void,
  onSources?: (sources: Array<{ title: string; url: string; published_at?: string; source?: string }>) => void
): Promise<string> {
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
        const parsed = JSON.parse(payload) as {
          token?: string;
          error?: string;
          sources?: Array<{ title: string; url: string; published_at?: string; source?: string }>;
          result?: {
            answer?: string;
            sources?: Array<{ title: string; url: string; published_at?: string; source?: string }>;
          };
        };
        if (parsed.error) throw new Error(parsed.error);
        if (Array.isArray(parsed.sources) && onSources) {
          onSources(parsed.sources);
        }
        if (parsed.token) {
          fullText += parsed.token;
          onToken(parsed.token);
        }
        if (parsed.result?.answer && !fullText) {
          fullText = parsed.result.answer;
          onToken(parsed.result.answer);
        }
        if (Array.isArray(parsed.result?.sources) && onSources) {
          onSources(parsed.result.sources);
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

  return streamSseResponse(response, options.onToken, options.onSources);
}

export async function streamNewsSummary(
  newsItems: Array<{ title: string; summary?: string }>,
  options: StreamOptions
): Promise<string> {
  const body: AINewsSummaryPayload = {
    task: 'news_summary',
    newsItems
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

  return streamSseResponse(response, options.onToken, options.onSources);
}

export async function askAiChatV2(payload: AIChatV2Payload): Promise<AIChatV2Response> {
  const response = await fetch(buildAiApiUrl('/api/ai_chat_v2'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `AI chat v2 failed: ${response.status}`);
  }

  const parsed = JSON.parse(text) as AIChatV2Response;
  return parsed;
}
