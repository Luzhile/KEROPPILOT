import { useEffect, useState } from 'react';
import { clearApiKey, readApiKey, writeApiKey, type KeySource } from '../services/apiKey';
import type { DeepSeekModel } from '../services/deepseek';
import { describeError } from '../services/errors';
import { loadModel, saveModel } from '../services/modelSettings';

export interface DeepSeekConfig {
  apiKey: string;
  source: KeySource;
  model: DeepSeekModel;
  loading: boolean;
  error: string;
  configured: boolean;
  saveKey: (key: string) => Promise<void>;
  clearKey: () => Promise<void>;
  setModel: (model: DeepSeekModel) => void;
}

function readInitialModel(): DeepSeekModel {
  try {
    return loadModel(window.localStorage);
  } catch {
    return 'deepseek-chat';
  }
}

export function useDeepSeekConfig(): DeepSeekConfig {
  const [state, setState] = useState({
    apiKey: '',
    source: 'none' as KeySource,
    model: readInitialModel(),
    loading: true,
    error: '',
  });

  useEffect(() => {
    let alive = true;
    readApiKey()
      .then(stored => {
        if (!alive) return;
        setState(current => ({ ...current, apiKey: stored.key, source: stored.source, loading: false }));
      })
      .catch(cause => {
        if (!alive) return;
        setState(current => ({
          ...current,
          loading: false,
          error: `读取已保存的 API Key 失败：${describeError(cause)}`,
        }));
      });
    return () => {
      alive = false;
    };
  }, []);

  async function saveKey(value: string) {
    const stored = await writeApiKey(value);
    setState(current => ({ ...current, apiKey: stored.key, source: stored.source, error: '' }));
  }

  async function clearKey() {
    await clearApiKey();
    setState(current => ({ ...current, apiKey: '', source: 'none', error: '' }));
  }

  function setModel(model: DeepSeekModel) {
    setState(current => ({ ...current, model }));
    try {
      saveModel(window.localStorage, model);
    } catch {
      // Model choice is a convenience setting; keep the in-memory value.
    }
  }

  return { ...state, configured: Boolean(state.apiKey), saveKey, clearKey, setModel };
}
