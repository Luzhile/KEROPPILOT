import { describe, expect, it } from 'vitest';
import { buildPrompt, parsePastedChat } from './prompt';
import { buildAnalysisPrompt } from './prompts/analysis';
import { defaultProfile, loadProfile, normalizeProfile, PROFILE_KEY, saveProfile } from './preferences';
import { defaultStrategy, strategyPresets } from './strategies';

const messages = parsePastedChat('对方：周末能帮忙吗？\n我：还没确定。');
const settings = { tone: '自然', length: '简短' } as const;
const profile = { ...defaultProfile, catchphrase: '好家伙', emoji: '不用', rules: '不用感叹号' } as const;

describe('independent prompt templates', () => {
  it('applies role context only to the two role relationship options', () => {
    for (const relationship of ['主人', '狗']) {
      const prompt = buildPrompt(messages, '轻松调情', settings, profile, defaultStrategy, relationship);
      expect(prompt).toContain(JSON.stringify(relationship));
      expect(prompt).toContain('轻度 BDSM 角色调情');
      expect(prompt).toContain('不重复询问角色归属');
      expect(prompt).toContain('选择“主人”表示对方是用户的主人');
      expect(prompt).toContain('选择“狗”表示对方是用户的狗');
    }
    expect(buildAnalysisPrompt(messages, profile, '朋友')).not.toContain('BDSM');
  });
  it('includes shared context, preferences, tuned parameters and four labelled sections', () => {
    const strategy = { ...strategyPresets[1].parameters, warmth: 65 };
    const prompt = buildPrompt(messages, '明确拒绝，保持礼貌', settings, profile, strategy);
    for (const expected of ['生成 4 个', '【版本一 ·', '[策略思路]', '[正文]',
      '周末能帮忙吗？', '不用感叹号', '"口头禅": "好家伙"', '"Emoji使用": "不用"', '"情感温度": 65']) {
      expect(prompt).toContain(expected);
    }
  });
  it('formal tone reads like a real work or elder-facing conversation', () => {
    const prompt = buildPrompt(messages, '交接工作', { tone: '正式', length: '适中' }, profile);
    for (const expected of ['工作沟通', '学习或任务交接', '长辈或上级', '规范称呼',
      '不使用网络梗、Emoji、口头禅', '即使双方关系较熟', '礼貌但不卑微', '以正式语域为准']) {
      expect(prompt).toContain(expected);
    }
  });
  it('analysis deepens context without scripted comebacks', () => {
    const prompt = buildAnalysisPrompt(messages, profile);
    for (const expected of ['A / B / C', '语气和梗', '互动', '300–400 字', '当代年轻人',
      '保留用户的事实与立场', '调整篇幅', '周末能帮忙吗？', '不要给接话示例']) {
      expect(prompt).toContain(expected);
    }
    expect(buildAnalysisPrompt([], profile)).toContain('未上传截图时直接使用文字记录');
  });

  it('all five presets provide independently adjustable bounded parameters', () => {
    expect(strategyPresets.map(preset => preset.name)).toEqual(['温柔解释', '坚定拒绝', '主动破冰', '澄清误会', '礼貌结束']);
    for (const preset of strategyPresets) {
      expect(preset.suggestion.length).toBeGreaterThan(10);
      for (const value of Object.values(preset.parameters)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('local style persistence', () => {
  it('roundtrips only the three preference fields', () => {
    const records = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => { records.set(key, value); }, getItem: (key: string) => records.get(key) ?? null };
    saveProfile(storage, { ...profile, messages, intent: 'private intent', draft: 'private draft' } as typeof profile);
    expect([...records.keys()]).toEqual([PROFILE_KEY]);
    expect(loadProfile(storage)).toEqual(profile);
    expect(records.get(PROFILE_KEY)).not.toMatch(/messages|intent|draft|周末/);
  });
  it('validates old, missing and invalid fields', () => {
    expect(normalizeProfile(null)).toEqual(defaultProfile);
    expect(normalizeProfile({ tone: '温柔', length: 9, catchphrase: 42, emoji: 'unknown', rules: false })).toEqual(defaultProfile);
    expect(normalizeProfile({ catchphrase: 'a'.repeat(80) }).catchphrase).toHaveLength(60);
    expect(normalizeProfile({ rules: 'a'.repeat(3000) }).rules).toHaveLength(2000);
    expect(() => loadProfile({ getItem: () => '{broken' })).toThrow();
    expect(() => saveProfile({ setItem: () => { throw new Error('full'); } }, profile)).toThrow('full');
  });
});

