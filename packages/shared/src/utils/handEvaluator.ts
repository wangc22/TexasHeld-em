/**
 * Hand evaluator for Texas Hold'em.
 * Pure functions, no side effects, no imports from non-shared modules.
 *
 * Approach: enumerate all C(7,5)=21 combinations of 5 cards from 7,
 * score each hand, return the best.
 */
import type { Card, HandRank, HandRankName } from '../types/card.js';
import { RANK_VALUE, HAND_RANK_VALUE } from '../constants/poker.js';

// ─── Internal helpers ────────────────────────────────────────────────────────

function rankVal(card: Card): number {
  return RANK_VALUE[card.rank];
}

function sortDesc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => rankVal(b) - rankVal(a));
}

/** All C(n, k) combinations */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

// ─── 5-card hand scorers ─────────────────────────────────────────────────────

/** Build a score value: category * 10^10 + packed tiebreakers */
function score(category: number, ...tiebreakers: number[]): number {
  // Each tiebreaker fits in 2 decimal digits (ranks 2-14)
  let v = category * 1e10;
  for (let i = 0; i < tiebreakers.length; i++) {
    v += tiebreakers[i] * Math.pow(100, 4 - i);
  }
  return v;
}

function scoreFiveCards(five: Card[]): { name: HandRankName; value: number } {
  const sorted = sortDesc(five);
  const ranks = sorted.map(rankVal);
  const suits = five.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight (including wheel: A-2-3-4-5)
  let isStraight = false;
  let straightHighRank = 0;
  if (
    ranks[0] - ranks[1] === 1 &&
    ranks[1] - ranks[2] === 1 &&
    ranks[2] - ranks[3] === 1 &&
    ranks[3] - ranks[4] === 1
  ) {
    isStraight = true;
    straightHighRank = ranks[0];
  } else if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    // Wheel: A-2-3-4-5, high card is 5
    isStraight = true;
    straightHighRank = 5;
  }

  if (isFlush && isStraight) {
    if (straightHighRank === 14) {
      return { name: 'royal_flush', value: score(HAND_RANK_VALUE.royal_flush) };
    }
    return { name: 'straight_flush', value: score(HAND_RANK_VALUE.straight_flush, straightHighRank) };
  }

  // Count occurrences
  const freq: Record<number, number> = {};
  for (const r of ranks) freq[r] = (freq[r] ?? 0) + 1;
  const counts = Object.entries(freq)
    .map(([r, c]) => ({ rank: Number(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const [top, second] = counts;

  if (top.count === 4) {
    const kicker = counts.find((c) => c.count === 1)!.rank;
    return { name: 'four_of_a_kind', value: score(HAND_RANK_VALUE.four_of_a_kind, top.rank, kicker) };
  }

  if (top.count === 3 && second?.count === 2) {
    return { name: 'full_house', value: score(HAND_RANK_VALUE.full_house, top.rank, second.rank) };
  }

  if (isFlush) {
    return { name: 'flush', value: score(HAND_RANK_VALUE.flush, ...ranks) };
  }

  if (isStraight) {
    return { name: 'straight', value: score(HAND_RANK_VALUE.straight, straightHighRank) };
  }

  if (top.count === 3) {
    const kickers = counts.filter((c) => c.count === 1).map((c) => c.rank);
    return { name: 'three_of_a_kind', value: score(HAND_RANK_VALUE.three_of_a_kind, top.rank, ...kickers) };
  }

  if (top.count === 2 && second?.count === 2) {
    const highPair = Math.max(top.rank, second.rank);
    const lowPair = Math.min(top.rank, second.rank);
    const kicker = counts.find((c) => c.count === 1)!.rank;
    return { name: 'two_pair', value: score(HAND_RANK_VALUE.two_pair, highPair, lowPair, kicker) };
  }

  if (top.count === 2) {
    const kickers = counts.filter((c) => c.count === 1).map((c) => c.rank);
    return { name: 'one_pair', value: score(HAND_RANK_VALUE.one_pair, top.rank, ...kickers) };
  }

  return { name: 'high_card', value: score(HAND_RANK_VALUE.high_card, ...ranks) };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluate the best 5-card hand from up to 7 cards.
 * holeCards: exactly 2
 * communityCards: 0–5
 */
export function evaluateHand(holeCards: [Card, Card], communityCards: Card[]): HandRank {
  const allCards = [...holeCards, ...communityCards];

  if (allCards.length < 5) {
    throw new Error(`evaluateHand requires at least 5 cards, got ${allCards.length}`);
  }

  let bestScore = -Infinity;
  let bestName: HandRankName = 'high_card';
  let bestFive: Card[] = allCards.slice(0, 5);

  for (const five of combinations(allCards, 5)) {
    const { name, value } = scoreFiveCards(five);
    if (value > bestScore) {
      bestScore = value;
      bestName = name;
      bestFive = five;
    }
  }

  return {
    name: bestName,
    value: bestScore,
    bestCards: sortDesc(bestFive),
  };
}

/**
 * Compare two HandRanks. Returns positive if a wins, negative if b wins, 0 for tie.
 */
export function compareHands(a: HandRank, b: HandRank): number {
  return a.value - b.value;
}

/**
 * Given a list of (playerId, HandRank), return arrays of winner IDs.
 * Handles ties (split pot): all players in the winning group are returned.
 */
export function findWinners(hands: Array<{ playerId: string; handRank: HandRank }>): string[] {
  if (hands.length === 0) return [];
  let best = hands[0].handRank.value;
  for (const h of hands) {
    if (h.handRank.value > best) best = h.handRank.value;
  }
  return hands.filter((h) => h.handRank.value === best).map((h) => h.playerId);
}
