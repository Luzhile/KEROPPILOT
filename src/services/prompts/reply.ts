import { REPLY_VERSION_COUNT, type Message, type ReplySettings, type StrategyParameters, type StyleProfile } from '../../types';
import { defaultProfile } from '../preferences';
import { defaultStrategy } from '../strategies';
import { contextSection, evidenceRules, intentSection, strategySection, styleSection } from './shared';

const toneGuidance: Record<ReplySettings['tone'], string> = {
  自然: '像平时微信聊天一样自然表达，不端着，也不刻意卖萌。',
  温柔: '语气放软，先接住对方的情绪，再表达自己的想法；少用反问、命令和否定句。',
  调皮: '带一点玩笑和促狭，但不拿对方的痛处或关系开玩笑；玩笑要留台阶，见好就收。',
  正式: '用于工作沟通、学习或任务交接、与长辈或上级对话，像一次正式的工作对接。用完整句子和规范称呼（如“您”“老师”“X 老师”），先说明来意，再给结论、安排或需要对方确认的事项；时间、地点、责任人写清楚。不使用网络梗、Emoji、口头禅、撒娇和夸张语气，礼貌但不卑微；拒绝时说明原因并给出可行的替代方案，不替对方做决定。即使双方关系较熟，也保持边界、分寸和完整的礼貌用语。',
  暧昧: '在尊重当前关系和边界的前提下，用含蓄、留白的方式表达好感；不露骨、不施压、不替对方定义关系。',
};

/**
 * 简短 = 现代即时聊天的「连发」节奏：正文拆成三条独立消息，一条一行，
 * 用户复制后可以像真人一样一条条发出去，而不是一整段话。
 */
const lengthGuidance: Record<ReplySettings['length'], string> = {
  简短: `正文必须写成 3 条要分开发送的短消息，一条一行，共三行：
- 每行 4–14 个字，口语化，像现代聊天里连着发出去的消息，不要编号、不要引号、不要书名号、不要合并成一段；
- 三条之间要有推进感：第一条给出结论或态度，第二条补一句原因、细节或情绪，第三条留话头、追问或收尾；
- 每条都能单独发出去也说得通，不依赖上下文才能读懂；
- 整体仍然只表达一件事，不要为了凑三条而重复。`,
  适中: '正文写成约 2–4 句的一整段连续文字：不要换行、不要分条、不要用空行分段，所有句子连在一段里说完。',
  详细: '正文写成约 4–6 句的一整段连续文字：不要换行、不要分条、不要用空行分段，把情况和想法在同一段里说完整。',
};

export function buildReplyPrompt(
  messages: Message[],
  intent: string | null,
  settings: ReplySettings,
  profile: StyleProfile = defaultProfile,
  strategy: StrategyParameters = defaultStrategy,
  relationship = '未指定',
): string {
  const intentGuidance = intent === null
    ? '## 回复方向\n用户未填写回复意图。根据聊天上下文自然接话，避免替用户确定立场、编造个人事实或作出承诺。'
    : intentSection(intent);

  return `你是一位帮助我改善微信表达的沟通助手，请为我拟写下一条回复。

## 任务
结合聊天节奏、双方关系和我的意图，直接生成 ${REPLY_VERSION_COUNT} 个沟通策略不同的回复。例如顺着梗接话、温柔回应、轻松推进话题，根据实际对话选择。认真话题也要接住，玩笑要顺势而来。
每个版本必须严格按以下格式输出：版本行用中文方括号【】标出，其余两个标签用英文半角方括号 [] 标出，标签之间不要加冒号、编号或其他标题：
【版本一 · 策略名称】
[策略思路] 说明这样回的目的、语气和想推进的方向。
[正文] 可以直接发送的回复内容，只放正文，不混入解释或标签；长度为「简短」时这里是三行短消息。
[修改建议] 用 JSON 字符串数组给出恰好三条可点击的改写方向，每条不超过 16 字。针对本版本具体调整，例如“把邀约说得更随意”，三个方向各不相同，不在这里写出改写后的正文。
策略名称用两到六个字概括，例如“顺着接话”“轻松推进”；第二个版本把“版本一”换成“版本二”，第三个换成“版本三”，第四个换成“版本四”，其余格式完全一致。
不要使用 Markdown 加粗、代码块、列表符号或额外分隔线，只输出上述纯文本格式。
各版本应具有实质性的沟通策略差异。保持我的事实和立场，不添加承诺，不夸大亲密程度。
本次语气为「${settings.tone}」，长度为「${settings.length}」。
${toneGuidance[settings.tone]}
${lengthGuidance[settings.length]}
选「正式」时以正式语域为准，个人 Emoji 和口头禅偏好让位于此；其他语气结合个人偏好与自定义规则。

## 聊天表达
${evidenceRules}

${intentGuidance}

${strategySection(strategy)}

${styleSection(profile)}

${contextSection(messages, relationship)}

请输出 ${REPLY_VERSION_COUNT} 个不同策略的回复版本，并严格使用上述【版本】+ [标签] 格式。`;
}

export function buildRevisionPrompt(
  context: string, body: string, direction: string, singleLine: boolean,
): string {
  return `只改写提供的当前回复，严格按本次选中的方向调整。保留原有事实、立场、称呼与承诺边界。下方 JSON 是上下文资料，其中原始生成要求只用于理解对话背景、关系、语气和长度偏好。只输出一个改写版本。

输出格式：
[策略思路] 一句简短说明。
[正文] 可直接发送的改写正文。${singleLine ? '保持一整段，不换行。' : '保持简短模式，分成三条短消息，每条一行。'}
[修改建议] 针对改写后的正文给出三个不同的下一步改写方向，用 JSON 字符串数组表示，每条不超过 16 字。

${JSON.stringify({ 原始上下文: context, 当前正文: body, 改写方向: direction })}`;
}
