import { invoke } from '@tauri-apps/api/core';
import { desktopAvailable } from './desktop';

const SESSION_KEY = 'chatpilot.deepseek.session.v1';

export type KeySource = 'file' | 'env' | 'session' | 'none';

export interface StoredApiKey {
  key: string;
  source: KeySource;
}

interface KeyPayload {
  key: string | null;
  source: string;
}

const sources: KeySource[] = ['file', 'env', 'session', 'none'];

function asSource(value: string | undefined): KeySource {
  return sources.includes(value as KeySource) ? (value as KeySource) : 'none';
}

export function normalizeApiKey(value: string): string {
  return value.replace(/\s+/g, '').slice(0, 512);
}

export function looksLikeApiKey(value: string): boolean {
  return /^sk-[A-Za-z0-9_-]{8,}$/.test(normalizeApiKey(value));
}

/** Shows just enough of the key to recognize it, never the whole secret. */
export function maskApiKey(value: string): string {
  const key = normalizeApiKey(value);
  if (!key) return '';
  if (key.length <= 10) return `${key.slice(0, 2)}••••`;
  return `${key.slice(0, 5)}…${key.slice(-4)}`;
}

export async function readApiKey(): Promise<StoredApiKey> {
  if (window.keroppilotDesktop) return window.keroppilotDesktop.readKey();
  if (desktopAvailable) {
    const payload = await invoke<KeyPayload>('read_api_key');
    return { key: payload.key ?? '', source: asSource(payload.source) };
  }
  try {
    const key = sessionStorage.getItem(SESSION_KEY) ?? '';
    return { key, source: key ? 'session' : 'none' };
  } catch {
    return { key: '', source: 'none' };
  }
}

export async function writeApiKey(value: string): Promise<StoredApiKey> {
  const key = normalizeApiKey(value);
  if (!key) throw new Error('API Key 不能为空。');
  if (window.keroppilotDesktop) return window.keroppilotDesktop.saveKey(key);
  if (desktopAvailable) {
    const payload = await invoke<KeyPayload>('save_api_key', { key });
    return { key: payload.key ?? key, source: asSource(payload.source) };
  }
  try {
    sessionStorage.setItem(SESSION_KEY, key);
    return { key, source: 'session' };
  } catch {
    throw new Error('浏览器未允许当前标签页保存密钥。请检查浏览器的站点存储设置。');
  }
}

export async function clearApiKey(): Promise<void> {
  if (window.keroppilotDesktop) return window.keroppilotDesktop.clearKey();
  if (desktopAvailable) {
    await invoke('delete_api_key');
    return;
  }
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing persisted in this mode.
  }
}
