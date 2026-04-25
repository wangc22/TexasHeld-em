import type { Card, HandRank } from './card.js';
import type { Player } from './player.js';
import type { ActionRecord } from './action.js';

export type GamePhase =
  | 'waiting'       // not enough players
  | 'pre_flop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'hand_complete';

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface TableConfig {
  maxPlayers: number;       // 2-9
  smallBlind: number;
  bigBlind: number;
  turnTimeoutMs: number;    // default 30000
  minBuyIn: number;
  maxBuyIn: number;
  /** Chip denominations available for betting, e.g. [2, 5, 10, 20, 50] */
  chipDenominations: number[];
  /** Total hands per session; 0 = unlimited */
  maxHands: number;
}

/** Summary of a completed hand stored in handHistory */
export interface HandSummary {
  handNumber: number;
  winners: Array<{ playerName: string; amount: number; handRankName?: string }>;
  totalPot: number;
}

/** Final session rankings emitted when maxHands is reached */
export interface SessionResult {
  rankings: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    finalChipStack: number;
    netGain: number;
  }>;
  totalHands: number;
}

export interface HandResult {
  winners: Array<{
    playerId: string;
    amount: number;
    handRank?: HandRank;
  }>;
  handRanks: Array<{
    playerId: string;
    handRank: HandRank;
    holeCards: [Card, Card];
  }>;
}

export interface GameState {
  tableId: string;
  config: TableConfig;
  phase: GamePhase;
  /** Ordered by seatIndex; use seatIndex to look up a specific seat */
  players: Player[];
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
  /** seatIndex of player whose turn it is (-1 if no one's turn) */
  currentPlayerSeatIndex: number;
  dealerSeatIndex: number;
  smallBlindSeatIndex: number;
  bigBlindSeatIndex: number;
  /** Minimum amount needed to stay in (call this to not fold) */
  currentBetAmount: number;
  minRaise: number;
  handNumber: number;
  actionHistory: ActionRecord[];
  lastAction?: ActionRecord;
  /** UTC ms timestamp when the current player's turn expires */
  turnDeadlineMs?: number;
  lastHandResult?: HandResult;
  /** Whether the host has started the session (locks joining) */
  sessionStarted: boolean;
  /** Number of hands completed in current session */
  sessionHandCount: number;
  /** Player ID of the current host/room-owner */
  hostPlayerId: string | null;
  /** History of completed hands (last 20) */
  handHistory: HandSummary[];
  /** This hand was the last of the session; emit session_complete after all confirm */
  sessionPendingComplete?: boolean;
  /** UTC ms deadline for confirming hand result (auto-confirm when expired) */
  confirmDeadlineMs?: number | null;
  /** Game is paused by host; all timers frozen */
  isPaused?: boolean;
  /** Remaining ms on the current player's turn timer when paused */
  pauseRemainingMs?: number | null;
}
