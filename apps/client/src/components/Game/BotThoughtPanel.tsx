/**
 * BotThoughtPanel: right-side drawer showing AI bot reasoning per action.
 * Supports optional filterBotName to show only one bot's thoughts.
 */
import { useGameStore } from '../../store/gameStore.js';
import { useLang } from '../../i18n/useLang.js';

interface Props {
  onClose: () => void;
  /** If set, only show thoughts from this bot name */
  filterBotName?: string;
}

export function BotThoughtPanel({ onClose, filterBotName }: Props) {
  const botThoughts = useGameStore((s) => s.botThoughts);
  const tBot = useLang().botThought;
  const filtered = filterBotName
    ? botThoughts.filter((t) => t.botName === filterBotName)
    : botThoughts;
  const reversed = [...filtered].reverse();
  const title = filterBotName ? tBot.panelTitle(filterBotName) : tBot.allTitle;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="text-white font-semibold text-sm">{title}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {reversed.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">
            {tBot.empty}
          </div>
        ) : (
          reversed.map((thought, i) => {
            const actionLabel = (tBot.actionLabels as Record<string, string>)[thought.action] ?? thought.action;
            const isRaise = thought.action === 'raise';
            const isAllIn = thought.action === 'all_in';
            const isFold = thought.action === 'fold';
            const actionColor = isFold
              ? 'text-gray-400'
              : isAllIn
              ? 'text-red-400'
              : isRaise
              ? 'text-yellow-300'
              : 'text-green-400';

            return (
              <div
                key={i}
                className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-purple-400 font-semibold">
                    #{thought.handNumber} {thought.botName}
                  </span>
                  <span className={`font-bold ${actionColor}`}>
                    {actionLabel}
                    {isRaise && thought.amount ? ` ${thought.amount}` : ''}
                    {isAllIn && thought.amount ? ` ${thought.amount}` : ''}
                  </span>
                </div>
                <div className="text-gray-300 leading-relaxed">
                  "{thought.reasoning}"
                </div>
                <div className="text-gray-600 mt-1.5 text-right">
                  {new Date(thought.ts).toLocaleTimeString(tBot.locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-600 text-center">
        {tBot.footer(reversed.length, filterBotName)}
      </div>
    </div>
  );
}
