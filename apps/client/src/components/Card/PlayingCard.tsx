import type { Card } from '@texas-poker/shared';

interface Props {
  card: Card;
  small?: boolean;
  faceDown?: boolean;
}

const SUIT_SYMBOL: Record<string, string> = {
  spades:   '♠',
  hearts:   '♥',
  diamonds: '♦',
  clubs:    '♣',
};

const SUIT_COLOR: Record<string, string> = {
  spades:   'text-slate-900',
  clubs:    'text-slate-900',
  hearts:   'text-rose-600',
  diamonds: 'text-rose-600',
};

export function PlayingCard({ card, small = false, faceDown = false }: Props) {
  if (faceDown) {
    return (
      <div
        className={`${small ? 'w-8 h-12' : 'w-14 h-20'} rounded-lg shadow-lg relative overflow-hidden`}
        style={{
          background: 'linear-gradient(145deg, #1e3a6e 0%, #0f2450 60%, #162e5e 100%)',
          border: '1px solid rgba(200,169,110,0.3)',
        }}
      >
        {/* Diamond pattern inner */}
        <div
          className="absolute inset-[3px] rounded-md"
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.04) 4px, rgba(255,255,255,0.04) 5px)',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white/15 text-lg select-none">♦</span>
        </div>
      </div>
    );
  }

  const suitSymbol = SUIT_SYMBOL[card.suit] ?? '?';
  const suitColor = SUIT_COLOR[card.suit] ?? 'text-slate-900';
  const rank = card.rank === 'T' ? '10' : card.rank;

  return (
    <div
      className={`${small ? 'w-8 h-12 text-xs' : 'w-14 h-20 text-sm'}
        rounded-lg shadow-lg flex flex-col items-center justify-between p-1 select-none
        ${!small ? 'animate-card-deal' : ''}`}
      style={{
        background: '#fafaf5',
        border: small ? '1px solid rgba(200,169,110,0.4)' : '1px solid rgba(200,169,110,0.6)',
      }}
    >
      <span className={`font-bold leading-none ${suitColor} ${small ? 'text-xs' : 'text-base'}`}>
        {rank}
      </span>
      <span className={`${suitColor} ${small ? 'text-sm' : 'text-2xl'}`}>{suitSymbol}</span>
      <span className={`font-bold leading-none ${suitColor} rotate-180 ${small ? 'text-xs' : 'text-base'}`}>
        {rank}
      </span>
    </div>
  );
}
