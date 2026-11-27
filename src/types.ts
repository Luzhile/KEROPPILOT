export type Speaker = 'self' | 'other' | 'unknown';
export interface Message {
  id: string;
  speaker: Speaker;
  speakerName?: string;
  timestamp?: string;
  text: string;
}
export const tones = ['自然', '温柔', '调皮', '正式', '暧昧'] as const;
export const lengths = ['简短', '适中', '详细'] as const;
export const REPLY_VERSION_COUNT = 4;
export interface ReplySettings {
  tone: (typeof tones)[number];
  length: (typeof lengths)[number];
}
export const emojiPreferences = ['不用', '少量', '适量'] as const;
export interface StyleProfile {
  catchphrase: string;
  emoji: (typeof emojiPreferences)[number];
  rules: string;
}
export interface StrategyParameters {
  directness: number;
  warmth: number;
  initiative: number;
  humor?: number;
}
