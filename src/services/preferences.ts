import { emojiPreferences, type StyleProfile } from '../types';

export const PROFILE_KEY = 'chatpilot.style.v1';
export const defaultProfile: StyleProfile = {
  catchphrase: '', emoji: '少量', rules: '',
};

// Whitelist fields so unrelated data can never enter the persisted profile.
export function normalizeProfile(value: unknown): StyleProfile {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    catchphrase: typeof data.catchphrase === 'string' ? data.catchphrase.slice(0, 60) : '',
    emoji: emojiPreferences.includes(data.emoji as StyleProfile['emoji']) ? data.emoji as StyleProfile['emoji'] : defaultProfile.emoji,
    rules: typeof data.rules === 'string' ? data.rules.slice(0, 2000) : '',
  };
}

export function loadProfile(storage: Pick<Storage, 'getItem'>): StyleProfile {
  const raw = storage.getItem(PROFILE_KEY);
  return normalizeProfile(raw ? JSON.parse(raw) : null);
}

export function saveProfile(storage: Pick<Storage, 'setItem'>, profile: StyleProfile): void {
  storage.setItem(PROFILE_KEY, JSON.stringify(normalizeProfile(profile)));
}
