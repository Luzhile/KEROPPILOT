import { useState } from 'react';
import type { StyleProfile } from '../types';
import { defaultProfile, loadProfile, saveProfile } from '../services/preferences';

function readInitialProfile() {
  try {
    return { profile: loadProfile(window.localStorage), status: '' };
  } catch {
    return { profile: { ...defaultProfile }, status: '本地偏好读取失败，已使用默认值。修改后将重新尝试保存。' };
  }
}

export function useStyleProfile() {
  const [state, setState] = useState(readInitialProfile);

  function updateProfile(profile: StyleProfile) {
    let status = '表达偏好已保存到本机。';
    try {
      saveProfile(window.localStorage, profile);
    } catch {
      status = '保存失败，当前偏好仅在本次窗口中有效。请检查本地存储空间与权限。';
    }
    setState({ profile, status });
  }

  return { ...state, updateProfile };
}
