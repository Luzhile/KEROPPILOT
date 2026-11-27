import { DEFAULT_MODEL, DEEPSEEK_MODELS, type DeepSeekModel } from './deepseek';

export const MODEL_KEY = 'chatpilot.deepseek.v1';

export function normalizeModel(value: unknown): DeepSeekModel {
  return DEEPSEEK_MODELS.some(model => model.id === value) ? (value as DeepSeekModel) : DEFAULT_MODEL;
}

export function loadModel(storage: Pick<Storage, 'getItem'>): DeepSeekModel {
  try {
    const raw = storage.getItem(MODEL_KEY);
    if (!raw) return DEFAULT_MODEL;
    const data = JSON.parse(raw) as { model?: unknown };
    return normalizeModel(data.model);
  } catch {
    return DEFAULT_MODEL;
  }
}

export function saveModel(storage: Pick<Storage, 'setItem'>, model: DeepSeekModel): void {
  storage.setItem(MODEL_KEY, JSON.stringify({ model: normalizeModel(model) }));
}
