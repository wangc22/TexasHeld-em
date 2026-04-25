import type { SessionResult } from '@texas-poker/shared';
import { useLang } from '../../i18n/useLang.js';

interface Props {
  result: SessionResult;
  onClose: () => void;
  onLeave: () => void;
}

export function SessionLeaderboard({ result, onClose: _onClose, onLeave }: Props) {
  const medals = ['🥇', '🥈', '🥉'];
  const t = useLang().leaderboard;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up"
        style={{
          background: 'linear-gradient(180deg, #0c1528 0%, #060b18 100%)',
          border: '1px solid rgba(212,160,23,0.28)',
          boxShadow: '0 0 0 1px rgba(212,160,23,0.08), 0 24px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(212,160,23,0.15)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏆</div>
          <h2 className="text-2xl font-bold gold-text tracking-tight">{t.title}</h2>
          <p className="text-slate-500 text-sm mt-1">{t.totalHands(result.totalHands)}</p>
        </div>

        {/* Rankings */}
        <div className="space-y-2 mb-6">
          {result.rankings.map((entry) => {
            const isFirst = entry.rank === 1;
            const medal = medals[entry.rank - 1] ?? `#${entry.rank}`;
            const isPositive = entry.netGain >= 0;

            return (
              <div
                key={entry.playerId}
                className={`flex items-center justify-between rounded-xl px-4 py-3 relative overflow-hidden ${isFirst ? 'card-shimmer' : ''}`}
                style={isFirst
                  ? {
                      background: 'linear-gradient(135deg, rgba(212,160,23,0.18) 0%, rgba(21,32,64,0.92) 50%, rgba(212,160,23,0.12) 100%)',
                      border: '1px solid rgba(212,160,23,0.45)',
                    }
                  : {
                      background: 'rgba(21,32,64,0.5)',
                      border: '1px solid rgba(100,116,139,0.2)',
                    }
                }
              >
                <div className="flex items-center gap-3 relative z-10">
                  <span className="text-xl w-8 text-center">{medal}</span>
                  <div>
                    <div className="font-semibold text-slate-100">{entry.playerName}</div>
                    <div className="text-xs text-slate-400">◆ {entry.finalChipStack.toLocaleString()}</div>
                  </div>
                </div>
                <div className={`text-sm font-bold relative z-10 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{entry.netGain}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onLeave}
          className="w-full py-3 rounded-xl font-bold transition-all active:scale-[0.98] text-navy-950"
          style={{
            background: 'linear-gradient(180deg,#f5c842 0%,#b8860b 100%)',
            boxShadow: '0 4px 16px rgba(212,160,23,0.35)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#fde68a 0%,#d4a017 100%)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(180deg,#f5c842 0%,#b8860b 100%)')}
        >
          {t.returnToLobby}
        </button>
      </div>
    </div>
  );
}
