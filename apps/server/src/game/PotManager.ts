import type { SidePot } from '@texas-poker/shared';

export interface PotContributor {
  playerId: string;
  totalBetThisHand: number;
  folded: boolean;
}

/**
 * Calculate side pots from player contributions.
 *
 * Algorithm:
 * 1. Sort players by their total bet amount (ascending).
 * 2. For each unique bet level, create a pot slice where:
 *    - The amount = (level - previous level) * number of eligible players
 *    - Eligible = players who contributed at least this level (folded players
 *      contribute chips but cannot WIN the pot they can't reach)
 * 3. Folded players contribute chips to pots but are removed from eligible winners.
 */
export function calculateSidePots(contributors: PotContributor[]): SidePot[] {
  if (contributors.length === 0) return [];

  // Only players who contributed at least 1 chip matter
  const active = contributors.filter((c) => c.totalBetThisHand > 0);
  if (active.length === 0) return [];

  // Sort by total bet ascending
  const sorted = [...active].sort((a, b) => a.totalBetThisHand - b.totalBetThisHand);

  const pots: SidePot[] = [];
  let previousLevel = 0;

  for (let i = 0; i < sorted.length; i++) {
    const level = sorted[i].totalBetThisHand;
    if (level === previousLevel) continue; // skip duplicates

    // Number of contributors who reach this level
    const contributing = sorted.slice(i).length + i; // all players with bet >= previous + players from i onward
    // Actually: players who bet >= this level
    const eligible = active.filter((c) => c.totalBetThisHand >= level && !c.folded).map((c) => c.playerId);
    // All players at or above this level contribute to the slice
    const numContributors = active.filter((c) => c.totalBetThisHand >= level).length
      + active.filter((c) => c.totalBetThisHand < level && c.totalBetThisHand > previousLevel).length;

    // Chips in this slice: (level - previousLevel) * number of players who contributed >= previousLevel
    const contributorsToSlice = active.filter((c) => c.totalBetThisHand > previousLevel);
    const sliceAmount = (level - previousLevel) * contributorsToSlice.length;

    if (sliceAmount > 0 && eligible.length > 0) {
      // Merge into last pot if same eligible set, otherwise new pot
      const last = pots[pots.length - 1];
      if (
        last &&
        last.eligiblePlayerIds.length === eligible.length &&
        last.eligiblePlayerIds.every((id) => eligible.includes(id))
      ) {
        last.amount += sliceAmount;
      } else {
        pots.push({ amount: sliceAmount, eligiblePlayerIds: eligible });
      }
    }

    previousLevel = level;
  }

  return pots;
}

/** Sum all pot amounts */
export function totalPot(pots: SidePot[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}
