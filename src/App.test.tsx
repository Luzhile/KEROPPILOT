// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { DeepSeekError } from './services/deepseek';
import { MODEL_KEY } from './services/modelSettings';
import { PROFILE_KEY } from './services/preferences';

const desktop = vi.hoisted(() => ({
  copyPrompt: vi.fn(),
  openChatGpt: vi.fn(),
  setPinned: vi.fn(),
  openDeepSeekPlatform: vi.fn(),
}));
vi.mock('./services/desktop', () => ({ ...desktop, desktopAvailable: true }));

const keys = vi.hoisted(() => ({ readApiKey: vi.fn(), writeApiKey: vi.fn(), clearApiKey: vi.fn() }));
vi.mock('./services/apiKey', async importOriginal => {
  const actual = await importOriginal<typeof import('./services/apiKey')>();
  return { ...actual, ...keys };
});

const ai = vi.hoisted(() => ({ generateReply: vi.fn(), testConnection: vi.fn() }));
vi.mock('./services/deepseek', async importOriginal => {
  const actual = await importOriginal<typeof import('./services/deepseek')>();
  return { ...actual, generateReply: ai.generateReply, testConnection: ai.testConnection };
});

const savedKey = 'sk-test-1234567890abcdef';
const replyText = '版本一：可以呀\n\n版本二：周六下午两点？';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  desktop.copyPrompt.mockResolvedValue(undefined);
  desktop.openChatGpt.mockResolvedValue(undefined);
  desktop.openDeepSeekPlatform.mockResolvedValue(undefined);
  keys.readApiKey.mockResolvedValue({ key: savedKey, source: 'file' });
  keys.writeApiKey.mockImplementation(async (value: string) => ({ key: value, source: 'file' }));
  keys.clearApiKey.mockResolvedValue(undefined);
  ai.testConnection.mockResolvedValue({ reply: '正常', latencyMs: 1234 });
  ai.generateReply.mockImplementation(async ({ onText }: { onText?: (text: string) => void }) => {
    onText?.('版本一：可以呀');
    onText?.(replyText);
    return { text: replyText, usage: { promptTokens: 120, completionTokens: 30, totalTokens: 150 } };
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setValue(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillChat(text = '对方：周六一起看展吗？') {
  setValue('粘贴聊天记录', text);
  setValue('回复意图', '我下午有空，确认时间。');
}

async function waitForKey() {
  await waitFor(() => expect(screen.queryByText(/还没有配置 DeepSeek API Key/)).toBeNull());
}

const AUTO_TIMEOUT = { timeout: 4000 };

async function waitForGeneration(count = 1) {
  await waitFor(() => expect(ai.generateReply).toHaveBeenCalledTimes(count), AUTO_TIMEOUT);
  return ai.generateReply.mock.calls[count - 1][0];
}

describe('DeepSeek generation in the console', () => {
  it('generates automatically once chat and intent are ready, then refreshes on slider changes', async () => {
    render(<App />);
    await waitForKey();
    vi.useFakeTimers();
    fillChat();

    // No click: the reply appears by itself after the debounce.
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(ai.generateReply).toHaveBeenCalledTimes(1);
    const request = ai.generateReply.mock.calls[0][0];
    expect(screen.getByText(/版本一：可以呀/)).toBeTruthy();
    expect(request.apiKey).toBe(savedKey);
    expect(request.model).toBe('deepseek-chat');
    expect(request.prompt).toContain('周六一起看展吗？');
    expect(request.prompt).toContain('我下午有空，确认时间。');
    expect(request.prompt).toContain('生成 4 个');

    const consolePanel = within(screen.getByRole('region', { name: '回复控制台' }));
    expect(consolePanel.queryByRole('button', { name: '复制回复' })).toBeNull();

    // Dragging a slider updates the prompt and regenerates without a button click.
    const slider = screen.getByLabelText('直接程度');
    fireEvent.change(slider, { target: { value: '60' } });
    fireEvent.change(slider, { target: { value: '70' } });
    fireEvent.change(slider, { target: { value: '80' } });
    expect(screen.getAllByRole('slider')).toHaveLength(4);
    fireEvent.change(screen.getByLabelText('幽默程度'), { target: { value: '75' } });

    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(ai.generateReply).toHaveBeenCalledTimes(2);
    const refreshed = ai.generateReply.mock.calls[1][0];
    expect(refreshed.prompt).toContain('"直接程度": 80');
    expect(refreshed.prompt).toContain('"幽默程度": 75');
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(ai.generateReply).toHaveBeenCalledTimes(2);
  });

  it('shows only the reply text, without a heading, action or metadata', async () => {
    render(<App />);
    fillChat();
    await waitForKey();
    await waitForGeneration();
    await screen.findByText(/版本一：可以呀/);

    expect(screen.queryByText('回复控制台')).toBeNull();
    expect(screen.queryByText('已完成')).toBeNull();
    expect(screen.queryByText(/tokens/)).toBeNull();
    expect(screen.queryByText(/参数已调整/)).toBeNull();

    const consolePanel = within(screen.getByRole('region', { name: '回复控制台' }));
    expect(consolePanel.queryByRole('button', { name: '复制回复' })).toBeNull();
  });

  it('surfaces API key errors and opens settings from the header', async () => {
    ai.generateReply.mockRejectedValue(new DeepSeekError('API Key 无效或已失效，请在「API 设置」中重新保存。', 'auth', 401));
    render(<App />);
    fillChat();
    await waitForKey();

    const alert = await screen.findByRole('alert', {}, AUTO_TIMEOUT);
    expect(alert.textContent).toContain('API Key 无效或已失效');
    fireEvent.click(screen.getByRole('button', { name: 'API 设置' }));
    expect(screen.getByRole('dialog', { name: 'API 设置' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'DeepSeek API 设置' })).toBeTruthy();
  });

  it('generates analysis automatically for the conversation page', async () => {
    render(<App />);
    setValue('粘贴聊天记录', '对方：周六一起看展吗？');
    await waitForKey();
    fireEvent.click(screen.getByRole('button', { name: '对话分析' }));

    const analysis = await waitForGeneration();
    expect(analysis.prompt).toContain('A / B / C');
    expect(analysis.prompt).toContain('300–400 字');
    expect(analysis.prompt).toContain('当代年轻人');
    const analysisConsole = within(screen.getByRole('region', { name: '解读控制台' }));
    expect(await analysisConsole.findByText(/版本二/)).toBeTruthy();
  });

  it('generates from chat alone only after clicking directly generate', async () => {
    render(<App />);
    await waitForKey();
    const consolePanel = within(screen.getByRole('region', { name: '回复控制台' }));
    expect(consolePanel.getByText('回复会自动出现在这里。')).toBeTruthy();

    const button = screen.getByRole<HTMLButtonElement>('button', { name: '直接生成' });
    expect(button.disabled).toBe(true);
    vi.useFakeTimers();
    setValue('粘贴聊天记录', '对方：在吗？');
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(ai.generateReply).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);

    await act(async () => { fireEvent.click(button); });
    expect(ai.generateReply).toHaveBeenCalledTimes(1);
    expect(ai.generateReply.mock.calls[0][0].prompt).toContain('用户未填写回复意图');
    expect(ai.generateReply.mock.calls[0][0].prompt).toContain('在吗？');
  });

  it('waits two full seconds after the latest input and cancels a pending run on click', async () => {
    render(<App />);
    await waitForKey();
    vi.useFakeTimers();
    fillChat();
    await act(() => vi.advanceTimersByTimeAsync(900));
    setValue('回复意图', '下午三点有空。');
    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(ai.generateReply).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(ai.generateReply).toHaveBeenCalledTimes(1);
    expect(ai.generateReply.mock.calls[0][0].prompt).toContain('下午三点有空。');

    setValue('回复意图', '下午四点有空。');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '直接生成' })); });
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(ai.generateReply).toHaveBeenCalledTimes(2);
    expect(ai.generateReply.mock.calls[1][0].prompt).toContain('下午四点有空。');
  });

  it('branches the selected reply and returns to its original text', async () => {
    const original = '【版本一 · 确认时间】\n[正文] 周六下午两点见。\n[修改建议] ["把时间说得随意些","加一句期待","先询问对方方便吗"]';
    const revised = '[正文] 周六下午两点左右见？\n[修改建议] ["调整问句语气","简化时间表述","加一句确认地点"]';
    ai.generateReply.mockResolvedValueOnce({ text: original });
    ai.generateReply.mockResolvedValueOnce({ text: revised });
    render(<App />);
    await waitForKey();
    setValue('粘贴聊天记录', '对方：周六几点见？');
    fireEvent.click(screen.getByRole('button', { name: '直接生成' }));
    const options = await screen.findByRole('group', { name: '修改建议' });
    expect(within(options).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('周六下午两点见。')).toBeTruthy();
    fireEvent.click(within(options).getByRole('button', { name: '把时间说得随意些' }));
    const request = await waitForGeneration(2);
    expect(request.prompt).toContain('"当前正文":"周六下午两点见。"');
    expect(request.prompt).toContain('"改写方向":"把时间说得随意些"');
    expect(await screen.findByText('周六下午两点左右见？')).toBeTruthy();
    expect(screen.getByRole('button', { name: '加一句确认地点' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '返回原稿' }));
    expect(screen.getByText('周六下午两点见。')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '把时间说得随意些' }));
    expect(screen.getByText('周六下午两点左右见？')).toBeTruthy();
    expect(ai.generateReply).toHaveBeenCalledTimes(2);
  });

  it('uses a custom relationship in the prompt', async () => {
    render(<App />);
    await waitForKey();
    setValue('对方是我的', '自定义');
    fireEvent.change(await screen.findByLabelText('自定义关系'), { target: { value: '同事' } });
    fillChat();

    const request = await waitForGeneration();
    expect(request.prompt).toContain('"同事"');
    expect(request.prompt).not.toContain('"自定义"');
  });

  it('uses the selected model for generation', async () => {
    render(<App />);
    await waitForKey();
    fireEvent.click(screen.getByRole('button', { name: 'API 设置' }));
    setValue('生成模型', 'deepseek-reasoner');
    expect(JSON.parse(localStorage.getItem(MODEL_KEY)!)).toEqual({ model: 'deepseek-reasoner' });
    fireEvent.click(screen.getByRole('button', { name: '关闭 API 设置' }));

    fireEvent.click(screen.getByRole('button', { name: '策略实验台' }));
    fillChat();
    const request = await waitForGeneration();
    expect(request.model).toBe('deepseek-reasoner');
  });
});

describe('DeepSeek API settings', () => {
  it('opens the small settings dialog from the header and closes with Escape', async () => {
    render(<App />);
    await waitForKey();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('navigation').textContent).not.toContain('API 设置');

    fireEvent.click(screen.getByRole('button', { name: 'API 设置' }));
    expect(screen.getByRole('dialog', { name: 'API 设置' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves, tests and deletes the key stored by the backend', async () => {
    render(<App />);
    await waitForKey();
    fireEvent.click(screen.getByRole('button', { name: 'API 设置' }));

    setValue('DeepSeek API Key', 'sk-new-1234567890abcdef');
    fireEvent.click(screen.getByRole('button', { name: /保存到本机/ }));
    await waitFor(() => expect(keys.writeApiKey).toHaveBeenCalledWith('sk-new-1234567890abcdef'));
    expect(await screen.findByText(/API Key 已加密保存/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /测试连接/ }));
    expect(ai.testConnection).toHaveBeenCalledWith('sk-new-1234567890abcdef', 'deepseek-chat');
    expect(await screen.findByText(/连接正常，用时 1.2 秒/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '删除已保存的 API Key' }));
    await waitFor(() => expect(keys.clearApiKey).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/已删除本机保存的 API Key/)).toBeTruthy();
  });

  it('warns about non-standard keys but still saves them', async () => {
    render(<App />);
    await waitForKey();
    fireEvent.click(screen.getByRole('button', { name: 'API 设置' }));
    setValue('DeepSeek API Key', 'proxy-token-abc');
    expect(screen.getByText(/官方 Key 通常以 sk- 开头/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /保存到本机/ }));
    expect(await screen.findByText(/这个 Key 格式不像官方 Key/)).toBeTruthy();
  });

  it('reports connection failures from the settings page', async () => {
    ai.testConnection.mockRejectedValue(new DeepSeekError('DeepSeek 账户余额不足，请充值后再试。', 'balance', 402));
    render(<App />);
    await waitForKey();
    fireEvent.click(screen.getByRole('button', { name: 'API 设置' }));
    fireEvent.click(screen.getByRole('button', { name: /测试连接/ }));
    expect(await screen.findByText(/余额不足/)).toBeTruthy();
  });
});

describe('saved style', () => {
  it('applies the saved style to generation and persists only preferences', async () => {
    const app = render(<App />);
    await waitForKey();
    fireEvent.click(screen.getByRole('button', { name: '我的风格' }));
    setValue('口头禅', '好家伙');
    setValue('Emoji 使用偏好', '不用');
    setValue('自定义表达规则', '少用感叹号。');

    fireEvent.click(screen.getByRole('button', { name: '策略实验台' }));
    fillChat();
    const request = await waitForGeneration();
    const prompt = request.prompt as string;
    expect(prompt).toContain('少用感叹号。');
    expect(prompt).toContain('"口头禅": "好家伙"');
    expect(localStorage.getItem(PROFILE_KEY)).not.toContain('周六一起看展');
    expect(localStorage.getItem(PROFILE_KEY)).not.toContain(savedKey);

    app.unmount();
    render(<App />);
    expect((screen.getByLabelText('粘贴聊天记录') as HTMLTextAreaElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: '我的风格' }));
    expect((screen.getByLabelText('口头禅') as HTMLInputElement).value).toBe('好家伙');
  });

  it('reports storage failures', async () => {
    localStorage.setItem(PROFILE_KEY, '{bad');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '我的风格' }));
    expect(screen.getByText(/本地偏好读取失败/)).toBeTruthy();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    setValue('自定义表达规则', '保持简洁');
    expect(screen.getByText(/保存失败/)).toBeTruthy();

    await waitForKey();
    fireEvent.click(screen.getByRole('button', { name: '策略实验台' }));
    fillChat();
    await waitForGeneration();
    await screen.findByText(/版本一/, {}, AUTO_TIMEOUT);

  });
});
