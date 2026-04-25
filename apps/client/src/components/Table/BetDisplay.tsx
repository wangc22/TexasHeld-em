/**
 * BetDisplay: shows a player's current bet as stacked 3D chips.
 */
import { breakdownChips } from '../../utils/chipUtils.js';

interface Props {
  amount: number;
  denominations: number[];
}

export function BetDisplay({ amount, denominations }: Props) {
  if (amount <= 0) return null;

  const stacks = breakdownChips(amount, denominations);

  return (
    <div className="flex items-end gap-1.5 pointer-events-none">
      {stacks.map(({ denom, count, color }) => (
        <div key={denom} className="flex flex-col items-center gap-0">
          <div className="relative" style={{ height: `${10 + count * 5}px`, width: '24px' }}>
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 animate-chip-pop"
                style={{
                  bottom: `${i * 5}px`,
                  height: '12px',
                  borderRadius: '50%',
                  background: `radial-gradient(ellipse at 35% 35%, rgba(255,255,255,0.45) 0%, ${color} 55%)`,
                  boxShadow: `0 3px 5px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.3)`,
                  border: '1px solid rgba(0,0,0,0.5)',
                  animationDelay: `${i * 30}ms`,
                }}
              />
            ))}
            {count >= 5 && (
              <div
                className="absolute -top-4 left-0 right-0 text-center text-white text-[9px] font-bold"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
              >
                ×{count}+
              </div>
            )}
          </div>
          <div className="text-[9px] text-white/60 mt-0.5 font-mono leading-none">{denom}</div>
        </div>
      ))}
      {/* Total amount */}
      <div
        className="text-xs font-bold ml-1 leading-none gold-text"
        style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }}
      >
        {amount}
      </div>
    </div>
  );
}
