import type { Card } from '@texas-poker/shared';
import { PlayingCard } from '../Card/PlayingCard.js';
import { BetDisplay } from './BetDisplay.js';

interface Props {
  cards: Card[];
  pot: number;
  denominations: number[];
}

export function CommunityCards({ cards, pot, denominations }: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Community cards */}
      <div className="flex gap-2">
        {cards.map((card, i) => (
          <PlayingCard key={i} card={card} />
        ))}
        {/* Empty placeholders */}
        {Array.from({ length: 5 - cards.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-14 h-20 rounded-lg"
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.2)',
            }}
          />
        ))}
      </div>

      {/* Pot */}
      {pot > 0 && (
        <div
          className="rounded-2xl px-3 py-2"
          style={{
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(212,160,23,0.25)',
            boxShadow: '0 0 12px rgba(212,160,23,0.12)',
          }}
        >
          <BetDisplay amount={pot} denominations={denominations} />
        </div>
      )}
    </div>
  );
}
