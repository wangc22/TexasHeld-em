import type { HandSummary } from '@texas-poker/shared';
import { useLang } from '../../i18n/useLang.js';

interface Props {
  history: HandSummary[];
  onClose: () => void;
}

export function HandHistoryPanel({ history, onClose }: Props) {
  const reversed = [...history].reverse(); // most recent first
  const t = useLang().history;

  return (
    <div className="fixed right-0 top-0 bottom-0 z-40 w-72 bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="font-bold text-white">{t.title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">
          ✕
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {reversed.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">{t.empty}</div>
        ) : (
          reversed.map((hand) => (
            <div key={hand.handNumber} className="px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-400 font-mono">#{hand.handNumber}</span>
                <span className="text-xs text-yellow-500 font-mono">{t.pot(hand.totalPot)}</span>
              </div>
              {hand.winners.map((w, i) => (
                <div key={i} className="text-sm">
                  <span className="text-yellow-300 font-semibold">{w.playerName}</span>
                  <span className="text-gray-400">{t.won}</span>
                  <span className="text-green-400 font-mono">+{w.amount}</span>
                  {w.handRankName && (
                    <span className="text-gray-500 text-xs ml-1">
                      ({w.handRankName.replace(/_/g, ' ')})
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
