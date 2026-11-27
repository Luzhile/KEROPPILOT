import { emojiPreferences, type StyleProfile } from '../types';
import FrogMark from './FrogMark';

interface Props {
  profile: StyleProfile;
  status: string;
  onChange: (profile: StyleProfile) => void;
}

export default function StylePage({ profile, status, onChange }: Props) {
  return (
    <section className="card card-dark style-page" aria-label="我的风格设置">
      <div className="card-head">
        <FrogMark size={42} pose="phone" className="head-frog" />
        <h2>个人表达档案</h2>
      </div>
      <label>
        口头禅
        <input className="catchphrase-input" type="text" aria-label="口头禅" maxLength={60}
          value={profile.catchphrase} placeholder="例如：好家伙、绝了、懂了"
          onChange={event => onChange({ ...profile, catchphrase: event.target.value })} />
      </label>
      <label>
        Emoji 使用偏好
        <select aria-label="Emoji 使用偏好" value={profile.emoji}
          onChange={event => onChange({ ...profile, emoji: event.target.value as StyleProfile['emoji'] })}>
          {emojiPreferences.map(emoji => <option key={emoji}>{emoji}</option>)}
        </select>
      </label>
      <label>
        自定义表达规则
        <textarea rows={5} maxLength={2000} value={profile.rules}
          placeholder="例如：少用感叹号；避免称呼对方为亲；优先使用短句。"
          onChange={event => onChange({ ...profile, rules: event.target.value })} />
      </label>
      <p className="subtle">{profile.rules.length} / 2000 字</p>
      {status && <p role="status" className="help-text">{status}</p>}
    </section>
  );
}
