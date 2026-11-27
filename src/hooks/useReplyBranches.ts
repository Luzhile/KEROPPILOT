import { useEffect, useRef, useState } from 'react';
import type { DeepSeekModel } from '../services/deepseek';
import { buildRevisionPrompt } from '../services/prompts/reply';
import { parseVersions, type ReplyVersion } from '../services/versions';
import { useGeneration } from './useGeneration';

export interface BranchContext {
  apiKey: string;
  model: DeepSeekModel;
  prompt: string;
}

export function useReplyBranches(source: string) {
  const generation = useGeneration();
  const reset = useRef(generation.reset);
  reset.current = generation.reset;
  const request = useRef<symbol | null>(null);
  const [selected, setSelected] = useState<Record<number, string[]>>({});
  const [revisions, setRevisions] = useState<Record<string, ReplyVersion>>({});
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    request.current = null;
    reset.current();
    setSelected({});
    setRevisions({});
    setInvalid(false);
  }, [source]);

  const path = (index: number) => selected[index] ?? [];
  const key = (index: number, steps: string[]) => JSON.stringify([index, ...steps]);
  const current = (index: number) => revisions[key(index, path(index))];
  const select = (index: number, steps: string[]) => {
    setSelected(previous => ({ ...previous, [index]: steps }));
  };

  async function revise(index: number, version: ReplyVersion, direction: string,
    context: BranchContext, singleLine: boolean) {
    if (request.current) return;
    const next = [...path(index), direction];
    const nextKey = key(index, next);
    setInvalid(false);
    if (revisions[nextKey]) {
      reset.current();
      select(index, next);
      return;
    }

    const token = Symbol();
    request.current = token;
    try {
      const result = await generation.run(context.apiKey, context.model,
        buildRevisionPrompt(context.prompt, version.body || version.strategy, direction, singleLine));
      if (!result || request.current !== token) return;
      const revision = parseVersions(result.text)[0];
      if (!revision?.body.trim()) {
        setInvalid(true);
        return;
      }
      setRevisions(previous => ({ ...previous, [nextKey]: revision }));
      select(index, next);
    } finally {
      if (request.current === token) request.current = null;
    }
  }

  return {
    current, path, revise,
    back: (index: number) => {
      reset.current();
      setInvalid(false);
      select(index, path(index).slice(0, -1));
    },
    pending: generation.state.status === 'streaming',
    error: generation.state.error || (invalid ? '这次没有生成可用的改写，请重试。' : ''),
  };
}
