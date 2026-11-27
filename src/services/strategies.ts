import type { StrategyParameters } from '../types';

export const defaultStrategy = { directness: 50, warmth: 60, initiative: 50, humor: 50 } satisfies StrategyParameters;
export const strategyAxes = [
  { key: 'directness', label: '直接程度', low: '委婉', high: '直接' },
  { key: 'warmth', label: '情感温度', low: '克制', high: '温暖' },
  { key: 'initiative', label: '主动程度', low: '留出空间', high: '主动推进' },
  { key: 'humor', label: '幽默程度', low: '平实', high: '俏皮' },
] as const;

export interface StrategyPreset {
  name: string;
  parameters: StrategyParameters;
  suggestion: string;
}

export const strategyPresets: StrategyPreset[] = [
  {
    name: '温柔解释',
    parameters: { directness: 45, warmth: 85, initiative: 55 },
    suggestion: '我想温和地解释真实情况，回应对方的疑问，并清楚表达自己的想法。具体情况是：',
  },
  {
    name: '坚定拒绝',
    parameters: { directness: 90, warmth: 40, initiative: 25 },
    suggestion: '我想清楚地拒绝这个请求，尊重对方，同时保持自己的边界。我的立场是：',
  },
  {
    name: '主动破冰',
    parameters: { directness: 55, warmth: 75, initiative: 90 },
    suggestion: '我想自然地开启话题，让对方容易接话，也给对方选择是否回应的空间。可以聊的是：',
  },
  {
    name: '澄清误会',
    parameters: { directness: 75, warmth: 65, initiative: 70 },
    suggestion: '我想澄清表达中的误会，区分事实和理解差异，说明我的本意。需要澄清的是：',
  },
  {
    name: '礼貌结束',
    parameters: { directness: 70, warmth: 55, initiative: 15 },
    suggestion: '我想礼貌地结束这轮聊天，表达清楚，避免增加无法兑现的约定。结束原因或边界是：',
  },
];
