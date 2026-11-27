import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DeepSeekError,
  createSseParser,
  generateReply,
  readStreamChunk,
  testConnection,
} from './deepseek';

const apiKey = 'sk-test-1234567890abcdef';
const prompt = '为这段聊天拟写三个回复版本。';

function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

function chunk(content?: string, extra: Record<string, unknown> = {}): string {
  return `data: ${JSON.stringify({ choices: [{ delta: content ? { content } : {}, ...extra }] })}\n\n`;
}

describe('SSE decoding', () => {
  it('reassembles events split across network chunks and tolerates CRLF', () => {
    const feed = createSseParser();
    expect(feed('data: {"a":1}\r\n\r\nda')).toEqual(['{"a":1}']);
    expect(feed('ta: {"b":2}\n\n')).toEqual(['{"b":2}']);
    expect(feed('\ndata: {"c":3}\n\n')).toEqual(['{"c":3}']);
  });

  it('joins multi-line data fields and ignores comments', () => {
    const feed = createSseParser();
    expect(feed(': keep-alive\ndata: line1\ndata: line2\n\n')).toEqual(['line1\nline2']);
  });

  it('reads content, reasoning markers and usage from one payload', () => {
    expect(readStreamChunk('{"choices":[{"delta":{"content":"你好"}}]}')).toEqual({
      content: '你好', reasoning: false, usage: undefined,
    });
    expect(readStreamChunk('{"choices":[{"delta":{"reasoning_content":"想"}}]}').reasoning).toBe(true);
    expect(readStreamChunk('{"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":4,"total_tokens":7}}').usage)
      .toEqual({ promptTokens: 3, completionTokens: 4, totalTokens: 7 });
    expect(() => readStreamChunk('{oops')).toThrow(DeepSeekError);
  });
});

describe('generateReply', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('streams accumulated text and returns token usage', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(sseResponse([
      chunk('版本一'),
      chunk('：可以呀'),
      'data: {"choices":[],"usage":{"prompt_tokens":120,"completion_tokens":30,"total_tokens":150}}\n\n',
      'data: [DONE]\n\n',
    ]));
    const updates: string[] = [];
    const result = await generateReply({
      apiKey, model: 'deepseek-chat', prompt,
      onText: text => updates.push(text),
    });

    expect(updates).toEqual(['版本一', '版本一：可以呀']);
    expect(result).toEqual({
      text: '版本一：可以呀',
      usage: { promptTokens: 120, completionTokens: 30, totalTokens: 150 },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${apiKey}` });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: 'deepseek-chat', stream: true, stream_options: { include_usage: true } });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1]).toEqual({ role: 'user', content: prompt });
  });

  it('notifies once when a reasoning model starts thinking', async () => {
    vi.mocked(fetch).mockResolvedValue(sseResponse([
      'data: {"choices":[{"delta":{"reasoning_content":"先分析"}}]}\n\n',
      'data: {"choices":[{"delta":{"reasoning_content":"再分析"}}]}\n\n',
      chunk('最终回答'),
      'data: [DONE]\n\n',
    ]));
    const reasoning = vi.fn();
    const result = await generateReply({ apiKey, model: 'deepseek-reasoner', prompt, onReasoning: reasoning });
    expect(reasoning).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('最终回答');
    expect(result.usage).toBeUndefined();
  });

  it('maps HTTP failures to actionable Chinese messages without echoing the key', async () => {
    const cases: [number, RegExp][] = [
      [401, /API Key 无效或已失效/],
      [402, /余额不足/],
      [429, /请求过于频繁/],
      [500, /服务暂时不可用/],
      [400, /请求被拒绝（HTTP 400）/],
    ];
    for (const [status, expected] of cases) {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(
        JSON.stringify({ error: { message: 'server detail' } }),
        { status, headers: { 'Content-Type': 'application/json' } },
      ));
      const error = await generateReply({ apiKey, model: 'deepseek-chat', prompt }).catch(cause => cause);
      expect(error).toBeInstanceOf(DeepSeekError);
      expect(error.message).toMatch(expected);
      expect(error.message).not.toContain(apiKey);
    }
  });

  it('reports missing credentials, empty prompts, network failures and aborts', async () => {
    await expect(generateReply({ apiKey: '', model: 'deepseek-chat', prompt }))
      .rejects.toMatchObject({ code: 'missing_key' });
    await expect(generateReply({ apiKey, model: 'deepseek-chat', prompt: '   ' }))
      .rejects.toMatchObject({ code: 'request' });

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(generateReply({ apiKey, model: 'deepseek-chat', prompt }))
      .rejects.toMatchObject({ code: 'network', message: expect.stringContaining('无法连接 DeepSeek API') });

    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    await expect(generateReply({ apiKey, model: 'deepseek-chat', prompt }))
      .rejects.toMatchObject({ code: 'aborted' });
  });

  it('rejects empty streams and unreadable bodies', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(generateReply({ apiKey, model: 'deepseek-chat', prompt }))
      .rejects.toMatchObject({ code: 'response' });

    vi.mocked(fetch).mockResolvedValueOnce(sseResponse(['data: [DONE]\n\n']));
    await expect(generateReply({ apiKey, model: 'deepseek-chat', prompt }))
      .rejects.toMatchObject({ code: 'response' });
  });
});

describe('testConnection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a non-streaming probe and reports latency', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '正常' } }],
      usage: { prompt_tokens: 9, completion_tokens: 2, total_tokens: 11 },
    }), { status: 200 }));
    const result = await testConnection(apiKey, 'deepseek-chat');
    expect(result.reply).toBe('正常');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.usage?.totalTokens).toBe(11);
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body.stream).toBe(false);
    expect(body.max_tokens).toBe(512);
  });
});
