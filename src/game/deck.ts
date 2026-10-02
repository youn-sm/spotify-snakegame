export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Draws items in shuffled order; nothing repeats until every item has been drawn once. */
export class Deck<T> {
  private pile: T[] = [];

  constructor(
    private readonly items: readonly T[],
    private readonly rng: Rng = Math.random,
  ) {
    if (items.length === 0) throw new Error('Deck needs at least one item');
  }

  draw(): T {
    if (this.pile.length === 0) this.pile = shuffle(this.items, this.rng);
    return this.pile.pop() as T;
  }

  /** Draws n items, distinct whenever the deck holds at least n items. */
  drawMany(n: number): T[] {
    const batch: T[] = [];
    while (batch.length < n) {
      const item = this.draw();
      if (this.items.length >= n && batch.includes(item)) {
        // Crossed a reshuffle and drew a duplicate: put it back at the bottom.
        this.pile.unshift(item);
        continue;
      }
      batch.push(item);
    }
    return batch;
  }
}
