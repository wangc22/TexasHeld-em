import { describe, it, expect } from 'vitest';
import { Deck } from './Deck.js';
import { RANKS, SUITS } from '@texas-poker/shared';

describe('Deck', () => {
  it('has 52 cards after construction', () => {
    const deck = new Deck();
    expect(deck.remaining).toBe(52);
  });

  it('deal() returns a card and decrements remaining', () => {
    const deck = new Deck();
    const card = deck.deal();
    expect(card).toHaveProperty('rank');
    expect(card).toHaveProperty('suit');
    expect(RANKS).toContain(card.rank);
    expect(SUITS).toContain(card.suit);
    expect(deck.remaining).toBe(51);
  });

  it('deal() on an empty deck throws "Deck is empty"', () => {
    const deck = new Deck();
    for (let i = 0; i < 52; i++) deck.deal();
    expect(() => deck.deal()).toThrow('Deck is empty');
  });

  it('all 52 cards are unique', () => {
    const deck = new Deck();
    const cards = Array.from({ length: 52 }, () => deck.deal());
    const keys = cards.map((c) => `${c.rank}${c.suit}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(52);
  });

  it('contains all 4 suits', () => {
    const deck = new Deck();
    const cards = Array.from({ length: 52 }, () => deck.deal());
    const suits = new Set(cards.map((c) => c.suit));
    expect(suits.size).toBe(4);
    for (const suit of SUITS) expect(suits.has(suit)).toBe(true);
  });

  it('contains all 13 ranks', () => {
    const deck = new Deck();
    const cards = Array.from({ length: 52 }, () => deck.deal());
    const ranks = new Set(cards.map((c) => c.rank));
    expect(ranks.size).toBe(13);
    for (const rank of RANKS) expect(ranks.has(rank)).toBe(true);
  });

  it('shuffle() does not change the card count', () => {
    const deck = new Deck();
    deck.shuffle();
    expect(deck.remaining).toBe(52);
  });

  it('shuffle() changes the deal order', () => {
    const deck1 = new Deck();
    const before = Array.from({ length: 52 }, () => deck1.deal()).map((c) => `${c.rank}${c.suit}`);

    const deck2 = new Deck();
    deck2.shuffle();
    const after = Array.from({ length: 52 }, () => deck2.deal()).map((c) => `${c.rank}${c.suit}`);

    // With 52! possible orders, the chance of an identical sequence is negligible
    expect(before).not.toEqual(after);
  });
});
