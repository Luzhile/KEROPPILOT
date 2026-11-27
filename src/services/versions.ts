export interface ReplyVersion {
  /** e.g. "版本一 · 顺着接话" */
  raw: string;
  /** e.g. "版本一" */
  label: string;
  /** e.g. "顺着接话" */
  name: string;
  /** 策略思路 */
  strategy: string;
  /** 正文，可能多行（简短模式是三条短消息） */
  body: string;
  suggestions?: string[];
}

const HEADER = /【([^】]{1,40})】/g;
const TAG = /[[【](策略思路|正文|修改建议|评价)[\]】]/g;

const defaultSuggestions = ['表达更自然', '措辞更简练', '语气更柔和'];

export function revisionOptions(version: ReplyVersion): string[] {
  const options = [...new Set([...(version.suggestions ?? []), ...defaultSuggestions])];
  return options.slice(0, 3);
}

function parseSuggestions(text: string | undefined): string[] {
  if (!text) return [];
  try {
    const values: unknown = JSON.parse(text);
    if (!Array.isArray(values)) return [];
    return values.flatMap(value => typeof value === 'string' && value.trim() && value.trim().length <= 28
      ? [value.trim()]
      : []);
  } catch {
    return [];
  }
}

function sections(chunk: string): Record<string, string> {
  const out: Record<string, string> = {};
  const marks = [...chunk.matchAll(TAG)];
  marks.forEach((mark, i) => {
    const start = mark.index! + mark[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : chunk.length;
    out[mark[1]] = chunk.slice(start, end).trim();
  });
  return out;
}

/**
 * 把模型输出拆成四个版本卡片。容忍两种写法：【版本一 · 策略】…[正文]…
 * 以及没写标签的纯文本（此时整段作为单张卡）。旧格式里的 [评价] 会被丢弃。
 */
export function parseVersions(text: string): ReplyVersion[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const heads = [...trimmed.matchAll(HEADER)]
    .filter(mark => /版\s*本/.test(mark[1]))
    .map(mark => ({ text: mark[0], title: mark[1].trim(), index: mark.index! }));

  if (!heads.length) {
    const parts = sections(trimmed);
    return [{ raw: '', label: '', name: '', strategy: parts['策略思路'] ?? '',
      body: parts['正文'] ?? trimmed.split(/[[【]修改建议[\]】]/, 1)[0].trim(),
      suggestions: parseSuggestions(parts['修改建议']) }];
  }

  return heads.map((head, i) => {
    const start = head.index + head.text.length;
    const end = i + 1 < heads.length ? heads[i + 1].index : trimmed.length;
    const parts = sections(trimmed.slice(start, end));
    const [label = '', name = ''] = head.title.split('·').map(part => part.trim());
    return {
      raw: head.title,
      label,
      name,
      strategy: parts['策略思路'] ?? '',
      body: parts['正文'] ?? '',
      suggestions: parseSuggestions(parts['修改建议']),
    };
  });
}
