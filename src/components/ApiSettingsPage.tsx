import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { DEEPSEEK_MODELS, testConnection, type DeepSeekModel } from '../services/deepseek';
import { looksLikeApiKey, maskApiKey, normalizeApiKey, type KeySource } from '../services/apiKey';
import { desktopAvailable, openDeepSeekPlatform } from '../services/desktop';
import { describeError } from '../services/errors';

interface Props {
  apiKey: string;
  source: KeySource;
  model: DeepSeekModel;
  loading: boolean;
  readError: string;
  onSave: (key: string) => Promise<void>;
  onClear: () => Promise<void>;
  onModelChange: (model: DeepSeekModel) => void;
  compact?: boolean;
}

const sourceLabels: Record<KeySource, string> = {
  file: '已用 Windows DPAPI 加密保存在本机',
  env: '正在使用环境变量 DEEPSEEK_API_KEY',
  session: '仅保留在当前标签页',
  none: '尚未配置',
};

export default function ApiSettingsPage({
  apiKey, source, model, loading, readError, onSave, onClear, onModelChange, compact = false,
}: Props) {
  const [draft, setDraft] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [test, setTest] = useState<{ status: 'idle' | 'testing' | 'ok' | 'error'; text: string }>({
    status: 'idle',
    text: '',
  });

  const candidate = normalizeApiKey(draft) || apiKey;

  async function save() {
    if (!normalizeApiKey(draft)) {
      setMessage({ text: '请先输入 DeepSeek API Key。', error: true });
      return;
    }
    setBusy(true);
    try {
      await onSave(draft);
      setDraft('');
      setVisible(false);
      setTest({ status: 'idle', text: '' });
      setMessage({
        text: looksLikeApiKey(candidate)
          ? (desktopAvailable ? 'API Key 已加密保存，可以直接生成回复了。' : '已在当前标签页启用 DeepSeek。')
          : '已保存。这个 Key 格式不像官方 Key（通常以 sk- 开头），请确认可用。',
        error: false,
      });
    } catch (cause) {
      setMessage({ text: `保存失败：${describeError(cause)}`, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await onClear();
      setTest({ status: 'idle', text: '' });
      setMessage({ text: desktopAvailable ? '已删除本机保存的 API Key。' : '已清除当前标签页的 API Key。', error: false });
    } catch (cause) {
      setMessage({ text: `删除失败：${describeError(cause)}`, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!candidate) {
      setTest({ status: 'error', text: '请先输入或保存 API Key。' });
      return;
    }
    setTest({ status: 'testing', text: '正在连接 DeepSeek…' });
    try {
      const result = await testConnection(candidate, model);
      setTest({
        status: 'ok',
        text: `连接正常，用时 ${(result.latencyMs / 1000).toFixed(1)} 秒，模型回复：${result.reply.slice(0, 40)}`,
      });
    } catch (cause) {
      setTest({ status: 'error', text: describeError(cause) });
    }
  }

  return (
    <section className="panel settings-page" aria-label="DeepSeek API 设置">
      {!compact && (
        <div className="section-heading">
          <h2><KeyRound size={17} /> DeepSeek API</h2>
          <span className={`status-pill ${apiKey ? 'done' : 'idle'}`}>{apiKey ? '已配置' : '未配置'}</span>
        </div>
      )}
      <p className="help-text">
        {desktopAvailable ? 'KEROPPILOT 直接调用 DeepSeek 官方接口生成回复。' : '填写你自己的 DeepSeek API Key，浏览器会直接向 DeepSeek 发送生成请求。'}
      </p>

      {readError && <p role="alert" className="feedback error">{readError}</p>}

      <div className="key-status">
        <span className={`key-dot ${apiKey ? 'ok' : ''}`} aria-hidden="true" />
        <span>{loading ? '正在读取本机密钥…' : (apiKey ? `已保存 ${maskApiKey(apiKey)}` : '尚未保存 API Key')}</span>
        <span className="key-source">{sourceLabels[source]}</span>
      </div>

      <label className="settings-field">
        <span>{apiKey ? '替换 API Key' : 'DeepSeek API Key'}</span>
        <div className="key-row">
          <input
            type={visible ? 'text' : 'password'}
            aria-label="DeepSeek API Key"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-..."
            value={draft}
            onChange={event => setDraft(event.target.value)}
          />
          <button type="button" className="icon-button" aria-label={visible ? '隐藏 API Key' : '显示 API Key'}
            onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {draft && !looksLikeApiKey(draft) && (
          <span className="field-note">官方 Key 通常以 sk- 开头；如使用代理服务可忽略此提示。</span>
        )}
      </label>

      <div className="console-actions settings-actions">
        <button type="button" className="button primary" disabled={busy || !draft.trim()} onClick={() => void save()}>
          {busy ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
          {desktopAvailable ? '保存到本机' : '在当前标签页使用'}
        </button>
        <button type="button" className="button secondary" disabled={busy || !candidate || test.status === 'testing'} onClick={() => void check()}>
          {test.status === 'testing' ? <Loader2 size={16} className="spin" /> : <Zap size={16} />} 测试连接
        </button>
        {apiKey && (
          <button type="button" className="icon-button danger" aria-label="删除已保存的 API Key"
            disabled={busy} onClick={() => void remove()}>
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {test.status !== 'idle' && (
        <p role={test.status === 'error' ? 'alert' : 'status'}
          className={`feedback ${test.status === 'error' ? 'error' : ''} ${test.status === 'ok' ? 'success' : ''}`}>
          {test.status === 'ok' && <CheckCircle2 size={14} />} {test.text}
        </p>
      )}
      {message && (
        <p role={message.error ? 'alert' : 'status'} className={`feedback ${message.error ? 'error' : ''}`}>
          {message.text}
        </p>
      )}

      <label className="settings-field">
        <span>生成模型</span>
        <select aria-label="生成模型" value={model} onChange={event => onModelChange(event.target.value as DeepSeekModel)}>
          {DEEPSEEK_MODELS.map(item => (
            <option key={item.id} value={item.id}>{item.name} · {item.note}</option>
          ))}
        </select>
      </label>

      <div className="privacy-box">
        <h3><ShieldCheck size={15} /> 隐私说明</h3>
        <ul>
          <li>{desktopAvailable
            ? 'API Key 通过 Windows DPAPI 加密保存在本机，只有当前 Windows 账户能解密。'
            : 'API Key 保存在当前标签页的会话存储，可以随时在这里清除。'}</li>
          <li>生成回复或解读时，聊天记录、意图和风格设置会直接发送给 DeepSeek。</li>
        </ul>
        <button type="button" className="text-button" onClick={() => void openDeepSeekPlatform()}>
          前往 DeepSeek 开放平台获取 API Key
        </button>
      </div>
    </section>
  );
}
