import type { Card } from './card.js';

export type PlayerStatus =
  | 'waiting'      // sitting at table but not in current hand
  | 'active'       // in hand, not yet acted this round
  | 'acted'        // has acted this betting round
  | 'all_in'       // all chips in the pot
  | 'folded'       // folded this hand
  | 'sitting_out'; // temporarily sitting out

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  /** 0-8 seat position at the table */
  seatIndex: number;
  chipStack: number;
  /** null when not visible to this client (opponent's cards) */
  holeCards: [Card, Card] | null;
  status: PlayerStatus;
  /** Chips bet in the current betting round */
  currentBet: number;
  /** Total chips committed to pot this hand (for side-pot calculation) */
  totalBetThisHand: number;
  isConnected: boolean;
  /** If disconnected, timestamp when the grace period expires */
  disconnectedAt?: number;
  /** True when player has clicked Ready between hands */
  isReady?: boolean;
  /** Chip count when the player joined the current session (for net gain calc) */
  startingChipStack?: number;
}
