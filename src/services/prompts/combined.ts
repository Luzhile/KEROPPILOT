import type { Message, ReplySettings, StrategyParameters, StyleProfile } from '../../types';
import { buildAnalysisPrompt } from './analysis';
import { buildReplyPrompt } from './reply';

export function buildCombinedPrompt(
  messages: Message[], intent: string, settings: ReplySettings,
  profile: StyleProfile, strategy: StrategyParameters,
  relationship = '未指定',
): string {
  return `请根据用户上传的聊天截图（如有）和粘贴的聊天记录，依次完成以下两部分任务。未上传截图时使用文字记录。
先完成「对话分析」，再基于分析完成「策略实验台」。两部分都必须输出，结合双方关系、聊天语气和我的回复意图。

# 第一部分 · 对话分析
${buildAnalysisPrompt(messages, profile, relationship)}

# 第二部分 · 策略实验台
${buildReplyPrompt(messages, intent, settings, profile, strategy, relationship)}`;
}

