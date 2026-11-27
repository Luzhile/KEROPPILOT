import { useMemo, useState } from 'react';
import { Link2, Pin, Sparkles } from 'lucide-react';
import { tones, lengths, type ReplySettings, type StrategyParameters, type StyleProfile } from './types';
import { desktopAvailable, setPinned } from './services/desktop';
import { buildPrompt, parsePastedChat } from './services/prompt';
import { buildAnalysisPrompt } from './services/prompts/analysis';
import { defaultStrategy } from './services/strategies';
import { useStyleProfile } from './hooks/useStyleProfile';
import { useDeepSeekConfig } from './hooks/useDeepSeekConfig';
import ChatContextPanel from './components/ChatContextPanel';
import FrogMark, { FrogFace } from './components/FrogMark';
import HalftoneFrog from './components/HalftoneFrog';
import ReplyConsole from './components/ReplyConsole';
import SettingsDialog from './components/SettingsDialog';
import StrategyControls from './components/StrategyControls';
import StylePage from './components/StylePage';

const pages = [
  { id: 'strategy', label: '策略实验台' },
  { id: 'analysis', label: '对话分析' },
  { id: 'style', label: '我的风格' },
] as const;
type Page = (typeof pages)[number]['id'];

export default function App() {
  const [page, setPage] = useState<Page>('strategy');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pinned, setPinnedState] = useState(true);
  const [windowError, setWindowError] = useState('');
  const [chatText, setChatText] = useState('');
  const [relationship, setRelationship] = useState('未指定');
  const [customRelationship, setCustomRelationship] = useState('');
  const messages = useMemo(() => parsePastedChat(chatText), [chatText]);
  const [intent, setIntent] = useState('');
  const [composingIntent, setComposingIntent] = useState(false);
  const [replyRequest, setReplyRequest] = useState(0);
  const [strategy, setStrategy] = useState<StrategyParameters>({ ...defaultStrategy });
  const { profile, status, updateProfile } = useStyleProfile();
  const deepseek = useDeepSeekConfig();
  const [settings, setSettings] = useState<ReplySettings>({ tone: '自然', length: '适中' });
  const effectiveRelationship = relationship === '自定义'
    ? (customRelationship.trim() || '未指定')
    : relationship;
  const readyForReply = Boolean(intent.trim());
  const hasChat = messages.some(message => message.text.trim());
  const replyPrompt = hasChat
    ? buildPrompt(messages, readyForReply ? intent : null, settings, profile, strategy, effectiveRelationship)
    : '';
  const analysisPrompt = buildAnalysisPrompt(messages, profile, effectiveRelationship);
  const openSettings = () => setSettingsOpen(true);
  const missingKey = !deepseek.loading && !deepseek.apiKey;

  function changeProfile(next: StyleProfile) {
    updateProfile(next);
  }

  async function togglePinned() {
    try {
      await setPinned(!pinned);
      setPinnedState(!pinned);
      setWindowError('');
    } catch (cause) {
      setWindowError(String(cause));
    }
  }

  return (
    <div className={`app-shell${desktopAvailable ? '' : ' web-shell'}`}>
      <span className="app-rail" aria-hidden="true" />

      <header className="app-header">
        <HalftoneFrog className="header-halftone" />
        <div className="brand">
          <FrogMark size={50} className="brand-frog" />
          <div className="brand-copy">
            <span className="wordmark">
              KEROPPILOT
              <svg className="wordmark-orbit" viewBox="0 0 78 46" aria-hidden="true" focusable="false">
                <ellipse cx="38" cy="24" rx="35" ry="17.5" transform="rotate(-22 38 24)" />
                <path className="orbit-star"
                  d="M72 -6C74.6 -0.4 76.2 1.2 81.8 3.8 76.2 6.4 74.6 8 72 13.6 69.4 8 67.8 6.4 62.2 3.8 67.8 1.2 69.4 -0.4 72 -6Z" />
              </svg>
            </span>
            <small>WECHAT REPLY COPILOT</small>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="orbit-button is-lime" aria-label="API 设置" title="API 设置"
            onClick={openSettings}>
            <Link2 size={17} strokeWidth={2.6} />
            {missingKey && <span className="status-dot" aria-hidden="true" />}
          </button>
          {desktopAvailable && (
            <button type="button" className={`orbit-button ${pinned ? 'is-on' : ''}`}
              aria-label={pinned ? '取消置顶' : '窗口置顶'} title={pinned ? '取消置顶' : '窗口置顶'}
              onClick={() => void togglePinned()}>
              <Pin size={17} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </header>

      <nav className="page-nav" aria-label="主页面">
        {pages.map(item => (
          <button key={item.id} type="button" aria-current={page === item.id ? 'page' : undefined}
            className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      <main>
        {windowError && <p role="alert" className="feedback error">{windowError}</p>}
        {missingKey && (
          <div className="setup-banner">
            <FrogMark size={26} className="banner-frog" />
            <span>还没有配置 DeepSeek API Key，生成功能暂不可用。</span>
            <button type="button" className="banner-action" onClick={openSettings}>去配置</button>
          </div>
        )}

        <div hidden={page === 'style'}>
          <ChatContextPanel value={chatText} onChange={setChatText} relationship={relationship}
            customRelationship={customRelationship} onRelationshipChange={setRelationship}
            onCustomRelationshipChange={setCustomRelationship} />
        </div>

        <div className="page" hidden={page !== 'strategy'} aria-label="策略实验台页面">
          <section className="card card-dark intention-card" aria-label="我想表达">
            <div className="card-head">
              <FrogMark size={42} className="head-frog" />
              <h2>我想表达</h2>
              <div className="head-deco" aria-hidden="true">
                <svg className="sparkles" viewBox="0 0 76 62" focusable="false">
                  <path d="M44 2c2.8 13.2 6.9 17.3 20.1 20.1C50.9 24.9 46.8 29 44 42.2 41.2 29 37.1 24.9 23.9 22.1 37.1 19.3 41.2 15.2 44 2Z" />
                  <path d="M9 34c1.5 7.3 4 9.8 11.3 11.3C13 46.8 10.5 49.3 9 56.6 7.5 49.3 5 46.8-2.3 45.3 5 43.8 7.5 41.3 9 34Z" />
                </svg>
                <span className="sticker">brat</span>
              </div>
            </div>
            <div className="intent-row">
              <div className="intent-field">
                <textarea className="intent-input" aria-label="回复意图" rows={2}
                  placeholder="写下你想表达的内容，也可留空。"
                  value={intent} onChange={event => setIntent(event.target.value)}
                  onCompositionStart={() => setComposingIntent(true)}
                  onCompositionEnd={event => {
                    setIntent(event.currentTarget.value);
                    setComposingIntent(false);
                  }} />
                <FrogFace className="intent-watermark" />
                <span className="resize-mark" aria-hidden="true" />
              </div>
              <button type="button" className="button primary intent-generate"
                disabled={!hasChat || !deepseek.apiKey || composingIntent}
                onClick={() => setReplyRequest(request => request + 1)}>
                <Sparkles size={17} aria-hidden="true" />
                直接生成
              </button>
            </div>
            <StrategyControls parameters={strategy} onChange={setStrategy} />

            <div className="reply-options">
              <div className="tone-options">
                {tones.map(tone => (
                  <button key={tone} type="button" className={`tone-chip ${settings.tone === tone ? 'active' : ''}`}
                    aria-pressed={settings.tone === tone} onClick={() => setSettings({ ...settings, tone })}>
                    {tone}
                  </button>
                ))}
              </div>
              <label className="length-field">
                <span>本次回复长度</span>
                <select aria-label="本次回复长度" value={settings.length}
                  onChange={event => setSettings({ ...settings, length: event.target.value as ReplySettings['length'] })}>
                  {lengths.map(length => <option key={length}>{length}</option>)}
                </select>
              </label>
            </div>

            <ReplyConsole title="回复控制台" prompt={replyPrompt} embedded revisions
              auto={page === 'strategy' && readyForReply && !composingIntent}
              autoDelayMs={2000} autoInput={intent} manualRequest={replyRequest}
              singleLine={settings.length !== '简短'}
              ready={hasChat} apiKey={deepseek.apiKey} model={deepseek.model}
              emptyText="回复会自动出现在这里。" />
          </section>

        </div>

        <div className="page" hidden={page !== 'analysis'} aria-label="对话分析页面">
          <section className="card card-dark analysis-card">
            <div className="card-head">
              <FrogMark size={42} className="head-frog" />
              <h2>多角度语境解读</h2>
            </div>
            <ReplyConsole title="解读控制台" prompt={analysisPrompt} embedded auto={page === 'analysis'}
              ready={hasChat} apiKey={deepseek.apiKey} model={deepseek.model}
              emptyText="解读会自动出现在这里。" />
          </section>

        </div>

        <div className="page" hidden={page !== 'style'}>
          <StylePage profile={profile} status={status} onChange={changeProfile} />
        </div>

      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)}
        apiKey={deepseek.apiKey} source={deepseek.source} model={deepseek.model}
        loading={deepseek.loading} readError={deepseek.error}
        onSave={deepseek.saveKey} onClear={deepseek.clearKey} onModelChange={deepseek.setModel} />
    </div>
  );
}
