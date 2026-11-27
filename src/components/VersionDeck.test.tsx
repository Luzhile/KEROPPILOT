// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import VersionDeck from './VersionDeck';
import { parseVersions } from '../services/versions';

const copyPrompt = vi.hoisted(() => vi.fn());
vi.mock('../services/desktop', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/desktop')>();
  return { ...actual, copyPrompt };
});

const SAMPLE = `【版本一 · 顺着接话】
[策略思路] 先接住玩笑，再推进话题。
[正文] 哈哈哈你这就开始安排上了
那我先记着

【版本二 · 轻松推进】
[策略思路] 轻松把时间定下来。
[正文] 行啊
那周六下午？

【版本三 · 温柔回应】
[策略思路] 先接情绪再给安排。
[正文] 我看到啦
这周都可以

【版本四 · 直接确认】
[策略思路] 给结论和可执行时间。
[正文] 周六下午两点可以
定了我就过去`;

function click(deck: HTMLElement, x = 300) {
  fireEvent.pointerDown(deck, { clientX: x, pointerId: 1, pointerType: 'mouse' });
  fireEvent.pointerUp(deck, { clientX: x, pointerId: 1, pointerType: 'mouse' });
}

afterEach(() => {
  cleanup();
  copyPrompt.mockReset();
});

describe('reply versions', () => {
  it('splits the four versions and drops the old 评价 block', () => {
    const versions = parseVersions(`${SAMPLE}

【版本五 · 旧格式】
[策略思路] 兼容旧输出。
[正文] 正文在这里
[评价] 这句话不该出现在正文里`);

    expect(versions).toHaveLength(5);
    expect(versions[0]).toMatchObject({ label: '版本一', name: '顺着接话' });
    expect(versions[0].body).toBe('哈哈哈你这就开始安排上了\n那我先记着');
    expect(versions[4].body).toBe('正文在这里');
    expect(versions[4].body).not.toContain('评价');
  });

  it('falls back to a single card for unstructured text', () => {
    const versions = parseVersions('版本一：可以呀\n\n版本二：周六下午两点？');
    expect(versions).toHaveLength(1);
    expect(versions[0].body).toContain('可以呀');
  });

  it('advances on a click and goes back on a left drag', () => {
    render(<VersionDeck text={SAMPLE} />);
    const deck = screen.getByRole('group');
    expect(deck.getAttribute('aria-label')).toContain('版本 1 / 4');

    click(deck);
    expect(deck.getAttribute('aria-label')).toContain('版本 2 / 4');

    fireEvent.pointerDown(deck, { clientX: 400, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(deck, { clientX: 100, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(deck, { clientX: 100, pointerId: 1, pointerType: 'mouse' });
    expect(deck.getAttribute('aria-label')).toContain('版本 1 / 4');
  });

  it('loops from the last card back to the first, and backwards past the first', () => {
    render(<VersionDeck text={SAMPLE} />);
    const deck = screen.getByRole('group');

    for (let i = 0; i < 3; i += 1) click(deck);
    expect(deck.getAttribute('aria-label')).toContain('版本 4 / 4');

    click(deck);
    expect(deck.getAttribute('aria-label')).toContain('版本 1 / 4');

    fireEvent.keyDown(deck, { key: 'ArrowLeft' });
    expect(deck.getAttribute('aria-label')).toContain('版本 4 / 4');
  });

  it('does not advance when the pointer dragged to the right', () => {
    render(<VersionDeck text={SAMPLE} />);
    const deck = screen.getByRole('group');

    fireEvent.pointerDown(deck, { clientX: 100, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(deck, { clientX: 400, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(deck, { clientX: 400, pointerId: 1, pointerType: 'mouse' });
    expect(deck.getAttribute('aria-label')).toContain('版本 1 / 4');
  });

  it('copies the visible body without switching cards', async () => {
    copyPrompt.mockResolvedValue(undefined);
    render(<VersionDeck text={SAMPLE} />);
    const deck = screen.getByRole('group');

    fireEvent.click(screen.getByRole('button', { name: '复制版本一正文' }));
    await waitFor(() => expect(copyPrompt).toHaveBeenCalledTimes(1));
    expect(copyPrompt).toHaveBeenCalledWith('哈哈哈你这就开始安排上了\n那我先记着');
    expect(deck.getAttribute('aria-label')).toContain('版本 1 / 4');
  });

  it('flattens line breaks for 适中/详细 but keeps them for 简短', () => {
    const bodies = () => [...document.querySelectorAll('.deck-body')].map(el => el.textContent ?? '');

    const flat = render(<VersionDeck text={SAMPLE} singleLine />);
    expect(bodies()[0]).toContain('哈哈哈你这就开始安排上了 那我先记着');
    flat.unmount();

    render(<VersionDeck text={SAMPLE} />);
    expect(bodies()[0]).toContain('哈哈哈你这就开始安排上了\n那我先记着');
  });
});
