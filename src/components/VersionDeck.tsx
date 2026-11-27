import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Copy, CornerDownRight, Undo2 } from 'lucide-react';
import { copyPrompt } from '../services/desktop';
import { parseVersions, revisionOptions } from '../services/versions';
import { useReplyBranches, type BranchContext } from '../hooks/useReplyBranches';

interface Props {
  text: string;
  streaming?: boolean;
  /** 首张卡片（预览/测试用） */
  initialIndex?: number;
  /** 适中/详细：正文强制一整段，不保留换行 */
  singleLine?: boolean;
  branchContext?: BranchContext;
}

const BACK_THRESHOLD = 0.18;
const CLICK_SLOP = 8;
const MAX_SWING = 2;

/** 3D transform for a card sitting `d` versions away from the active one. */
function cardStyle(d: number) {
  const value = Math.max(-MAX_SWING, Math.min(MAX_SWING, d));
  const depth = Math.abs(value);
  const exited = value < 0;
  const x = exited ? value * 34 : value * 11;
  const z = -depth * (exited ? 190 : 130);
  const rotateY = value * -14;
  const scale = 1 - depth * 0.045;
  const opacity = exited ? Math.max(0, 1 + value * 0.92) : Math.max(0, 1 - value * 0.45);
  return {
    transform: `translate3d(${x}%, 0, ${z}px) rotateY(${rotateY}deg) scale(${scale})`,
    opacity,
    zIndex: 100 - Math.round(depth * 10),
    pointerEvents: value === 0 ? 'auto' : 'none',
  } as const;
}

/**
 * 四个回复版本做成一副卡牌：绿底黑字，中间一张。
 * 点卡片翻到下一张（第 4 张之后回到第 1 张），鼠标往左拖回退上一张，
 * 旧卡往左后方退场（3D + 缓动）。
 */
export default function VersionDeck({ text, streaming = false, initialIndex = 0, singleLine = false,
  branchContext }: Props) {
  const versions = parseVersions(text);
  const count = versions.length;
  const [cursor, setCursor] = useState(initialIndex);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(-1);
  const deck = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const moved = useRef(false);

  useEffect(() => {
    if (!count) setCursor(0);
  }, [count]);

  const active = count ? ((cursor % count) + count) % count : 0;
  const branches = useReplyBranches(branchContext && !streaming ? text : '');
  const activeVersion = (branchContext && !streaming ? branches.current(active) : undefined) ?? versions[active];
  const currentPath = branches.path(active);
  const step = (delta: number) => {
    if (count < 2) return;
    setCursor(current => current + delta);
  };
  const jump = (target: number) => {
    if (count < 2) return;
    let delta = ((target - active) % count + count) % count;
    if (delta > count / 2) delta -= count;
    setCursor(current => current + delta);
  };

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startX.current = event.clientX;
    moved.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = event.clientX - startX.current;
    if (Math.abs(dx) > CLICK_SLOP) moved.current = true;
    // 只有往左拖才回退；往右不跟手，避免和「点一下切换」打架
    const width = deck.current?.clientWidth || 1;
    setDrag(Math.max(-1, Math.min(0, dx / width)));
  }

  function endDrag() {
    if (!dragging) return;
    setDragging(false);
    if (drag < -BACK_THRESHOLD) step(-1);
    else if (!moved.current) step(1);
    setDrag(0);
  }

  async function copy(version: string, i: number) {
    try {
      await copyPrompt(version);
      setCopied(i);
      window.setTimeout(() => setCopied(current => (current === i ? -1 : current)), 1600);
    } catch {
      setCopied(-1);
    }
  }

  /** 循环取位：第 4 张的下一位是第 1 张，位移用取模保持连续，动画不会跳。 */
  const position = cursor + drag;
  const offset = (i: number) => {
    if (!count) return 0;
    const raw = (((i - position) % count) + count) % count;
    return raw > count / 2 ? raw - count : raw;
  };

  return (
    <div className="deck-wrap">
      <div
        className={`deck ${dragging ? 'is-dragging' : ''}`}
        ref={deck}
        role="group"
        aria-roledescription="回复版本卡片"
        aria-label={`回复版本 ${active + 1} / ${count}，点一下看下一版`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={event => {
          if (event.currentTarget !== event.target) return;
          if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            step(1);
          }
          if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
        }}
      >
        <div className="deck-stage">
          {versions.map((version, i) => {
            const displayed = (branchContext && !streaming ? branches.current(i) : undefined) ?? version;
            const body = singleLine ? displayed.body.replace(/\s*\n+\s*/g, ' ').trim() : displayed.body;
            const strategy = singleLine ? displayed.strategy.replace(/\s*\n+\s*/g, ' ').trim() : displayed.strategy;
            return (
              <article className="deck-card" key={`${version.raw}-${i}`} style={cardStyle(offset(i))}
                aria-hidden={i !== active}>
                <header className="deck-card-head">
                  <span className="deck-badge">{version.label || `版本 ${i + 1}`}</span>
                  {version.name && <strong className="deck-name">{version.name}</strong>}
                  <button type="button" className="deck-copy" aria-label={`复制${version.label || `版本 ${i + 1}`}正文`}
                    onPointerDown={event => event.stopPropagation()}
                    tabIndex={i === active ? 0 : -1}
                    onClick={event => { event.stopPropagation(); void copy(body, i); }}>
                    {copied === i ? <Check size={13} strokeWidth={3} /> : <Copy size={13} strokeWidth={2.4} />}
                  </button>
                </header>
                {strategy && <p className="deck-strategy">{strategy}</p>}
                <p className="deck-body">
                  {body || strategy || version.raw}
                  {streaming && i === versions.length - 1 && <span className="deck-caret" aria-hidden="true" />}
                </p>
              </article>
            );
          })}
        </div>
      </div>

      {count > 1 && (
        <div className="deck-dots" aria-hidden="true">
          {versions.map((version, i) => (
            <button key={version.raw || i} type="button" tabIndex={-1}
              className={`deck-dot ${i === active ? 'is-active' : ''}`}
              aria-label={`第 ${i + 1} 个版本`}
              onClick={() => jump(i)} />
          ))}
          <span className="deck-count">{active + 1} / {count}</span>
        </div>
      )}
      {branchContext && !streaming && activeVersion && (activeVersion.body || activeVersion.strategy) && (
        <div className="reply-branches" role="group" aria-label="修改建议">
          {currentPath.length > 0 && (
            <div className="reply-branch-path">
              <button type="button" onClick={() => branches.back(active)} disabled={branches.pending}>
                <Undo2 size={13} aria-hidden="true" />
                {currentPath.length === 1 ? '返回原稿' : '返回上一版'}
              </button>
              <span>{currentPath.at(-1)}</span>
            </div>
          )}
          <div className="reply-branch-options">
            {revisionOptions(activeVersion).map(direction => (
              <button key={direction} type="button" title={direction} disabled={branches.pending}
                onClick={() => void branches.revise(active, activeVersion, direction, branchContext, singleLine)}>
                <CornerDownRight size={13} aria-hidden="true" />
                <span>{direction}</span>
              </button>
            ))}
          </div>
          {branches.pending && <p className="reply-branch-status" role="status">正在改写…</p>}
          {branches.error && <p className="reply-branch-status" role="alert">{branches.error}</p>}
        </div>
      )}
    </div>
  );
}
