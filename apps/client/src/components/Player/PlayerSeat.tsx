import { useRef, useEffect, useState } from 'react';
import type { Player } from '@texas-poker/shared';
import { PlayingCard } from '../Card/PlayingCard.js';
import { useAuthStore } from '../../store/authStore.js';
import { useLang } from '../../i18n/useLang.js';

interface Props {
  player: Player;
  isCurrentTurn: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  secondsRemaining?: number;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isWinner?: boolean;
  onViewThoughts?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  active:      'border-slate-500',
  acted:       'border-slate-600/60',
  all_in:      'border-gold-500',
  folded:      'border-slate-700/40 opacity-40',
  waiting:     'border-slate-600/40',
  sitting_out: 'border-slate-700/30 opacity-30',
};

export function PlayerSeat({
  player,
  isCurrentTurn,
  isDealer,
  isSB,
  isBB,
  secondsRemaining,
  isSpeaking,
  isMuted,
  isWinner,
  onViewThoughts,
}: Props) {
  const myId = useAuthStore((s) => s.playerId);
  const isMe = player.id === myId;
  const t = useLang().player;

  const borderColor = isWinner
    ? 'border-gold-400'
    : isCurrentTurn
    ? 'border-gold-300'
    : STATUS_COLORS[player.status] ?? 'border-slate-600';

  // ── Sticky bet display ──────────────────────────────────────────────────────
  const prevBetRef = useRef(player.currentBet);
  const [displayBet, setDisplayBet] = useState(player.currentBet);
  const [betAnimating, setBetAnimating] = useState(false);
  const betFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevBetRef.current;
    const curr = player.currentBet;
    prevBetRef.current = curr;

    if (curr > 0) {
      if (betFadeTimer.current) clearTimeout(betFadeTimer.current);
      setDisplayBet(curr);
      if (curr !== prev) {
        setBetAnimating(true);
        const t = setTimeout(() => setBetAnimating(false), 400);
        return () => clearTimeout(t);
      }
    } else if (prev > 0 && curr === 0) {
      setDisplayBet(prev);
      betFadeTimer.current = setTimeout(() => {
        setDisplayBet(0);
        betFadeTimer.current = null;
      }, 800);
    }
  }, [player.currentBet]);

  // ── Fold animation ──────────────────────────────────────────────────────────
  const prevStatusRef = useRef(player.status);
  const [isFolding, setIsFolding] = useState(false);

  useEffect(() => {
    if (prevStatusRef.current !== 'folded' && player.status === 'folded') {
      setIsFolding(true);
      const t = setTimeout(() => setIsFolding(false), 320);
      return () => clearTimeout(t);
    }
    prevStatusRef.current = player.status;
  }, [player.status]);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Cards */}
      <div className={`flex gap-1 ${isFolding ? 'animate-card-fold' : ''}`}>
        {player.holeCards ? (
          player.holeCards.map((card, i) => (
            <PlayingCard key={i} card={card} small />
          ))
        ) : player.status !== 'folded' && player.status !== 'sitting_out' ? (
          <>
            <PlayingCard card={{ rank: '2', suit: 'spades' }} small faceDown />
            <PlayingCard card={{ rank: '2', suit: 'spades' }} small faceDown />
          </>
        ) : null}
      </div>

      {/* Dealer / SB / BB badges — flow element between cards and info box */}
      {(isDealer || isSB || isBB) && (
        <div className="flex gap-1">
          {isDealer && (
            <span
              className="text-navy-950 text-[10px] font-black rounded-full px-1.5 shadow-sm leading-4"
              style={{ background: 'linear-gradient(180deg, #e2e8f0 0%, #94a3b8 100%)' }}
            >
              D
            </span>
          )}
          {isSB && (
            <span
              className="text-white text-[10px] font-bold rounded-full px-1.5 shadow-sm leading-4"
              style={{ background: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)' }}
            >
              SB
            </span>
          )}
          {isBB && (
            <span
              className="text-white text-[10px] font-bold rounded-full px-1.5 shadow-sm leading-4"
              style={{ background: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)' }}
            >
              BB
            </span>
          )}
        </div>
      )}

      {/* Player info box */}
      <div
        className={`relative border-2 ${borderColor} rounded-lg px-3 py-1.5 min-w-[84px] text-center
          backdrop-blur-sm transition-all duration-200
          ${isWinner ? 'winner-glow' : ''}
          ${isCurrentTurn ? 'outline outline-2 outline-offset-2 outline-gold-400/60' : ''}`}
        style={{ background: 'rgba(12,21,40,0.88)' }}
      >
        {/* Winner crown */}
        {isWinner && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl animate-bounce select-none">
            👑
          </div>
        )}

        {/* Speaking / mute indicator */}
        {isSpeaking ? (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full voice-active" />
        ) : isMuted ? (
          <div className="absolute -top-1 -right-1 text-xs leading-none select-none">🔇</div>
        ) : null}

        {/* Bot indicator */}
        {player.isBot && (
          <span className="text-xs text-purple-400 block">🤖</span>
        )}

        {/* Player name */}
        <div className={`text-sm font-semibold truncate max-w-[100px] ${isMe ? 'gold-text' : 'text-slate-100'}`}>
          {player.name}
          {!player.isConnected && <span className="text-red-400 ml-1">●</span>}
        </div>

        {/* Chip stack */}
        <div className="text-xs text-emerald-400/90 font-mono tracking-tight">
          ◆ {player.chipStack.toLocaleString()}
        </div>

        {/* Current bet */}
        {displayBet > 0 && (
          <div
            className={`text-sm font-bold text-gold-300 transition-transform duration-200 ${betAnimating ? 'scale-125' : 'scale-100'}`}
            style={{ textShadow: '0 0 8px rgba(245,200,66,0.8), 0 1px 3px rgba(0,0,0,0.9)' }}
          >
            +{displayBet}
          </div>
        )}

        {/* Turn countdown */}
        {isCurrentTurn && secondsRemaining != null && secondsRemaining > 0 && (
          <div className={`text-xs font-bold mt-0.5 ${secondsRemaining <= 5 ? 'text-red-400' : 'text-gold-300'}`}>
            {secondsRemaining}s
          </div>
        )}

        {/* Bot thinking */}
        {isCurrentTurn && player.isBot && (
          <div className="text-xs text-purple-300 animate-pulse mt-0.5">{t.thinking}</div>
        )}

        {/* Status labels */}
        {player.status === 'folded' && (
          <div className="text-xs text-slate-500 uppercase tracking-wide">{t.folded}</div>
        )}
        {player.status === 'all_in' && (
          <div className="text-[10px] font-black tracking-widest gold-text uppercase animate-pulse">
            {t.allIn}
          </div>
        )}
      </div>

      {/* Bot thought log button */}
      {player.isBot && onViewThoughts && (
        <button
          onClick={onViewThoughts}
          title={t.viewThoughts(player.name)}
          className="text-[10px] px-2 py-0.5 rounded-full transition-all hover:brightness-125 active:scale-95"
          style={{
            background: 'rgba(109,40,217,0.3)',
            border: '1px solid rgba(139,92,246,0.4)',
            color: '#c4b5fd',
          }}
        >
          {t.thoughtsBtn}
        </button>
      )}
    </div>
  );
}
