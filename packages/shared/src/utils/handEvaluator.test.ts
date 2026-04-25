import { evaluateHand, compareHands, findWinners } from './handEvaluator.js';
import type { Card } from '../types/card.js';

const c = (rank: string, suit: string): Card => ({ rank: rank as Card['rank'], suit: suit as Card['suit'] });

describe('HandEvaluator', () => {
  describe('hand rankings', () => {
    test('royal flush', () => {
      const result = evaluateHand(
        [c('A', 'spades'), c('K', 'spades')],
        [c('Q', 'spades'), c('J', 'spades'), c('T', 'spades'), c('2', 'hearts'), c('3', 'clubs')]
      );
      expect(result.name).toBe('royal_flush');
    });

    test('straight flush', () => {
      const result = evaluateHand(
        [c('9', 'hearts'), c('8', 'hearts')],
        [c('7', 'hearts'), c('6', 'hearts'), c('5', 'hearts'), c('A', 'clubs'), c('K', 'spades')]
      );
      expect(result.name).toBe('straight_flush');
    });

    test('four of a kind', () => {
      const result = evaluateHand(
        [c('A', 'spades'), c('A', 'hearts')],
        [c('A', 'diamonds'), c('A', 'clubs'), c('K', 'spades'), c('2', 'hearts'), c('3', 'clubs')]
      );
      expect(result.name).toBe('four_of_a_kind');
    });

    test('full house', () => {
      const result = evaluateHand(
        [c('A', 'spades'), c('A', 'hearts')],
        [c('A', 'diamonds'), c('K', 'clubs'), c('K', 'spades'), c('2', 'hearts'), c('3', 'clubs')]
      );
      expect(result.name).toBe('full_house');
    });

    test('flush', () => {
      const result = evaluateHand(
        [c('A', 'hearts'), c('K', 'hearts')],
        [c('Q', 'hearts'), c('J', 'hearts'), c('9', 'hearts'), c('2', 'clubs'), c('3', 'spades')]
      );
      expect(result.name).toBe('flush');
    });

    test('straight', () => {
      const result = evaluateHand(
        [c('A', 'spades'), c('2', 'hearts')],
        [c('3', 'diamonds'), c('4', 'clubs'), c('5', 'spades'), c('K', 'hearts'), c('Q', 'clubs')]
      );
      expect(result.name).toBe('straight');
    });

    test('wheel straight (A-2-3-4-5)', () => {
      const result = evaluateHand(
        [c('A', 'spades'), c('2', 'hearts')],
        [c('3', 'diamonds'), c('4', 'clubs'), c('5', 'spades'), c('9', 'hearts'), c('K', 'clubs')]
      );
      expect(result.name).toBe('straight');
    });

    test('three of a kind', () => {
      const result = evaluateHand(
        [c('A', 'spades'), c('A', 'hearts')],
        [c('A', 'diamonds'), c('K', 'clubs'), c('Q', 'spades'), c('2', 'hearts'), c('3', 'clubs')]
      );
      expect(result.name).toBe('three_of_a_kind');
    });

    test('two pair', () => {
      const result = evaluateHand(
        [c('A', 'spades'), c('A', 'hearts')],
        [c('K', 'diamonds'), c('K', 'clubs'), c('Q', 'spades'), c('2', 'hearts'), c('3', 'clubs')]
      );
      expect(result.name).toBe('two_pair');
    });

    test('one pair', () => {
      const result = evaluateHand(
        [c('A', 'spades'), c('A', 'hearts')],
        [c('K', 'diamonds'), c('Q', 'clubs'), c('J', 'spades'), c('2', 'hearts'), c('3', 'clubs')]
      );
      expect(result.name).toBe('one_pair');
    });

    test('high card', () => {
      const result = evaluateHand(
        [c('A', 'spades'), c('K', 'hearts')],
        [c('Q', 'diamonds'), c('J', 'clubs'), c('9', 'spades'), c('2', 'hearts'), c('4', 'clubs')]
      );
      expect(result.name).toBe('high_card');
    });
  });

  describe('hand comparison', () => {
    test('flush beats straight', () => {
      const flush = evaluateHand(
        [c('A', 'hearts'), c('K', 'hearts')],
        [c('Q', 'hearts'), c('J', 'hearts'), c('9', 'hearts'), c('2', 'clubs'), c('3', 'spades')]
      );
      const straight = evaluateHand(
        [c('A', 'spades'), c('K', 'clubs')],
        [c('Q', 'diamonds'), c('J', 'hearts'), c('T', 'spades'), c('2', 'clubs'), c('4', 'diamonds')]
      );
      expect(compareHands(flush, straight)).toBeGreaterThan(0);
    });

    test('higher pair beats lower pair', () => {
      const aces = evaluateHand(
        [c('A', 'spades'), c('A', 'hearts')],
        [c('K', 'diamonds'), c('Q', 'clubs'), c('J', 'spades'), c('2', 'hearts'), c('3', 'clubs')]
      );
      const kings = evaluateHand(
        [c('K', 'spades'), c('K', 'hearts')],
        [c('A', 'diamonds'), c('Q', 'clubs'), c('J', 'spades'), c('2', 'hearts'), c('3', 'clubs')]
      );
      expect(compareHands(aces, kings)).toBeGreaterThan(0);
    });

    test('kicker breaks tie', () => {
      const aceKing = evaluateHand(
        [c('A', 'spades'), c('A', 'hearts')],
        [c('K', 'diamonds'), c('Q', 'clubs'), c('J', 'spades'), c('2', 'hearts'), c('3', 'clubs')]
      );
      const aceQueen = evaluateHand(
        [c('A', 'diamonds'), c('A', 'clubs')],
        [c('Q', 'spades'), c('J', 'hearts'), c('T', 'diamonds'), c('2', 'spades'), c('3', 'hearts')]
      );
      expect(compareHands(aceKing, aceQueen)).toBeGreaterThan(0);
    });
  });

  describe('findWinners', () => {
    test('returns single winner', () => {
      const flush = evaluateHand(
        [c('A', 'hearts'), c('K', 'hearts')],
        [c('Q', 'hearts'), c('J', 'hearts'), c('9', 'hearts'), c('2', 'clubs'), c('3', 'spades')]
      );
      const straight = evaluateHand(
        [c('A', 'spades'), c('K', 'clubs')],
        [c('Q', 'diamonds'), c('J', 'hearts'), c('T', 'spades'), c('2', 'clubs'), c('4', 'diamonds')]
      );
      const winners = findWinners([
        { playerId: 'p1', handRank: flush },
        { playerId: 'p2', handRank: straight },
      ]);
      expect(winners).toEqual(['p1']);
    });

    test('returns multiple winners on tie', () => {
      // Both have same flush
      const hand1 = evaluateHand(
        [c('A', 'hearts'), c('K', 'hearts')],
        [c('Q', 'hearts'), c('J', 'hearts'), c('9', 'hearts'), c('2', 'clubs'), c('3', 'spades')]
      );
      const hand2 = evaluateHand(
        [c('A', 'diamonds'), c('K', 'diamonds')],
        [c('Q', 'diamonds'), c('J', 'diamonds'), c('9', 'diamonds'), c('2', 'clubs'), c('3', 'spades')]
      );
      const winners = findWinners([
        { playerId: 'p1', handRank: hand1 },
        { playerId: 'p2', handRank: hand2 },
      ]);
      expect(winners).toHaveLength(2);
      expect(winners).toContain('p1');
      expect(winners).toContain('p2');
    });
  });
});
