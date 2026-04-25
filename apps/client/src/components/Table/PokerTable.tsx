/**
 * PokerTable: arranges player seats around an oval table.
 * Up to 9 seats are evenly distributed. Community cards in center.
 */
import { useRef, useEffect, useState } from 'react';
import type { GameState } from '@texas-poker/shared';
import { EVENTS } from '@texas-poker/shared';
import { PlayerSeat } from '../Player/PlayerSeat.js';
import { CommunityCards } from './CommunityCards.js';
import { BetDisplay } from './BetDisplay.js';
import { useVoiceStore } from '../../store/voiceStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { useCountdown } from '../../hooks/useCountdown.js';
import { getSocket } from '../../socket/socketClient.js';

interface Props {
  gameState: GameState;
  onViewBotThoughts?: (botName: string) => void;
}

// Seat positions as percentages of the container [left%, top%]
const SEAT_POSITIONS: [number, number][] = [
  [50, 86],  // 0 - bottom center (raised for better visibility)
  [20, 80],  // 1 - bottom left
  [5, 55],   // 2 - left
  [12, 25],  // 3 - top left
  [35, 8],   // 4 - top left-center
  [65, 8],   // 5 - top right-center
  [88, 25],  // 6 - top right
  [95, 55],  // 7 - right
  [80, 80],  // 8 - bottom right
];

// ── Chat bubble overlay ───────────────────────────────────────────────────────

type BubbleEntry = { content: string; contentType: 'message' | 'emoji'; id: string };

function useChatBubbles(): Map<string, BubbleEntry> {
  const [bubbles, setBubbles] = useState<Map<string, BubbleEntry>>(new Map());

  useEffect(() => {
    const socket = getSocket();
    const handler = (payload: { playerId: string; content: string; contentType: 'message' | 'emoji'; ts: number }) => {
      const { playerId, content, contentType, ts } = payload;
      const id = `${playerId}-${ts}`;
      setBubbles((prev) => {
        const next = new Map(prev);
        next.set(playerId, { content, contentType, id });
        return next;
      });
      const duration = contentType === 'emoji' ? 1800 : 3000;
      setTimeout(() => {
        setBubbles((prev) => {
          const current = prev.get(playerId);
          if (!current || current.id !== id) return prev;
          const next = new Map(prev);
          next.delete(playerId);
          return next;
        });
      }, duration);
    };
    socket.on(EVENTS.GAME_CHAT_BROADCAST, handler);
    return () => { socket.off(EVENTS.GAME_CHAT_BROADCAST, handler); };
  }, []);

  return bubbles;
}

// Per-player sticky bet map: keeps bet visible 800ms after it resets to 0
function useStickyBets(players: GameState['players']): Map<string, number> {
  const stickyRef = useRef<Map<string, number>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    for (const p of players) {
      const prev = stickyRef.current.get(p.id) ?? 0;
      const curr = p.currentBet;
      if (curr > 0) {
        const t = timersRef.current.get(p.id);
        if (t) clearTimeout(t);
        timersRef.current.delete(p.id);
        stickyRef.current.set(p.id, curr);
      } else if (prev > 0 && curr === 0) {
        if (!timersRef.current.has(p.id)) {
          const t = setTimeout(() => {
            stickyRef.current.set(p.id, 0);
            timersRef.current.delete(p.id);
            forceUpdate((n) => n + 1);
          }, 800);
          timersRef.current.set(p.id, t);
        }
      }
    }
  });

  return stickyRef.current;
}

export function PokerTable({ gameState, onViewBotThoughts }: Props) {
  const voiceParticipants = useVoiceStore((s) => s.participants);
  const localMuted = useVoiceStore((s) => s.localMuted);
  const myId = useAuthStore((s) => s.playerId);
  const countdown = useCountdown(gameState.turnDeadlineMs ?? null);
  const denominations = gameState.config.chipDenominations ?? [2, 5, 10, 20, 50];
  const stickyBets = useStickyBets(gameState.players);
  const chatBubbles = useChatBubbles();

  // Winner IDs (only during hand_complete)
  const winnerIds = new Set<string>(
    gameState.phase === 'hand_complete' && gameState.lastHandResult
      ? gameState.lastHandResult.winners.map((w) => w.playerId)
      : []
  );

  return (
    <div className="relative h-full w-full flex items-center justify-center" style={{ background: '#060b18' }}>
      <div
        className="relative w-full max-w-full max-h-full"
        style={{ aspectRatio: '5 / 3' }}
      >
      {/* Wood-grain rail ring */}
      <div className="absolute inset-2 rounded-[50%] table-rail" />

      {/* Felt surface */}
      <div
        className="absolute inset-5 rounded-[50%] table-felt"
        style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.55), inset 0 0 120px rgba(0,0,0,0.28)' }}
      />

      {/* Community cards in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <CommunityCards cards={gameState.communityCards} pot={gameState.pot} denominations={denominations} />
      </div>

      {/* Phase indicator */}
      <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-full mt-2">
        <span
          className="text-gold-400/65 text-[10px] uppercase tracking-[0.25em] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.22)' }}
        >
          {gameState.phase.replace('_', ' ')}
        </span>
      </div>

      {/* Player seats */}
      {gameState.players.map((player) => {
        const pos = SEAT_POSITIONS[player.seatIndex];
        if (!pos) return null;
        const [left, top] = pos;
        const isCurrentTurn = player.seatIndex === gameState.currentPlayerSeatIndex;
        // Keep bet chips consistently on the right side of each player box.
        // Clamp near table edge so right-most seats do not overflow.
        const betPos: [number, number] = [Math.min(left + 5, 94), top];
        const betAmount = stickyBets.get(player.id) ?? 0;

        // Chat bubble position: offset towards table center vertically
        const bubbleEntry = chatBubbles.get(player.id);
        const bubbleTop = top > 50 ? top - 14 : top + 14;

        return (
          <div key={player.id}>
            {/* Player seat */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <PlayerSeat
                player={player}
                isCurrentTurn={isCurrentTurn}
                isDealer={player.seatIndex === gameState.dealerSeatIndex}
                isSB={player.seatIndex === gameState.smallBlindSeatIndex}
                isBB={player.seatIndex === gameState.bigBlindSeatIndex}
                secondsRemaining={isCurrentTurn ? countdown : undefined}
                isSpeaking={!!voiceParticipants[player.id]?.isSpeaking}
                isMuted={
                  player.id === myId
                    ? localMuted
                    : !!voiceParticipants[player.id]?.isMuted
                }
                isWinner={winnerIds.has(player.id)}
                onViewThoughts={
                  player.isBot && onViewBotThoughts
                    ? () => onViewBotThoughts(player.name)
                    : undefined
                }
              />
            </div>

            {/* Bet display — animates on each new bet value */}
            {betAmount > 0 && betPos && (
              <div
                key={`bet-${player.id}-${betAmount}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 animate-chip-slide"
                style={{ left: `${betPos[0]}%`, top: `${betPos[1]}%` }}
              >
                <BetDisplay amount={betAmount} denominations={denominations} />
              </div>
            )}

            {/* Chat bubble / emoji reaction */}
            {bubbleEntry && (
              bubbleEntry.contentType === 'emoji' ? (
                <div
                  key={bubbleEntry.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-emoji-react select-none"
                  style={{ left: `${left}%`, top: `${top}%`, fontSize: '2rem', zIndex: 20 }}
                >
                  {bubbleEntry.content}
                </div>
              ) : (
                <div
                  key={bubbleEntry.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-chat-bubble"
                  style={{ left: `${left}%`, top: `${bubbleTop}%`, zIndex: 20, maxWidth: '160px' }}
                >
                  <div
                    className="relative text-xs text-slate-100 px-2.5 py-1.5 rounded-xl leading-snug text-center"
                    style={{ background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(100,116,139,0.35)' }}
                  >
                    {bubbleEntry.content}
                    {/* Arrow pointing towards seat */}
                    <div style={{
                      position: 'absolute',
                      bottom: top > 50 ? '-6px' : 'auto',
                      top: top > 50 ? 'auto' : '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      ...(top > 50
                        ? { borderTop: '6px solid rgba(15,23,42,0.92)' }
                        : { borderBottom: '6px solid rgba(15,23,42,0.92)' }),
                    }} />
                  </div>
                </div>
              )
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
