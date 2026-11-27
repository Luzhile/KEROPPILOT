import type { Message, StyleProfile } from '../../types';
import { contextSection, evidenceRules, styleSection } from './shared';

export function buildAnalysisPrompt(messages: Message[], profile: StyleProfile, relationship = '未指定'): string {
  return `像一位懂我、会聊天的朋友，帮我读懂这段微信对话里的意思和情绪。

## 解读方式
先用两三句话说说整段对话的氛围、对方最想传达的意思和眼下关系的温度，然后展开 A / B / C 三种不同角度的解读。
每种解读约 300–400 字，围绕具体的话分层展开：字面在说什么、潜台词是什么、对方当下的情绪需求、我在关系里的位置，以及对方期待怎样的互动、语气和梗落在哪里。
结合当代年轻人的聊天语境理解梗、反话、口是心非、试探、玩笑边界、松弛感和情绪温度；只在对话有依据时使用，不硬套网络热词，也不做心理诊断或人格标签。
用连贯的日常语言讲述，适量引用原话，让解读具体、有画面感。结合已选关系理解调侃、撒娇、关心、认真表达和话题推进，优先说最贴合上下文的理解。
不要给接话示例、话术或建议，只做解读，把篇幅留给分析本身。根据聊天信息量调整篇幅，短对话也可以简洁一点。

## 聊天表达
${evidenceRules}

${styleSection(profile)}

${contextSection(messages, relationship)}`;
}
