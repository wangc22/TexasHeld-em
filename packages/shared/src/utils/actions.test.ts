import { describe, it, expect } from 'vitest';
import { computeValidActions } from './actions.js';
import type { Player } from '../types/player.js';

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

describe('computeValidActions', () => {
  it('canCheck when currentBetAmount equals player currentBet', () => {
    const player = makePlayer({ chipStack: 1000, currentBet: 0 });
    const result = computeValidActions(player, 0, 10, 50);
    expect(result.canCheck).toBe(true);
    expect(result.canCall).toBe(false);
  });

  it('canCheck is false when there is a bet to call', () => {
    const player = makePlayer({ chipStack: 1000, currentBet: 0 });
    const result = computeValidActions(player, 20, 10, 50);
    expect(result.canCheck).toBe(false);
  });

  it('canCall when partial call is available and does not require all chips', () => {
    const player = makePlayer({ chipStack: 1000, currentBet: 0 });
    const result = computeValidActions(player, 50, 10, 100);
    expect(result.canCall).toBe(true);
    expect(result.callAmount).toBe(50);
  });

  it('canCall is false when canCheck is true', () => {
    const player = makePlayer({ chipStack: 500, currentBet: 10 });
    const result = computeValidActions(player, 10, 10, 50);
    expect(result.canCheck).toBe(true);
    expect(result.canCall).toBe(false);
  });

  it('callAmount is capped at chipStack when player cannot cover the full bet', () => {
    const player = makePlayer({ chipStack: 30, currentBet: 0 });
    const result = computeValidActions(player, 100, 10, 200);
    expect(result.callAmount).toBe(30);
  });

  it('canRaise is true when player has enough chips above the call', () => {
    const player = makePlayer({ chipStack: 500, currentBet: 0 });
    const result = computeValidActions(player, 20, 20, 100);
    expect(result.canRaise).toBe(true);
  });

  it('canRaise is false when chipStack is less than or equal to the amount to call', () => {
    const player = makePlayer({ chipStack: 15, currentBet: 0 });
    const result = computeValidActions(player, 20, 20, 100);
    expect(result.canRaise).toBe(false);
  });

  it('minRaise and maxRaise have correct boundary values', () => {
    const player = makePlayer({ chipStack: 500, currentBet: 10 });
    const result = computeValidActions(player, 20, 20, 100);
    // minRaise = currentBetAmount(20) + minRaise(20) = 40; but capped at player total = 510
    expect(result.minRaise).toBe(40);
    // maxRaise = chipStack + currentBet = 500 + 10 = 510
    expect(result.maxRaise).toBe(510);
  });

  it('canAllIn is true when chipStack is greater than 0', () => {
    const player = makePlayer({ chipStack: 1 });
    const result = computeValidActions(player, 0, 10, 50);
    expect(result.canAllIn).toBe(true);
  });

  it('canAllIn is false when chipStack is 0', () => {
    const player = makePlayer({ chipStack: 0 });
    const result = computeValidActions(player, 0, 10, 50);
    expect(result.canAllIn).toBe(false);
  });
});
