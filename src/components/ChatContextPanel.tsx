import { Trash2 } from 'lucide-react';
import FrogMark, { FrogFace } from './FrogMark';

interface Props {
  value: string;
  relationship: string;
  customRelationship: string;
  onRelationshipChange: (value: string) => void;
  onCustomRelationshipChange: (value: string) => void;
  onChange: (value: string) => void;
}

const relationships = ['未指定', '朋友', '亲人', '老师', '情侣', '普通同学', '主人', '狗', '自定义'];

/** Two staggered rows of skewed dashes — the "checker" motif from the design. */
function CheckerMark() {
  const cells: Array<[number, number]> = [];
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      cells.push([col * 14 + row * 7, row * 11]);
    }
  }
  return (
    <svg className="checker" viewBox="0 0 98 21" aria-hidden="true" focusable="false">
      <g transform="skewX(-20)" fill="currentColor">
        {cells.map(([x, y], index) => (
          <rect key={index} x={x + (y ? 7 : 0)} y={y} width="10" height="8.5" rx="0.6" />
        ))}
      </g>
    </svg>
  );
}

export default function ChatContextPanel({
  value, onChange, relationship, customRelationship, onRelationshipChange, onCustomRelationshipChange,
}: Props) {
  return (
    <section className="card card-lime chat-card" aria-label="当前聊天">
      <FrogFace className="chat-watermark" layer="outline" />
      <div className="card-head">
        <FrogMark size={42} pose="hands" className="head-frog" />
        <h2>当前聊天</h2>
        <button type="button" className="trash-button" aria-label="清空聊天记录" disabled={!value}
          onClick={() => onChange('')}><Trash2 size={16} strokeWidth={2.6} /></button>
      </div>
      <div className="chat-body">
        <div className="field relationship-field">
          <label htmlFor="relationship-select">对方是我的</label>
          <div className="select-shell">
            <select id="relationship-select" aria-label="对方是我的" value={relationship}
              onChange={event => onRelationshipChange(event.target.value)}>
              {relationships.map(item => <option key={item}>{item}</option>)}
            </select>
          </div>
          {relationship === '自定义' && (
            <input className="custom-relationship" type="text" aria-label="自定义关系" maxLength={40}
              placeholder="例如：同事" value={customRelationship}
              onChange={event => onCustomRelationshipChange(event.target.value)} />
          )}
        </div>
        <div className="field chat-field">
          <label htmlFor="chat-context">粘贴聊天记录</label>
          <textarea id="chat-context" className="chat-input" rows={2} value={value}
            placeholder="粘贴微信聊天记录，自动保留昵称、时间和正文。"
            onChange={event => onChange(event.target.value)} />
          <FrogFace className="chat-input-frog" pose="hands" />
        </div>
      </div>
      <div className="card-foot">
        <CheckerMark />
        <span className="word-count">{value.length} 字</span>
      </div>
    </section>
  );
}
