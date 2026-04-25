import { useState } from 'react';
import { getSocket } from '../../socket/socketClient.js';
import { EVENTS } from '@texas-poker/shared';
import type { Player, GameState, PlayerAction } from '@texas-poker/shared';
import { computeValidActions } from '@texas-poker/shared';
import { useLang } from '../../i18n/useLang.js';

interface Props {
  player: Player;
  gameState: GameState;
  onSendAction?: (type: PlayerAction['type'], amount?: number) => void;
  highlight?: 'fold' | 'call' | 'raise' | 'raiseArea' | 'raiseInput' | 'addChips';
  disabledActions?: Partial<Record<PlayerAction['type'], string>>;
}

// Chip colors by denomination (solid base color for radial gradient)
const CHIP_COLORS: Record<number, string> = {
  1:   'bg-slate-100 text-slate-900',
  2:   'bg-slate-200 text-slate-900',
  5:   'bg-red-600 text-white',
  10:  'bg-blue-600 text-white',
  20:  'bg-emerald-600 text-white',
  25:  'bg-emerald-500 text-white',
  50:  'bg-slate-600 text-white',
  100: 'bg-purple-600 text-white',
  500: 'bg-orange-500 text-white',
};

function getChipColor(denom: number): string {
  return CHIP_COLORS[denom] ?? 'bg-slate-500 text-white';
}

function snapToChip(amount: number, denominations: number[], min: number, max: number): number {
  const smallest = denominations[0] ?? 1;
  const snapped = Math.round(amount / smallest) * smallest;
  return Math.max(min, Math.min(max, snapped));
}

export function ActionPanel({ player, gameState, onSendAction, highlight, disabledActions }: Props) {
  const [raiseAmount, setRaiseAmount] = useState<number>(0);
  const socket = getSocket();
  const t = useLang().actions;

  const valid = computeValidActions(
    player,
    gameState.currentBetAmount,
    gameState.minRaise,
    gameState.pot
  );

  const chips: number[] = gameState.config.chipDenominations ?? [2, 5, 10, 20, 50];
  const effectiveRaise = raiseAmount > 0 ? raiseAmount : valid.minRaise;

  const setRaise = (amount: number) => {
    setRaiseAmount(snapToChip(amount, chips, valid.minRaise, valid.maxRaise));
  };

  const addChip = (denom: number) => {
    const next = effectiveRaise + denom;
    setRaiseAmount(Math.min(next, valid.maxRaise));
  };

  const sendAction = (type: PlayerAction['type'], amount?: number) => {
    if (onSendAction) {
      onSendAction(type, amount);
      return;
    }
    socket.emit(EVENTS.GAME_ACTION, {
      tableId: gameState.tableId,
      action: { type, amount },
    });
  };
  const getDisabledReason = (type: PlayerAction['type']) => disabledActions?.[type] ?? '';
  const isDisabled = (type: PlayerAction['type']) => Boolean(getDisabledReason(type));

  const pot = gameState.pot;
  const presets = valid.canRaise
    ? [
        { label: 'Min',     value: valid.minRaise },
        { label: '1/3 Pot', value: snapToChip(Math.floor(pot / 3), chips, valid.minRaise, valid.maxRaise) },
        { label: '1/2 Pot', value: snapToChip(Math.floor(pot / 2), chips, valid.minRaise, valid.maxRaise) },
        { label: 'Pot',     value: snapToChip(pot, chips, valid.minRaise, valid.maxRaise) },
        { label: 'Max',     value: valid.maxRaise },
      ]
    : [];

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4 backdrop-blur-sm animate-fade-in-up"
      style={{
        background: 'linear-gradient(180deg, rgba(12,21,40,0.97) 0%, rgba(6,11,24,0.99) 100%)',
        borderTop:    '1px solid rgba(212,160,23,0.28)',
        borderLeft:   '1px solid rgba(255,255,255,0.05)',
        borderRight:  '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(0,0,0,0.6)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,160,23,0.08)',
      }}
    >
      <style>{`
        [data-highlighted="true"]{
          outline: 3px solid rgba(245, 200, 66, 0.95);
          outline-offset: 3px;
          box-shadow: 0 0 0 6px rgba(245, 200, 66, 0.18), 0 10px 28px rgba(0,0,0,0.55);
          animation: tutorialPulse 1.1s ease-in-out infinite;
        }
        @keyframes tutorialPulse {
          0%, 100% { transform: translateZ(0) scale(1); }
          50% { transform: translateZ(0) scale(1.02); }
        }
      `}</style>
      {/* Main action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { if (!isDisabled('fold')) sendAction('fold'); }}
          disabled={isDisabled('fold')}
          title={getDisabledReason('fold') || undefined}
          className="flex-1 min-w-[60px] py-2.5 px-3 rounded-lg font-semibold text-sm
            text-white transition-all active:scale-95
            border border-red-900/50"
          data-highlight-target="fold"
          data-highlighted={highlight === 'fold' ? 'true' : 'false'}
          style={{ background: 'linear-gradient(180deg, #b91c1c 0%, #7f1d1d 100%)',
                   boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                   opacity: isDisabled('fold') ? 0.45 : 1,
                   cursor: isDisabled('fold') ? 'not-allowed' : 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#dc2626 0%,#991b1b 100%)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#b91c1c 0%,#7f1d1d 100%)')}
        >
          {t.fold}
        </button>

        {valid.canCheck && (
          <button
            onClick={() => { if (!isDisabled('check')) sendAction('check'); }}
            disabled={isDisabled('check')}
            title={getDisabledReason('check') || undefined}
            className="flex-1 min-w-[60px] py-2.5 px-3 rounded-lg font-semibold text-sm
              text-white transition-all active:scale-95 border border-slate-700/50"
            style={{ background: 'linear-gradient(180deg, #475569 0%, #1e293b 100%)',
                     boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                     opacity: isDisabled('check') ? 0.45 : 1,
                     cursor: isDisabled('check') ? 'not-allowed' : 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#64748b 0%,#334155 100%)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#475569 0%,#1e293b 100%)')}
          >
            {t.check}
          </button>
        )}

        {valid.canCall && (
          <button
            onClick={() => { if (!isDisabled('call')) sendAction('call'); }}
            disabled={isDisabled('call')}
            title={getDisabledReason('call') || undefined}
            className="flex-1 min-w-[80px] py-2.5 px-3 rounded-lg font-semibold text-sm
              text-white transition-all active:scale-95 border border-blue-900/50"
            data-highlight-target="call"
            data-highlighted={highlight === 'call' ? 'true' : 'false'}
            style={{ background: 'linear-gradient(180deg, #1d4ed8 0%, #1e3a8a 100%)',
                     boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
                     opacity: isDisabled('call') ? 0.45 : 1,
                     cursor: isDisabled('call') ? 'not-allowed' : 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#2563eb 0%,#1d4ed8 100%)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#1d4ed8 0%,#1e3a8a 100%)')}
          >
            {t.call} {valid.callAmount}
          </button>
        )}

        {valid.canAllIn && (
          <button
            onClick={() => { if (!isDisabled('all_in')) sendAction('all_in'); }}
            disabled={isDisabled('all_in')}
            title={getDisabledReason('all_in') || undefined}
            className="flex-1 min-w-[80px] py-2.5 px-3 rounded-lg font-bold text-sm
              text-navy-950 transition-all active:scale-95 border border-gold-600/50 animate-pulse"
            style={{ background: 'linear-gradient(180deg, #f5c842 0%, #b8860b 100%)',
                     boxShadow: '0 2px 10px rgba(212,160,23,0.4)',
                     opacity: isDisabled('all_in') ? 0.45 : 1,
                     cursor: isDisabled('all_in') ? 'not-allowed' : 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#fde68a 0%,#d4a017 100%)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#f5c842 0%,#b8860b 100%)')}
          >
            {t.allIn} ({valid.allInAmount})
          </button>
        )}
      </div>

      {/* Raise area */}
      {valid.canRaise && (
        <div
          className="rounded-lg p-3 space-y-3"
          data-highlight-target="raiseArea"
          data-highlighted={highlight === 'raiseArea' ? 'true' : 'false'}
          style={{
            border: '1px solid rgba(100,116,139,0.3)',
            background: 'rgba(6,11,24,0.5)',
          }}
        >
          {/* Amount + raise button */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400 shrink-0">{t.raiseTo}</span>
            <input
              type="number"
              min={valid.minRaise}
              max={valid.maxRaise}
              value={effectiveRaise}
              onChange={(e) => setRaise(Number(e.target.value))}
              className="w-28 text-white text-sm font-mono text-right rounded px-2 py-1.5
                focus:outline-none transition-all"
              data-highlight-target="raiseInput"
              data-highlighted={highlight === 'raiseInput' ? 'true' : 'false'}
              style={{
                background: 'rgba(21,32,64,0.8)',
                border: '1px solid rgba(100,116,139,0.4)',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(212,160,23,0.6)')}
              onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(100,116,139,0.4)')}
            />
            <button
              onClick={() => { if (!isDisabled('raise')) sendAction('raise', effectiveRaise); }}
              disabled={isDisabled('raise')}
              title={getDisabledReason('raise') || undefined}
              className="flex-1 py-2 px-3 rounded-lg font-semibold text-sm text-white
                transition-all active:scale-95 border border-emerald-900/50"
              data-highlight-target="raise"
              data-highlighted={highlight === 'raise' ? 'true' : 'false'}
              style={{ background: 'linear-gradient(180deg, #059669 0%, #064e3b 100%)',
                       boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                       opacity: isDisabled('raise') ? 0.45 : 1,
                       cursor: isDisabled('raise') ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#10b981 0%,#065f46 100%)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#059669 0%,#064e3b 100%)')}
            >
              {t.raise} {effectiveRaise}
            </button>
          </div>

          {/* Quick preset buttons */}
          <div className="flex gap-1.5 flex-wrap">
            {presets.map((p) => {
              const isActive = effectiveRaise === p.value;
              return (
                <button
                  key={p.label}
                  onClick={() => setRaiseAmount(p.value)}
                  className="text-xs px-2.5 py-1 rounded-md font-medium transition-all"
                  style={isActive
                    ? { background: 'linear-gradient(180deg,#f5c842 0%,#b8860b 100%)', color: '#060b18' }
                    : { background: 'rgba(30,47,92,0.7)', color: '#94a3b8' }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Chip denomination buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs text-slate-500 shrink-0"
              data-highlight-target="addChips"
              data-highlighted={highlight === 'addChips' ? 'true' : 'false'}
            >
              {t.addChips}
            </span>
            {chips.map((denom) => {
              const wouldExceed = effectiveRaise + denom > valid.maxRaise;
              return (
                <button
                  key={denom}
                  onClick={() => addChip(denom)}
                  disabled={wouldExceed}
                  title={wouldExceed ? t.maxReached : `+${denom}`}
                  className={`w-10 h-10 rounded-full text-xs font-bold
                    border-2 border-white/25 transition-all active:scale-95
                    ${getChipColor(denom)}
                    ${wouldExceed ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-115 hover:scale-105'}`}
                  style={{
                    boxShadow: '0 3px 6px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.25)',
                  }}
                >
                  +{denom}
                </button>
              );
            })}
            {/* Reset */}
            <button
              onClick={() => setRaiseAmount(valid.minRaise)}
              className="w-10 h-10 rounded-full text-slate-300 text-xs font-bold
                border-2 border-slate-600/50 transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(180deg,#334155 0%,#1e293b 100%)',
                       boxShadow: '0 3px 6px rgba(0,0,0,0.4)' }}
              title={t.reset}
            >
              ↺
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
