/**
 * AddBotModal: dialog for configuring and adding an AI bot player.
 * Supports custom name, personality style, and enforces 3-bot limit.
 */
import { useState } from 'react';
import { useLang } from '../../i18n/useLang.js';

export type BotStyle = 'conservative' | 'aggressive' | 'random';

interface Props {
  currentBotCount: number;
  onAdd: (name: string, style: BotStyle) => void;
  onClose: () => void;
}

const STYLE_META: { value: BotStyle; color: string; icon: string }[] = [
  { value: 'conservative', color: 'rgba(59,130,246,0.25)', icon: '🛡️' },
  { value: 'aggressive',   color: 'rgba(239,68,68,0.25)',  icon: '⚔️' },
  { value: 'random',       color: 'rgba(168,85,247,0.25)', icon: '🎲' },
];

export function AddBotModal({ currentBotCount, onAdd, onClose }: Props) {
  const [name, setName] = useState('');
  const [style, setStyle] = useState<BotStyle>('aggressive');
  const t = useLang().addBot;
  const MAX_BOTS = 3;
  const atLimit = currentBotCount >= MAX_BOTS;
  const placeholder = `AI${currentBotCount + 1}`;

  const STYLES = [
    { value: 'conservative' as BotStyle, label: t.conservativeLabel, desc: t.conservativeDesc, color: STYLE_META[0].color, icon: STYLE_META[0].icon },
    { value: 'aggressive'   as BotStyle, label: t.aggressiveLabel,   desc: t.aggressiveDesc,   color: STYLE_META[1].color, icon: STYLE_META[1].icon },
    { value: 'random'       as BotStyle, label: t.randomLabel,       desc: t.randomDesc,       color: STYLE_META[2].color, icon: STYLE_META[2].icon },
  ];

  const handleAdd = () => {
    if (atLimit) return;
    onAdd(name.trim() || placeholder, style);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[340px] rounded-2xl p-6 flex flex-col gap-4 text-white"
        style={{
          background: 'linear-gradient(180deg, #0c1528 0%, #060b18 100%)',
          border: '1px solid rgba(212,160,23,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base text-slate-100">{t.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.currentCount(currentBotCount, MAX_BOTS)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        {atLimit ? (
          <div className="text-center py-4 text-amber-400 text-sm">
            {t.atLimit(MAX_BOTS)}
          </div>
        ) : (
          <>
            {/* Name input */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">{t.nameLabel(placeholder)}</label>
              <input
                type="text"
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-all"
                style={{
                  background: 'rgba(21,32,64,0.8)',
                  border: '1px solid rgba(100,116,139,0.4)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(212,160,23,0.6)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(100,116,139,0.4)')}
              />
            </div>

            {/* Style selector */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">{t.styleLabel}</label>
              <div className="flex flex-col gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all"
                    style={{
                      background: style === s.value ? s.color : 'rgba(21,32,64,0.4)',
                      border: style === s.value
                        ? '1px solid rgba(212,160,23,0.5)'
                        : '1px solid rgba(100,116,139,0.2)',
                    }}
                  >
                    <span className="text-xl">{s.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{s.label}</div>
                      <div className="text-xs text-slate-400">{s.desc}</div>
                    </div>
                    {style === s.value && (
                      <span className="ml-auto text-amber-400 text-xs font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Add button */}
            <button
              onClick={handleAdd}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(180deg, #f5c842 0%, #b8860b 100%)',
                boxShadow: '0 4px 16px rgba(212,160,23,0.35)',
                color: '#060b18',
              }}
            >
              {t.addBtn}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
