import { describe, expect, it } from 'vitest';
import { Deck, shuffle } from './deck';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seeded(1));
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('Deck', () => {
  it('throws on empty input', () => {
    expect(() => new Deck([])).toThrow();
  });

  it('does not repeat until every item was drawn', () => {
    const deck = new Deck(['a', 'b', 'c', 'd'], seeded(42));
    const first = [deck.draw(), deck.draw(), deck.draw(), deck.draw()];
    expect(first.slice().sort()).toEqual(['a', 'b', 'c', 'd']);
    const second = [deck.draw(), deck.draw(), deck.draw(), deck.draw()];
    expect(second.slice().sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('drawMany returns distinct items when the deck is large enough', () => {
    const deck = new Deck([1, 2, 3, 4], seeded(7));
    for (let i = 0; i < 50; i++) {
      expect(new Set(deck.drawMany(3)).size).toBe(3);
    }
  });

  it('drawMany repeats items when the deck is smaller than n', () => {
    const deck = new Deck(['only'], seeded(3));
    expect(deck.drawMany(3)).toEqual(['only', 'only', 'only']);
  });
});
