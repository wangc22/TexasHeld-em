import type { Rank, Suit } from '../types/card.js';

export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

/** Rank numeric value for comparison (2 = 2, T = 10, A = 14) */
export const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export const HAND_RANK_VALUE = {
  high_card: 1,
  one_pair: 2,
  two_pair: 3,
  three_of_a_kind: 4,
  straight: 5,
  flush: 6,
  full_house: 7,
  four_of_a_kind: 8,
  straight_flush: 9,
  royal_flush: 10,
} as const;

export const DEFAULT_TABLE_CONFIG = {
  maxPlayers: 9,
  smallBlind: 10,
  bigBlind: 20,
  turnTimeoutMs: 30_000,
  minBuyIn: 400,   // 20 big blinds
  maxBuyIn: 2000,  // 100 big blinds
  chipDenominations: [2, 5, 10, 20, 50] as number[],
  maxHands: 0,     // 0 = unlimited
} as const;
