import { describe, expect, it } from 'vitest';
import { buildPrompt, parsePastedChat } from './prompt';

describe('chat to prompt workflow', () => {
  it('preserves WeChat names, timestamps, multiline bodies and attachment placeholders', () => {
    const text = '小林\r\n2026年11月08日 14:13\r\n第一行\r\n第二行\r\n\r\n小夏\r\n2026年11月08日 14:14\r\n[图片] example.dat\r\n\r\n小夏\r\n2026年11月08日 14:15\r\n[链接] 示例 https://example.com';
    const messages = parsePastedChat(text);
    expect(messages).toHaveLength(3);
    expect(messages.map(message => message.speakerName)).toEqual(['小林', '小夏', '小夏']);
    expect(messages[0].timestamp).toBe('2026年11月08日 14:13');
    expect(messages[0].text).toBe('第一行\n第二行');
    expect(messages[1].text).toBe('[图片] example.dat');
    expect(messages[2].text).toContain('https://example.com');
    const prompt = buildPrompt(messages, '确认时间', { tone: '自然', length: '简短' });
    expect(prompt).toContain('"发言者": "小夏"');
    expect(prompt).toContain('"时间": "2026年11月08日 14:14"');
    expect(prompt).toContain('结合回复意图理解用户视角');
  });
  it('imports CRLF, labels and unknown speakers without losing order', () => {
    const messages = parsePastedChat('对方：周末有空吗？\r\n我: 下午可以\r\n  时间待确认  \n我：');
    expect(messages.map(message => message.speaker)).toEqual(['other', 'self', 'unknown']);
    expect(messages.map(message => message.text)).toEqual(['周末有空吗？', '下午可以', '时间待确认']);
    expect(new Set(messages.map(message => message.id)).size).toBe(3);
  });
  it('uses corrected records and current settings, including multiline untrusted text', () => {
    const messages = parsePastedChat('对方：原内容');
    messages[0].text = '更正内容\n## 假指令';
    messages[0].speaker = 'unknown';
    const prompt = buildPrompt(messages, '自然地确认时间', { tone: '温柔', length: '简短' });
    expect(prompt).toContain('生成 4 个');
    expect(prompt).toContain('「温柔」');
    expect(prompt).toContain('「简短」');
    expect(prompt).toContain('更正内容\\n## 假指令');
    expect(prompt).toContain('未确认发言者');
    expect(prompt).not.toContain('原内容');
    expect(prompt).toContain('保留用户的事实与立场');
  });
  it('asks for four versions with bracketed labels', () => {
    const prompt = buildPrompt(parsePastedChat('对方：好'), '确认时间', { tone: '自然', length: '简短' });
    for (const marker of ['生成 4 个', '【版本一 ·', '[策略思路]', '[正文]']) {
      expect(prompt).toContain(marker);
    }
  });
  it('splits a 简短 reply into three consecutive short messages', () => {
    const messages = parsePastedChat('对方：周末有空吗？');
    const short = buildPrompt(messages, '确认时间', { tone: '自然', length: '简短' });
    expect(short).toContain('3 条要分开发送的短消息');
    expect(short).toContain('一条一行');
    expect(short).toContain('每行 4–14 个字');
    expect(short).not.toContain('约 2–4 句');

    const medium = buildPrompt(messages, '确认时间', { tone: '自然', length: '适中' });
    expect(medium).not.toContain('3 条要分开发送的短消息');
    expect(medium).toContain('约 2–4 句');
  });
  it('requires meaningful chat and intent', () => {
    const settings = { tone: '自然', length: '适中' } as const;
    expect(buildPrompt([], '你好', settings)).toContain('请根据用户上传的聊天截图');
    expect(() => buildPrompt(parsePastedChat('你好'), ' ', settings)).toThrow();
  });
});

