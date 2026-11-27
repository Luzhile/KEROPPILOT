import { useEffect, useRef } from 'react';
import type { DeepSeekModel } from '../services/deepseek';
import { useGeneration } from '../hooks/useGeneration';
import type { BranchContext } from '../hooks/useReplyBranches';
import FrogMark from './FrogMark';
import VersionDeck from './VersionDeck';

interface Props {
  title: string;
  prompt: string;
  ready: boolean;
  apiKey: string;
  model: DeepSeekModel;
  emptyText: string;
  /** 适中/详细：正文按一整段渲染，不保留换行 */
  singleLine?: boolean;
  /** Visible card heading; omit when the console sits inside another card. */
  heading?: string;
  /** Regenerate automatically when the prompt changes (debounced). */
  auto?: boolean;
  autoDelayMs?: number;
  autoInput?: string;
  manualRequest?: number;
  revisions?: boolean;
  /** Render inside the surrounding panel instead of as its own card. */
  embedded?: boolean;
}

export default function ReplyConsole({
  title, prompt, ready, apiKey, model, emptyText, heading, singleLine = false, auto = false, embedded = false,
  autoDelayMs = 800, autoInput, manualRequest = 0, revisions = false,
}: Props) {
  const { state, run } = useGeneration();
  const outputRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const runRef = useRef(run);
  const handledRequest = useRef(0);
  const generatedFrom = useRef<BranchContext | undefined>(undefined);
  runRef.current = run;

  const streaming = state.status === 'streaming';
  const canGenerate = ready && Boolean(apiKey) && Boolean(prompt.trim());

  useEffect(() => {
    const output = outputRef.current;
    if (output && stickToBottom.current) output.scrollTop = output.scrollHeight;
  }, [state.text]);

  useEffect(() => {
    if (state.status === 'streaming') stickToBottom.current = true;
  }, [state.status]);

  useEffect(() => {
    if (!canGenerate) return;
    const generate = () => {
      generatedFrom.current = revisions ? { apiKey, model, prompt } : undefined;
      void runRef.current(apiKey, model, prompt, { preserve: true });
    };
    if (manualRequest !== handledRequest.current) {
      handledRequest.current = manualRequest;
      generate();
      return;
    }
    if (!auto) return;
    const timer = window.setTimeout(generate, autoDelayMs);
    return () => window.clearTimeout(timer);
  }, [auto, autoDelayMs, autoInput, canGenerate, prompt, apiKey, model, manualRequest, revisions]);

  const placeholder = streaming ? (state.thinking ? '模型正在推理…' : '正在生成…') : emptyText;

  return (
    <section className={embedded ? 'console-embedded' : 'card card-dark console-card'} aria-label={title}>
      {heading && (
        <div className="card-head">
          <FrogMark size={42} className="head-frog" />
          <h2>{heading}</h2>
        </div>
      )}
      <div className={`console-output ${state.text ? 'has-deck' : ''}`} ref={outputRef}
        aria-label={`${title}内容`} tabIndex={0}
        onScroll={() => {
          const output = outputRef.current;
          if (!output) return;
          stickToBottom.current = output.scrollHeight - output.scrollTop - output.clientHeight < 48;
        }}>
        {state.text
          ? <VersionDeck text={state.text} streaming={streaming} singleLine={singleLine}
              branchContext={apiKey && state.status === 'done' && generatedFrom.current
                ? { ...generatedFrom.current, apiKey }
                : undefined} />
          : (
            <div className="console-empty">
              {!streaming && (
                <div className="frog-carousel" aria-hidden="true">
                  <FrogMark size={54} pose="phone" />
                </div>
              )}
              <p className="console-placeholder">{placeholder}</p>
            </div>
          )}
      </div>

      {state.error && (
        <p role="alert" className="feedback error">
          <FrogMark variant="annoyed" size={24} className="error-frog" />
          <span>{state.error}</span>
        </p>
      )}
    </section>
  );
}
