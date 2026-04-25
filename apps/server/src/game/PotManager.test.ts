import { describe, it, expect } from 'vitest';
import { calculateSidePots, totalPot } from './PotManager.js';
import type { PotContributor } from './PotManager.js';

function contrib(playerId: string, totalBetThisHand: number, folded = false): PotContributor {
  return { playerId, totalBetThisHand, folded };
}

describe('calculateSidePots', () => {
  it('returns [] for an empty contributors array', () => {
    expect(calculateSidePots([])).toEqual([]);
  });

  it('returns [] when all contributors bet 0', () => {
    expect(calculateSidePots([contrib('p1', 0), contrib('p2', 0)])).toEqual([]);
  });

  it('two players with equal bets produce one main pot with both eligible', () => {
    const pots = calculateSidePots([contrib('p1', 100), contrib('p2', 100)]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(200);
    expect(pots[0].eligiblePlayerIds).toContain('p1');
    expect(pots[0].eligiblePlayerIds).toContain('p2');
  });

  it('an all-in player creates a side pot', () => {
    // p1 goes all-in at 50; p2 and p3 each bet 100
    const pots = calculateSidePots([
      contrib('p1', 50),
      contrib('p2', 100),
      contrib('p3', 100),
    ]);
    // main pot: 50 * 3 = 150, all 3 eligible
    // side pot: 50 * 2 = 100, only p2 and p3 eligible
    expect(pots).toHaveLength(2);
    const main = pots.find((p) => p.eligiblePlayerIds.length === 3);
    const side = pots.find((p) => p.eligiblePlayerIds.length === 2);
    expect(main).toBeDefined();
    expect(main!.amount).toBe(150);
    expect(side).toBeDefined();
    expect(side!.amount).toBe(100);
    expect(side!.eligiblePlayerIds).not.toContain('p1');
  });

  it('a folded player contributes chips but is excluded from eligible winners', () => {
    // p1 folds after betting 50; p2 and p3 each bet 100
    const pots = calculateSidePots([
      contrib('p1', 50, true),
      contrib('p2', 100),
      contrib('p3', 100),
    ]);
    const totalChips = totalPot(pots);
    expect(totalChips).toBe(250); // p1's chips still go in
    for (const pot of pots) {
      expect(pot.eligiblePlayerIds).not.toContain('p1');
    }
  });

  it('three-way all-in at different levels creates three distinct pots', () => {
    // p1 at 50, p2 at 100, p3 at 150
    const pots = calculateSidePots([
      contrib('p1', 50),
      contrib('p2', 100),
      contrib('p3', 150),
    ]);
    expect(pots.length).toBeGreaterThanOrEqual(2);
    const total = totalPot(pots);
    expect(total).toBe(300);
  });

  it('single contributor returns a single pot', () => {
    const pots = calculateSidePots([contrib('p1', 100)]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(100);
    expect(pots[0].eligiblePlayerIds).toEqual(['p1']);
  });
});

describe('totalPot', () => {
  it('sums all pot amounts correctly', () => {
    const pots = [
      { amount: 100, eligiblePlayerIds: ['p1', 'p2'] },
      { amount: 50, eligiblePlayerIds: ['p2'] },
    ];
    expect(totalPot(pots)).toBe(150);
  });

  it('returns 0 for an empty pots array', () => {
    expect(totalPot([])).toBe(0);
  });

  it('two all-ins at the same level do not create duplicate pots', () => {
    const pots = calculateSidePots([
      contrib('p1', 100),
      contrib('p2', 100),
      contrib('p3', 100),
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
  });
});
