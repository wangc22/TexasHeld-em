/**
 * QuickChatMenu: compact overlay panel for sending preset messages or emoji reactions.
 * Opens from the 💬 button in the game bottom bar.
 */
import { useLang } from '../../i18n/useLang.js';

interface Props {
  onSend: (content: string, contentType: 'message' | 'emoji') => void;
  onClose: () => void;
}

const EMOJIS = ['😂', '😤', '🤔', '💪', '🙄', '😱', '🎰', '🤦'];

export function QuickChatMenu({ onSend, onClose }: Props) {
  const t = useLang().chat;
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-80 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
        style={{ background: 'rgba(12,21,40,0.97)', border: '1px solid rgba(100,116,139,0.3)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '1px solid rgba(100,116,139,0.2)' }}
        >
          <span className="text-slate-300 text-sm font-semibold">{t.header}</span>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Emoji row */}
        <div className="flex justify-around px-3 py-2.5" style={{ borderBottom: '1px solid rgba(100,116,139,0.15)' }}>
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onSend(emoji, 'emoji'); onClose(); }}
              className="text-2xl hover:scale-125 active:scale-110 transition-transform"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Preset messages */}
        <div className="p-2 space-y-1 max-h-52 overflow-y-auto">
          {t.messages.map((msg) => (
            <button
              key={msg}
              onClick={() => { onSend(msg, 'message'); onClose(); }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg transition-colors text-slate-300 hover:text-white"
              style={{ background: 'rgba(21,32,64,0.5)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(21,32,64,0.9)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(21,32,64,0.5)'; }}
            >
              {msg}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
