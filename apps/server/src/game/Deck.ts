import type { Card } from '@texas-poker/shared';
import { RANKS, SUITS } from '@texas-poker/shared';

export class Deck {
  private cards: Card[];

  constructor() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push({ rank, suit });
      }
    }
  }

  /** Fisher-Yates shuffle */
  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(): Card {
    const card = this.cards.pop();
    if (!card) throw new Error('Deck is empty');
    return card;
  }

  get remaining(): number {
    return this.cards.length;
  }
}
