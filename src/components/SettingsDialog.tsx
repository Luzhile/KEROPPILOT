import { useEffect, useRef, type ComponentProps } from 'react';
import { KeyRound, X } from 'lucide-react';
import ApiSettingsPage from './ApiSettingsPage';

interface Props extends Omit<ComponentProps<typeof ApiSettingsPage>, 'compact'> {
  open: boolean;
  onClose: () => void;
}

/**
 * Small, on-demand settings surface for the rarely used API configuration.
 * It keeps the main navigation focused on the three chat workflows.
 */
export default function SettingsDialog({ open, onClose, apiKey, ...settings }: Props) {
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const input = dialog.current?.querySelector<HTMLInputElement>('input[aria-label="DeepSeek API Key"]');
    input?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeHandler.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href]',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="settings-overlay" role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialog} className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title">
        <header className="settings-dialog-header">
          <h2 id="settings-dialog-title"><KeyRound size={17} /> API 设置</h2>
          <span className={`status-pill ${apiKey ? 'done' : 'idle'}`}>{apiKey ? '已配置' : '未配置'}</span>
          <button type="button" className="icon-button" aria-label="关闭 API 设置" onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        <div className="settings-dialog-body">
          <ApiSettingsPage apiKey={apiKey} compact {...settings} />
        </div>
      </div>
    </div>
  );
}
