import type { Player } from '@texas-poker/shared';
export { computeValidActions } from '@texas-poker/shared';

/**
 * Pure functions for managing a single betting round.
 * No state mutation — returns new values or booleans.
 */

/**
 * Returns whether the betting round is complete.
 *
 * Round ends when:
 * 1. Only one player remains (all others folded).
 * 2. All active (non-folded, non-all-in) players have acted AND
 *    all of them have matched the current bet amount.
 *
 * An all-in player who can no longer raise does NOT need to act again,
 * but their bet may be less than currentBetAmount (they went all-in short).
 */
export function isBettingRoundComplete(players: Player[], currentBetAmount: number): boolean {
  const activePlayers = players.filter(
    (p) => p.status !== 'folded' && p.status !== 'sitting_out'
  );

  if (activePlayers.length <= 1) return true;

  // Players who can still voluntarily act (not all-in)
  const canAct = activePlayers.filter((p) => p.status !== 'all_in');

  if (canAct.length === 0) {
    // Everyone is all-in, round is over
    return true;
  }

  // Every player who can act must have:
  // 1. Already acted (status === 'acted') or is all-in
  // 2. Their currentBet must equal the currentBetAmount (they matched)
  //    OR they are all-in (they can't match, that's fine)
  for (const p of canAct) {
    if (p.status === 'active') {
      // This player has not yet acted this round
      return false;
    }
    // p.status === 'acted'
    if (p.currentBet < currentBetAmount) {
      // They acted but haven't matched the bet — shouldn't happen in normal flow
      // but guard against it
      return false;
    }
  }

  return true;
}

/**
 * Get players in order starting after the given seat index,
 * wrapping around the table.
 */
export function getPlayersInOrder(players: Player[], startSeatIndex: number): Player[] {
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const startIdx = sorted.findIndex((p) => p.seatIndex > startSeatIndex);
  if (startIdx === -1) return sorted;
  return [...sorted.slice(startIdx), ...sorted.slice(0, startIdx)];
}

/**
 * Given the current player list and the seat of the last aggressor,
 * find the next player who still needs to act.
 * Returns null if the round is complete.
 */
export function nextPlayerToAct(players: Player[], currentBetAmount: number): Player | null {
  const toAct = players.find(
    (p) => p.status === 'active' && p.chipStack > 0
  );
  return toAct ?? null;
}
