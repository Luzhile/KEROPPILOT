import { useEffect, useRef, useState } from 'react';
import {
  DeepSeekError,
  generateReply,
  type DeepSeekErrorCode,
  type DeepSeekModel,
  type TokenUsage,
} from '../services/deepseek';
import { describeError } from '../services/errors';

export type GenerationStatus = 'idle' | 'streaming' | 'done' | 'error' | 'aborted';

export interface GenerationViewState {
  status: GenerationStatus;
  text: string;
  error: string;
  errorCode?: DeepSeekErrorCode;
  thinking: boolean;
  usage?: TokenUsage;
  durationMs: number;
}

const initialState: GenerationViewState = {
  status: 'idle',
  text: '',
  error: '',
  thinking: false,
  durationMs: 0,
};

export function useGeneration() {
  const [state, setState] = useState<GenerationViewState>(initialState);
  const controller = useRef<AbortController | null>(null);
  const startedAt = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  async function run(
    apiKey: string,
    model: DeepSeekModel,
    prompt: string,
    options: { preserve?: boolean } = {},
  ) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    startedAt.current = performance.now();
    setState(previous => (
      options.preserve && previous.text.trim()
        ? {
          ...previous,
          status: 'streaming',
          error: '',
          errorCode: undefined,
          thinking: false,
          usage: undefined,
          durationMs: 0,
        }
        : { ...initialState, status: 'streaming' }
    ));

    try {
      const result = await generateReply({
        apiKey,
        model,
        prompt,
        signal: current.signal,
        onText: text => {
          if (!mounted.current || controller.current !== current || current.signal.aborted) return;
          setState(snapshot => (snapshot.status === 'streaming' ? { ...snapshot, text, thinking: false } : snapshot));
        },
        onReasoning: () => {
          if (!mounted.current || controller.current !== current || current.signal.aborted) return;
          setState(snapshot => (snapshot.status === 'streaming' ? { ...snapshot, thinking: true } : snapshot));
        },
      });
      if (!mounted.current || controller.current !== current || current.signal.aborted) return;
      setState({
        status: 'done',
        text: result.text,
        error: '',
        thinking: false,
        usage: result.usage,
        durationMs: Math.round(performance.now() - startedAt.current),
      });
      return result;
    } catch (cause) {
      if (!mounted.current || controller.current !== current) return;
      const aborted = cause instanceof DeepSeekError ? cause.code === 'aborted' : current.signal.aborted;
      setState(previous => ({
        ...previous,
        status: aborted ? 'aborted' : 'error',
        thinking: false,
        error: aborted ? '' : describeError(cause),
        errorCode: cause instanceof DeepSeekError ? cause.code : undefined,
        durationMs: Math.round(performance.now() - startedAt.current),
      }));
    } finally {
      if (controller.current === current) controller.current = null;
    }
  }

  function stop() {
    controller.current?.abort();
  }

  function reset() {
    const active = controller.current;
    controller.current = null;
    active?.abort();
    setState(initialState);
  }

  return { state, run, stop, reset };
}
