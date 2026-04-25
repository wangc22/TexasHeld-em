import { describe, it, expect } from 'vitest';
import { isBettingRoundComplete, getPlayersInOrder, nextPlayerToAct } from './BettingRound.js';
import type { Player } from '@texas-poker/shared';

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: 'p1',
    name: 'Alice',
    chipStack: 1000,
    currentBet: 0,
    totalBetThisHand: 0,
    status: 'active',
    seatIndex: 0,
    isBot: false,
    holeCards: null,
    ...overrides,
  };
}

describe('isBettingRoundComplete', () => {
  it('returns true when only one non-folded player remains', () => {
    const players = [
      makePlayer({ id: 'p1', status: 'active' }),
      makePlayer({ id: 'p2', status: 'folded' }),
    ];
    expect(isBettingRoundComplete(players, 0)).toBe(true);
  });

  it('returns false when an active player has not yet acted', () => {
    const players = [
      makePlayer({ id: 'p1', status: 'active', currentBet: 0 }),
      makePlayer({ id: 'p2', status: 'acted', currentBet: 20 }),
    ];
    expect(isBettingRoundComplete(players, 20)).toBe(false);
  });

  it('returns true when all players have acted and matched the current bet', () => {
    const players = [
      makePlayer({ id: 'p1', status: 'acted', currentBet: 20 }),
      makePlayer({ id: 'p2', status: 'acted', currentBet: 20 }),
    ];
    expect(isBettingRoundComplete(players, 20)).toBe(true);
  });

  it('returns true when all players are all-in', () => {
    const players = [
      makePlayer({ id: 'p1', status: 'all_in', currentBet: 100 }),
      makePlayer({ id: 'p2', status: 'all_in', currentBet: 80 }),
    ];
    expect(isBettingRoundComplete(players, 100)).toBe(true);
  });

  it('returns false when an acted player bet is short of currentBetAmount', () => {
    const players = [
      makePlayer({ id: 'p1', status: 'acted', currentBet: 10 }),
      makePlayer({ id: 'p2', status: 'acted', currentBet: 20 }),
    ];
    expect(isBettingRoundComplete(players, 20)).toBe(false);
  });

  it('returns true in a 4-player game after all players have acted', () => {
    const players = [
      makePlayer({ id: 'p1', status: 'acted', currentBet: 20, seatIndex: 0 }),
      makePlayer({ id: 'p2', status: 'acted', currentBet: 20, seatIndex: 1 }),
      makePlayer({ id: 'p3', status: 'acted', currentBet: 20, seatIndex: 2 }),
      makePlayer({ id: 'p4', status: 'acted', currentBet: 20, seatIndex: 3 }),
    ];
    expect(isBettingRoundComplete(players, 20)).toBe(true);
  });
});

describe('getPlayersInOrder', () => {
  it('wraps around the table correctly', () => {
    const players = [
      makePlayer({ id: 'p0', seatIndex: 0 }),
      makePlayer({ id: 'p2', seatIndex: 2 }),
      makePlayer({ id: 'p4', seatIndex: 4 }),
    ];
    // Start after seat 2 → should get seat 4, then seat 0, then seat 2
    const ordered = getPlayersInOrder(players, 2);
    expect(ordered.map((p) => p.seatIndex)).toEqual([4, 0, 2]);
  });

  it('returns sorted order when startSeatIndex is beyond all seat indices', () => {
    const players = [
      makePlayer({ id: 'p0', seatIndex: 0 }),
      makePlayer({ id: 'p1', seatIndex: 1 }),
    ];
    // startSeatIndex 5 is beyond all seats — falls back to start from index 0
    const ordered = getPlayersInOrder(players, 5);
    expect(ordered.map((p) => p.seatIndex)).toEqual([0, 1]);
  });

  it('preserves ascending seat order within the window', () => {
    const players = [
      makePlayer({ id: 'p1', seatIndex: 1 }),
      makePlayer({ id: 'p3', seatIndex: 3 }),
      makePlayer({ id: 'p5', seatIndex: 5 }),
    ];
    const ordered = getPlayersInOrder(players, 0);
    expect(ordered.map((p) => p.seatIndex)).toEqual([1, 3, 5]);
  });
});

describe('nextPlayerToAct', () => {
  it('returns the first active player with chips', () => {
    const players = [
      makePlayer({ id: 'p1', status: 'active', chipStack: 500 }),
      makePlayer({ id: 'p2', status: 'active', chipStack: 300 }),
    ];
    const next = nextPlayerToAct(players, 0);
    expect(next).not.toBeNull();
    expect(next!.status).toBe('active');
    expect(next!.chipStack).toBeGreaterThan(0);
  });

  it('returns null when no active players remain', () => {
    const players = [
      makePlayer({ id: 'p1', status: 'folded' }),
      makePlayer({ id: 'p2', status: 'acted', currentBet: 20 }),
    ];
    expect(nextPlayerToAct(players, 20)).toBeNull();
  });

  it('does not return all-in players', () => {
    const players = [
      makePlayer({ id: 'p1', status: 'all_in', chipStack: 0 }),
      makePlayer({ id: 'p2', status: 'folded' }),
    ];
    expect(nextPlayerToAct(players, 100)).toBeNull();
  });
});
