import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL } from './deepseek';
import { loadModel, MODEL_KEY, normalizeModel, saveModel } from './modelSettings';

function memoryStorage(initial: Record<string, string> = {}) {
  const records = new Map(Object.entries(initial));
  return {
    records,
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { records.set(key, value); },
  };
}

describe('model preference', () => {
  it('accepts only known model ids', () => {
    expect(normalizeModel('deepseek-reasoner')).toBe('deepseek-reasoner');
    expect(normalizeModel('gpt-4')).toBe(DEFAULT_MODEL);
    expect(normalizeModel(undefined)).toBe(DEFAULT_MODEL);
  });

  it('roundtrips and recovers from corrupt storage', () => {
    const storage = memoryStorage();
    saveModel(storage, 'deepseek-reasoner');
    expect(loadModel(storage)).toBe('deepseek-reasoner');
    expect([...storage.records.keys()]).toEqual([MODEL_KEY]);

    const corrupt = memoryStorage({ [MODEL_KEY]: '{oops' });
    expect(loadModel(corrupt)).toBe(DEFAULT_MODEL);
    expect(loadModel(memoryStorage({ [MODEL_KEY]: '{"model":"unknown"}' }))).toBe(DEFAULT_MODEL);
  });
});
