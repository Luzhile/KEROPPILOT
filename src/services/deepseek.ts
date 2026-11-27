// DeepSeek chat-completions client with streaming (SSE) support.
// The API key stays in memory; it is never written to logs or error messages.

export const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

export const DEEPSEEK_MODELS = [
  { id: 'deepseek-chat', name: '通用对话', note: '响应快，适合日常回复与语境解读' },
  { id: 'deepseek-reasoner', name: '深度推理', note: '先推理再回答，适合复杂话题，耗时更长' },
] as const;
export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number]['id'];
export const DEFAULT_MODEL: DeepSeekModel = 'deepseek-chat';

export const SYSTEM_PROMPT =
  '你是中文微信沟通助手。严格按用户消息里的任务和格式直接输出结果，不要复述提示词，不要解释流程，不要添加前言或免责声明。';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateOptions {
  apiKey: string;
  model: DeepSeekModel;
  prompt: string;
  signal?: AbortSignal;
  /** Receives the full accumulated text after every chunk. */
  onText?: (text: string) => void;
  /** Called once when a reasoning model starts thinking before answering. */
  onReasoning?: () => void;
}

export interface GenerateResult {
  text: string;
  usage?: TokenUsage;
}

export type DeepSeekErrorCode =
  | 'missing_key'
  | 'aborted'
  | 'network'
  | 'auth'
  | 'balance'
  | 'rate_limit'
  | 'server'
  | 'request'
  | 'response';

export class DeepSeekError extends Error {
  readonly code: DeepSeekErrorCode;
  readonly status?: number;

  constructor(message: string, code: DeepSeekErrorCode, status?: number) {
    super(message);
    this.name = 'DeepSeekError';
    this.code = code;
    this.status = status;
  }
}

interface StreamChunk {
  choices?: { delta?: { content?: string | null; reasoning_content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

interface ChatResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
}

export function toUsage(value: StreamChunk['usage']): TokenUsage | undefined {
  if (!value) return undefined;
  return {
    promptTokens: value.prompt_tokens ?? 0,
    completionTokens: value.completion_tokens ?? 0,
    totalTokens: value.total_tokens ?? 0,
  };
}

/**
 * Incremental SSE decoder. DeepSeek sends one JSON payload per `data:` line and
 * terminates the stream with `[DONE]`. Returns complete payloads only, so event
 * boundaries split across network chunks are handled.
 */
export function createSseParser() {
  let buffer = '';
  return function feed(chunk: string): string[] {
    buffer += chunk.replace(/\r/g, '');
    const payloads: string[] = [];
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
        .join('\n');
      if (data) payloads.push(data);
      boundary = buffer.indexOf('\n\n');
    }
    return payloads;
  };
}

export function isDonePayload(payload: string): boolean {
  return payload.trim() === '[DONE]';
}

export function readStreamChunk(payload: string): { content: string; reasoning: boolean; usage?: TokenUsage } {
  let parsed: StreamChunk;
  try {
    parsed = JSON.parse(payload) as StreamChunk;
  } catch {
    throw new DeepSeekError('收到无法解析的流式响应，请重试。', 'response');
  }
  const delta = parsed.choices?.[0]?.delta;
  return {
    content: delta?.content ?? '',
    reasoning: Boolean(delta?.reasoning_content),
    usage: toUsage(parsed.usage),
  };
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const raw = (await response.text()).trim();
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw) as ChatResponse;
      return (parsed.error?.message ?? raw).slice(0, 200);
    } catch {
      return raw.slice(0, 200);
    }
  } catch {
    return '';
  }
}

function describeHttpError(status: number, detail: string): { message: string; code: DeepSeekErrorCode } {
  if (status === 401 || status === 403) {
    return { message: 'API Key 无效或已失效，请在「API 设置」中重新保存。', code: 'auth' };
  }
  if (status === 402) {
    return { message: 'DeepSeek 账户余额不足，请充值后再试。', code: 'balance' };
  }
  if (status === 429) {
    return { message: '请求过于频繁，请稍候再试。', code: 'rate_limit' };
  }
  if (status >= 500) {
    return { message: `DeepSeek 服务暂时不可用（HTTP ${status}），请稍后重试。`, code: 'server' };
  }
  return {
    message: `请求被拒绝（HTTP ${status}）${detail ? `：${detail}` : '。'}`,
    code: 'request',
  };
}

function toAbortError(): DeepSeekError {
  return new DeepSeekError('已停止生成。', 'aborted');
}

function assertKey(apiKey: string): string {
  const key = apiKey.trim();
  if (!key) throw new DeepSeekError('尚未配置 DeepSeek API Key，请先在「API 设置」中保存。', 'missing_key');
  return key;
}

function requestBody(model: DeepSeekModel, prompt: string, stream: boolean) {
  return {
    model,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  };
}

export async function generateReply(options: GenerateOptions): Promise<GenerateResult> {
  const apiKey = assertKey(options.apiKey);
  if (!options.prompt.trim()) {
    throw new DeepSeekError('没有可发送的内容，请先填写回复意图。', 'request');
  }

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody(options.model, options.prompt, true)),
      signal: options.signal,
    });
  } catch (cause) {
    if (options.signal?.aborted || (cause as Error)?.name === 'AbortError') throw toAbortError();
    throw new DeepSeekError('无法连接 DeepSeek API，请检查网络或系统代理后重试。', 'network');
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    const { message, code } = describeHttpError(response.status, detail);
    throw new DeepSeekError(message, code, response.status);
  }
  if (!response.body) {
    throw new DeepSeekError('DeepSeek 没有返回可读取的内容，请重试。', 'response');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const feed = createSseParser();
  let text = '';
  let usage: TokenUsage | undefined;
  let reasoningAnnounced = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const payload of feed(decoder.decode(value, { stream: true }))) {
        if (isDonePayload(payload)) {
          reader.cancel().catch(() => undefined);
          if (!text.trim()) {
            throw new DeepSeekError('DeepSeek 返回了空内容，请重试或更换模型。', 'response');
          }
          return { text: text.trim(), usage };
        }
        const chunk = readStreamChunk(payload);
        if (chunk.usage) usage = chunk.usage;
        if (chunk.reasoning && !reasoningAnnounced) {
          reasoningAnnounced = true;
          options.onReasoning?.();
        }
        if (chunk.content) {
          text += chunk.content;
          options.onText?.(text);
        }
      }
    }
  } catch (cause) {
    if (options.signal?.aborted || (cause as Error)?.name === 'AbortError') throw toAbortError();
    throw cause;
  } finally {
    reader.releaseLock();
  }

  if (!text.trim()) {
    throw new DeepSeekError('DeepSeek 返回了空内容，请重试或更换模型。', 'response');
  }
  return { text: text.trim(), usage };
}

export interface ConnectionTestResult {
  reply: string;
  latencyMs: number;
  usage?: TokenUsage;
}

/** Minimal non-streaming request used by the settings page. */
export async function testConnection(
  apiKey: string,
  model: DeepSeekModel,
  signal?: AbortSignal,
): Promise<ConnectionTestResult> {
  const key = assertKey(apiKey);
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        ...requestBody(model, '这是一次连接测试，请只回复两个字：正常', false),
        max_tokens: 512,
      }),
      signal,
    });
  } catch (cause) {
    if (signal?.aborted || (cause as Error)?.name === 'AbortError') throw toAbortError();
    throw new DeepSeekError('无法连接 DeepSeek API，请检查网络或系统代理后重试。', 'network');
  }
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    const { message, code } = describeHttpError(response.status, detail);
    throw new DeepSeekError(message, code, response.status);
  }
  const data = (await response.json()) as ChatResponse;
  const reply = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!reply) throw new DeepSeekError('连接成功，但模型没有返回内容。', 'response');
  return { reply, latencyMs: Math.round(performance.now() - startedAt), usage: toUsage(data.usage) };
}
