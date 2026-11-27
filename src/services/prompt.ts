import type { Message } from '../types';
export { buildReplyPrompt as buildPrompt } from './prompts/reply';

export function parsePastedChat(text: string): Message[] {
  const normalized = text.replace(/\r\n?/g, '\n');
  const headers = [...normalized.matchAll(/^([^\n]+)\n[ \t]*(\d{4}年\d{1,2}月\d{1,2}日[ \t]+\d{1,2}:\d{2}(?::\d{2})?)[ \t]*(?:\n|$)/gm)];
  if (headers.length) {
    const prefix = normalized.slice(0, headers[0].index).trim();
    const messages = headers.map((header, index): Message => ({
      id: crypto.randomUUID(),
      speaker: 'unknown',
      speakerName: header[1].trim(),
      timestamp: header[2].trim(),
      text: normalized.slice(header.index! + header[0].length, headers[index + 1]?.index ?? normalized.length).trim(),
    }));
    return prefix ? [...parsePastedChat(prefix), ...messages] : messages;
  }
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line): Message => {
    const match = /^(我|自己|对方|朋友)[：:]\s*(.*)$/.exec(line);
    return {
      id: crypto.randomUUID(),
      speaker: match ? (['我', '自己'].includes(match[1]) ? 'self' : 'other') : 'unknown',
      text: match ? match[2] : line,
    };
  }).filter(message => message.text.trim());
}
