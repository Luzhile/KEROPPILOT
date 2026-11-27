import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const desktopAvailable = isTauri() || Boolean(window.keroppilotDesktop);
export async function setPinned(pinned: boolean) {
  if (window.keroppilotDesktop) return window.keroppilotDesktop.pin(pinned);
  if (desktopAvailable) await getCurrentWindow().setAlwaysOnTop(pinned);
}
export async function copyPrompt(text: string) {
  if (window.keroppilotDesktop) return window.keroppilotDesktop.copy(text);
  if (desktopAvailable) {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
    await writeText(text);
  } else await navigator.clipboard.writeText(text);
}
export async function openChatGpt() {
  if (window.keroppilotDesktop) return window.keroppilotDesktop.open('chatgpt');
  if (desktopAvailable) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl('https://chatgpt.com/');
  } else window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
}

export async function openDeepSeekPlatform() {
  if (window.keroppilotDesktop) return window.keroppilotDesktop.open('deepseek');
  if (desktopAvailable) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl('https://platform.deepseek.com/api_keys');
  } else window.open('https://platform.deepseek.com/api_keys', '_blank', 'noopener,noreferrer');
}
