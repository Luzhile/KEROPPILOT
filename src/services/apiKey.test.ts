// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./desktop', () => ({ desktopAvailable: false }));

import {
  clearApiKey,
  looksLikeApiKey,
  maskApiKey,
  normalizeApiKey,
  readApiKey,
  writeApiKey,
} from './apiKey';

beforeEach(() => {
  sessionStorage.clear();
});

describe('api key formatting', () => {
  it('strips whitespace and caps the length', () => {
    expect(normalizeApiKey(' sk-abc def \n')).toBe('sk-abcdef');
    expect(normalizeApiKey('a'.repeat(600))).toHaveLength(512);
  });

  it('recognizes official keys without blocking other formats', () => {
    expect(looksLikeApiKey('sk-1234567890abcdef')).toBe(true);
    expect(looksLikeApiKey('proxy-token-123')).toBe(false);
    expect(normalizeApiKey('proxy-token-123')).toBe('proxy-token-123');
  });

  it('masks keys for display and never reveals the whole secret', () => {
    expect(maskApiKey('sk-1234567890abcdef')).toBe('sk-12…cdef');
    expect(maskApiKey('short')).toBe('sh••••');
    expect(maskApiKey('')).toBe('');
  });
});

describe('browser preview storage', () => {
  it('keeps the key only for the current session', async () => {
    expect(await readApiKey()).toEqual({ key: '', source: 'none' });
    expect(await writeApiKey(' sk-1234567890abcdef ')).toEqual({
      key: 'sk-1234567890abcdef',
      source: 'session',
    });
    expect(await readApiKey()).toEqual({ key: 'sk-1234567890abcdef', source: 'session' });
    await clearApiKey();
    expect(await readApiKey()).toEqual({ key: '', source: 'none' });
  });

  it('rejects empty keys', async () => {
    await expect(writeApiKey('   ')).rejects.toThrow('API Key 不能为空');
  });
});
