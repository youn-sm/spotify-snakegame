# Spotify Snake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local browser snake game whose food is songs from a chosen Spotify source; eating a song plays it in full and recolors the background from its cover.

**Architecture:** Vite + TypeScript single-page app with no server. Spotify login via PKCE in the browser, playback via the Web Playback SDK (Premium). Pure, unit-tested modules (`deck`, `engine`, `color`, `tracks`) are kept free of DOM so Vitest runs in Node; DOM modules (`renderer`, `theme`, `ui/*`) are thin and verified manually.

**Tech Stack:** TypeScript 5, Vite, Vitest, Canvas 2D, Spotify Web API + Web Playback SDK.

**Spec:** `docs/superpowers/specs/2026-10-02-spotify-snake-design.md`

Each complete file below is preceded by an HTML comment `<!-- file: path -->`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.example`, `src/vite-env.d.ts`

- [ ] **Step 1: Write config files**

<!-- file: package.json -->
```json
{
  "name": "spotify-snake",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests"
  }
}
```

<!-- file: tsconfig.json -->
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

<!-- file: vite.config.ts -->
```ts
import { defineConfig } from 'vitest/config';

// Spotify only accepts loopback IPs (not "localhost") as http redirect URIs.
export default defineConfig({
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  test: { environment: 'node' },
});
```

<!-- file: .gitignore -->
```
node_modules
dist
.env
.DS_Store
```

<!-- file: .env.example -->
```
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
```

<!-- file: src/vite-env.d.ts -->
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
}
```

- [ ] **Step 2: Install dev dependencies**

Run: `npm install -D vite typescript vitest`
Expected: installs without errors.

- [ ] **Step 3: Verify the toolchain**

Run: `npm test`
Expected: exits 0 ("No test files found").

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + TypeScript + Vitest"
```

---

### Task 2: Shuffle deck

**Files:**
- Create: `src/game/deck.ts`
- Test: `src/game/deck.test.ts`

- [ ] **Step 1: Write the failing test**

<!-- file: src/game/deck.test.ts -->
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/deck.test.ts`
Expected: FAIL — cannot resolve `./deck`.

- [ ] **Step 3: Implement**

<!-- file: src/game/deck.ts -->
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/deck.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/deck.ts src/game/deck.test.ts && git commit -m "feat: add shuffle deck"
```

---

### Task 3: Game engine

**Files:**
- Create: `src/game/engine.ts`
- Test: `src/game/engine.test.ts`

- [ ] **Step 1: Write the failing test**

<!-- file: src/game/engine.test.ts -->
```ts
import { describe, expect, it } from 'vitest';
import { SnakeGame, tickMs, type Point } from './engine';

function makeGame() {
  let n = 0;
  return new SnakeGame<string>({
    cols: 10,
    rows: 10,
    foodCount: 3,
    drawFoods: (count) => Array.from({ length: count }, () => `song${n++}`),
    rng: () => 0,
  });
}

const onSnake = (g: SnakeGame<string>, p: Point) => g.snake.some((s) => s.x === p.x && s.y === p.y);

describe('SnakeGame', () => {
  it('starts ready with a 3-long snake and 3 foods on free cells', () => {
    const g = makeGame();
    expect(g.status).toBe('ready');
    expect(g.snake).toEqual([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }]);
    expect(g.bodyItems).toEqual([null, null, null]);
    expect(g.foods.map((f) => f.item)).toEqual(['song0', 'song1', 'song2']);
    expect(g.foods.every((f) => !onSnake(g, f.pos))).toBe(true);
  });

  it('does not move until the first turn', () => {
    const g = makeGame();
    expect(g.step()).toEqual({ ate: null, died: false });
    expect(g.snake[0]).toEqual({ x: 5, y: 5 });
  });

  it('starts on any key and ignores reversing into the neck', () => {
    const g = makeGame();
    g.foods = [];
    g.turn('left');
    expect(g.status).toBe('running');
    g.step();
    expect(g.snake[0]).toEqual({ x: 6, y: 5 });
    expect(g.snake).toHaveLength(3);
  });

  it('eats a food: grows, records the item behind the head, respawns foods', () => {
    const g = makeGame();
    g.foods = [{ pos: { x: 6, y: 5 }, item: 'hit' }];
    g.turn('right');
    expect(g.step()).toEqual({ ate: 'hit', died: false });
    expect(g.snake).toHaveLength(4);
    expect(g.bodyItems).toEqual([null, 'hit', null, null]);
    expect(g.eaten).toEqual(['hit']);
    expect(g.foods).toHaveLength(3);
    expect(g.foods.every((f) => !onSnake(g, f.pos))).toBe(true);
  });

  it('keeps segment items attached as the snake moves', () => {
    const g = makeGame();
    g.foods = [{ pos: { x: 6, y: 5 }, item: 'hit' }];
    g.turn('right');
    g.step();
    g.foods = [];
    g.step();
    expect(g.snake[1]).toEqual({ x: 6, y: 5 });
    expect(g.bodyItems[1]).toBe('hit');
  });

  it('dies when hitting a wall', () => {
    const g = makeGame();
    g.foods = [];
    g.turn('right');
    for (let i = 0; i < 4; i++) expect(g.step().died).toBe(false);
    expect(g.step()).toEqual({ ate: null, died: true });
    expect(g.status).toBe('over');
  });

  it('dies when hitting its own body', () => {
    const g = makeGame();
    g.foods = [];
    g.snake = [{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 }];
    g.bodyItems = [null, null, null, null, null];
    g.dir = 'down';
    g.turn('left');
    expect(g.step().died).toBe(true);
  });

  it('may move into the cell the tail is leaving', () => {
    const g = makeGame();
    g.foods = [];
    g.snake = [{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 5 }];
    g.bodyItems = [null, null, null, null];
    g.dir = 'down';
    g.turn('left');
    expect(g.step().died).toBe(false);
    expect(g.snake[0]).toEqual({ x: 4, y: 5 });
  });
});

describe('tickMs', () => {
  it('speeds up per track eaten down to a floor', () => {
    expect(tickMs(0)).toBe(150);
    expect(tickMs(10)).toBe(100);
    expect(tickMs(100)).toBe(70);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/engine.test.ts`
Expected: FAIL — cannot resolve `./engine`.

- [ ] **Step 3: Implement**

<!-- file: src/game/engine.ts -->
```ts
import type { Rng } from './deck';

export interface Point {
  x: number;
  y: number;
}
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Status = 'ready' | 'running' | 'over';

export interface Food<T> {
  pos: Point;
  item: T;
}

export interface StepResult<T> {
  ate: T | null;
  died: boolean;
}

export interface GameConfig<T> {
  cols: number;
  rows: number;
  foodCount: number;
  drawFoods: (n: number) => T[];
  rng?: Rng;
}

export const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function tickMs(eatenCount: number): number {
  return Math.max(70, 150 - 5 * eatenCount);
}

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export class SnakeGame<T> {
  /** Head first. */
  snake: Point[];
  /** Item shown on each segment, aligned with `snake`. The head's entry is null. */
  bodyItems: (T | null)[];
  foods: Food<T>[] = [];
  eaten: T[] = [];
  status: Status = 'ready';
  dir: Direction = 'right';
  private queuedDir: Direction = 'right';
  private readonly rng: Rng;

  constructor(private readonly cfg: GameConfig<T>) {
    this.rng = cfg.rng ?? Math.random;
    const cx = Math.floor(cfg.cols / 2);
    const cy = Math.floor(cfg.rows / 2);
    this.snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
    this.bodyItems = [null, null, null];
    this.spawnFoods();
  }

  /** Queues a turn for the next step. Any key starts a ready game; reversing is ignored. */
  turn(d: Direction): void {
    if (this.status === 'over') return;
    if (this.status === 'ready') this.status = 'running';
    if (d !== OPPOSITE[this.dir]) this.queuedDir = d;
  }

  step(): StepResult<T> {
    if (this.status !== 'running') return { ate: null, died: false };
    this.dir = this.queuedDir;
    const head = this.snake[0];
    const next = { x: head.x + DELTA[this.dir].x, y: head.y + DELTA[this.dir].y };
    const foodIndex = this.foods.findIndex((f) => samePoint(f.pos, next));
    const growing = foodIndex !== -1;
    // The tail vacates its cell this step unless we grow.
    const body = growing ? this.snake : this.snake.slice(0, -1);
    if (!this.inBounds(next) || body.some((p) => samePoint(p, next))) {
      this.status = 'over';
      return { ate: null, died: true };
    }
    this.snake.unshift(next);
    if (!growing) {
      this.snake.pop();
      return { ate: null, died: false };
    }
    const item = this.foods[foodIndex].item;
    this.bodyItems.splice(1, 0, item);
    this.eaten.push(item);
    this.spawnFoods();
    return { ate: item, died: false };
  }

  private inBounds(p: Point): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.cfg.cols && p.y < this.cfg.rows;
  }

  private spawnFoods(): void {
    const free: Point[] = [];
    for (let y = 0; y < this.cfg.rows; y++) {
      for (let x = 0; x < this.cfg.cols; x++) {
        if (!this.snake.some((p) => p.x === x && p.y === y)) free.push({ x, y });
      }
    }
    this.foods = [];
    for (const item of this.cfg.drawFoods(this.cfg.foodCount)) {
      if (free.length === 0) break;
      const [pos] = free.splice(Math.floor(this.rng() * free.length), 1);
      this.foods.push({ pos, item });
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/engine.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/engine.ts src/game/engine.test.ts && git commit -m "feat: add snake game engine"
```

---

### Task 4: Palette extraction

**Files:**
- Create: `src/color.ts`
- Test: `src/color.test.ts`

- [ ] **Step 1: Write the failing test**

<!-- file: src/color.test.ts -->
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE, extractPalette } from './color';

function pixels(...runs: [number[], number][]): Uint8ClampedArray {
  const out: number[] = [];
  for (const [rgba, count] of runs) for (let i = 0; i < count; i++) out.push(...rgba);
  return new Uint8ClampedArray(out);
}

describe('extractPalette', () => {
  it('ranks colors by frequency and pads to three', () => {
    const data = pixels([[255, 0, 0, 255], 70], [[0, 0, 255, 255], 30]);
    expect(extractPalette(data)).toEqual(['#ff0000', '#0000ff', '#0000ff']);
  });

  it('skips colors too close to one already picked', () => {
    const data = pixels([[255, 0, 0, 255], 50], [[200, 0, 0, 255], 40], [[0, 255, 0, 255], 10]);
    expect(extractPalette(data)).toEqual(['#ff0000', '#00ff00', '#00ff00']);
  });

  it('ignores transparent pixels', () => {
    const data = pixels([[0, 0, 0, 0], 100], [[255, 255, 255, 255], 1]);
    expect(extractPalette(data)[0]).toBe('#ffffff');
  });

  it('falls back to the default palette for empty input', () => {
    expect(extractPalette(new Uint8ClampedArray())).toEqual(DEFAULT_PALETTE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/color.test.ts`
Expected: FAIL — cannot resolve `./color`.

- [ ] **Step 3: Implement**

<!-- file: src/color.ts -->
```ts
export type Palette = [string, string, string];
export const DEFAULT_PALETTE: Palette = ['#1db954', '#191414', '#535353'];

type Rgb = readonly [number, number, number];

const MIN_DISTANCE = 60;

/** Picks up to 3 dominant, mutually distinct colors from RGBA pixel data. */
export function extractPalette(data: Uint8ClampedArray): Palette {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n++;
    buckets.set(key, bucket);
  }

  const ranked: Rgb[] = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((c) => [c.r / c.n, c.g / c.n, c.b / c.n]);

  const picked: Rgb[] = [];
  for (const c of ranked) {
    if (picked.every((p) => distance(p, c) > MIN_DISTANCE)) picked.push(c);
    if (picked.length === 3) break;
  }
  if (picked.length === 0) return DEFAULT_PALETTE;

  const hex = picked.map(toHex);
  while (hex.length < 3) hex.push(hex[hex.length - 1]);
  return [hex[0], hex[1], hex[2]];
}

function distance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function toHex(c: Rgb): string {
  return '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/color.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/color.ts src/color.test.ts && git commit -m "feat: add dominant color extraction"
```

---

### Task 5: Track mapping helpers

**Files:**
- Create: `src/types.ts`, `src/spotify/tracks.ts`
- Test: `src/spotify/tracks.test.ts`

- [ ] **Step 1: Write shared types**

<!-- file: src/types.ts -->
```ts
export interface Track {
  id: string;
  uri: string;
  name: string;
  artists: string;
  albumName: string;
  /** ~64px cover for board tiles. */
  coverUrl: string;
  /** ~640px cover for the background and now-playing panel. */
  coverLargeUrl: string;
}

export type SourceKind = 'album' | 'artist' | 'playlist' | 'liked';

export interface Source {
  kind: SourceKind;
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
}
```

- [ ] **Step 2: Write the failing test**

<!-- file: src/spotify/tracks.test.ts -->
```ts
import { describe, expect, it } from 'vitest';
import type { Track } from '../types';
import { dedupeByName, pickImage, toTrack, type RawAlbum, type RawTrack } from './tracks';

const images = [
  { url: 'big', width: 640, height: 640 },
  { url: 'mid', width: 300, height: 300 },
  { url: 'small', width: 64, height: 64 },
];
const album: RawAlbum = { id: 'al', name: 'Album', images };
const raw = (over: Partial<RawTrack> = {}): RawTrack => ({
  id: 't1',
  uri: 'spotify:track:t1',
  name: 'Song',
  type: 'track',
  artists: [{ name: 'A' }, { name: 'B' }],
  album,
  ...over,
});

describe('pickImage', () => {
  it('picks the smallest image at least minWidth wide', () => {
    expect(pickImage(images, 64)).toBe('small');
    expect(pickImage(images, 200)).toBe('mid');
  });
  it('falls back to the largest when none is wide enough', () => {
    expect(pickImage(images, 1000)).toBe('big');
  });
  it('handles missing sizes and empty lists', () => {
    expect(pickImage([{ url: 'x', width: null, height: null }], 64)).toBe('x');
    expect(pickImage([], 64)).toBe('');
    expect(pickImage(undefined, 64)).toBe('');
  });
});

describe('toTrack', () => {
  it('maps a playable track', () => {
    expect(toTrack(raw())).toEqual({
      id: 't1',
      uri: 'spotify:track:t1',
      name: 'Song',
      artists: 'A, B',
      albumName: 'Album',
      coverUrl: 'small',
      coverLargeUrl: 'big',
    });
  });
  it('uses the fallback album for simplified album tracks', () => {
    expect(toTrack(raw({ album: undefined }), album)?.coverUrl).toBe('small');
  });
  it('rejects unplayable entries', () => {
    expect(toTrack(null)).toBeNull();
    expect(toTrack(raw({ is_local: true }))).toBeNull();
    expect(toTrack(raw({ is_playable: false }))).toBeNull();
    expect(toTrack(raw({ type: 'episode' }))).toBeNull();
    expect(toTrack(raw({ id: null }))).toBeNull();
  });
});

describe('dedupeByName', () => {
  it('keeps the first track of each case-insensitive name', () => {
    const t = (id: string, name: string) => ({ id, name }) as Track;
    expect(dedupeByName([t('1', 'Hello'), t('2', 'hello '), t('3', 'Bye')]).map((x) => x.id)).toEqual([
      '1',
      '3',
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/spotify/tracks.test.ts`
Expected: FAIL — cannot resolve `./tracks`.

- [ ] **Step 4: Implement**

<!-- file: src/spotify/tracks.ts -->
```ts
import type { Track } from '../types';

export interface RawImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface RawAlbum {
  id: string;
  name: string;
  images: RawImage[];
}

export interface RawTrack {
  id: string | null;
  uri: string;
  name: string;
  type?: string;
  is_local?: boolean;
  is_playable?: boolean;
  artists: { name: string }[];
  album?: RawAlbum;
}

/** Smallest image at least `minWidth` wide, else the largest available. */
export function pickImage(images: RawImage[] | undefined, minWidth: number): string {
  if (!images || images.length === 0) return '';
  const sized = images.filter((i) => i.width != null).sort((a, b) => a.width! - b.width!);
  const match = sized.find((i) => i.width! >= minWidth);
  return (match ?? sized[sized.length - 1] ?? images[0]).url;
}

/** Converts a Spotify track object to a Track, or null when it can't be played. */
export function toTrack(raw: RawTrack | null | undefined, album?: RawAlbum): Track | null {
  if (!raw || !raw.id || raw.is_local || raw.is_playable === false) return null;
  if (raw.type && raw.type !== 'track') return null;
  const a = raw.album ?? album;
  return {
    id: raw.id,
    uri: raw.uri,
    name: raw.name,
    artists: raw.artists.map((x) => x.name).join(', '),
    albumName: a?.name ?? '',
    coverUrl: pickImage(a?.images, 64),
    coverLargeUrl: pickImage(a?.images, 600),
  };
}

/** Drops tracks whose case-insensitive name already appeared, keeping the first. */
export function dedupeByName(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    const key = t.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/spotify/tracks.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/spotify/tracks.ts src/spotify/tracks.test.ts && git commit -m "feat: add Spotify track mapping helpers"
```

---

### Task 6: PKCE auth

**Files:**
- Create: `src/auth.ts`

- [ ] **Step 1: Implement**

<!-- file: src/auth.ts -->
```ts
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';
const REDIRECT_URI = `${window.location.origin}/callback`;
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
].join(' ');
const TOKEN_KEY = 'spotify-snake.token';
const VERIFIER_KEY = 'spotify-snake.verifier';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class AuthError extends Error {
  constructor(message = 'Spotify 로그인이 필요해요') {
    super(message);
    this.name = 'AuthError';
  }
}

export function hasClientId(): boolean {
  return CLIENT_ID.length > 0;
}

export function isLoggedIn(): boolean {
  return readToken() !== null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(): Promise<void> {
  const verifier = randomString(64);
  localStorage.setItem(VERIFIER_KEY, verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: await sha256Base64Url(verifier),
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

/** Finishes the Spotify redirect when the page was opened on /callback. */
export async function handleCallback(): Promise<void> {
  if (window.location.pathname !== '/callback') return;
  const params = new URLSearchParams(window.location.search);
  window.history.replaceState(null, '', '/');
  const error = params.get('error');
  if (error) throw new AuthError(`Spotify 로그인이 취소되었거나 실패했어요 (${error})`);
  const code = params.get('code');
  const verifier = localStorage.getItem(VERIFIER_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  if (!code || !verifier) throw new AuthError('로그인 정보가 없어요. 다시 시도해주세요.');
  await requestToken({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier });
}

export async function getAccessToken(): Promise<string> {
  const token = readToken();
  if (!token) throw new AuthError();
  if (Date.now() < token.expiresAt - 60_000) return token.accessToken;
  await refresh();
  return readToken()!.accessToken;
}

let refreshing: Promise<void> | null = null;

/** Refreshes the access token; concurrent callers share one request. */
export function refresh(): Promise<void> {
  const token = readToken();
  if (!token) return Promise.reject(new AuthError());
  refreshing ??= requestToken({ grant_type: 'refresh_token', refresh_token: token.refreshToken })
    .catch(() => {
      logout();
      throw new AuthError('로그인이 만료됐어요. 다시 로그인해주세요.');
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function requestToken(body: Record<string, string>): Promise<void> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  });
  if (!res.ok) throw new AuthError(`토큰 요청에 실패했어요 (${res.status})`);
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  writeToken({
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? readToken()?.refreshToken ?? '',
    expiresAt: Date.now() + json.expires_in * 1000,
  });
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

function writeToken(token: StoredToken): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/auth.ts && git commit -m "feat: add Spotify PKCE auth"
```

---

### Task 7: Web API client

**Files:**
- Create: `src/spotify/api.ts`

- [ ] **Step 1: Implement**

<!-- file: src/spotify/api.ts -->
```ts
import { getAccessToken, refresh } from '../auth';
import type { Source, Track } from '../types';
import { dedupeByName, pickImage, toTrack, type RawAlbum, type RawImage, type RawTrack } from './tracks';

const BASE = 'https://api.spotify.com/v1';
const MAX_TRACKS = 500;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Page<T> {
  items: T[];
  next: string | null;
}

interface RawSimpleAlbum extends RawAlbum {
  artists: { name: string }[];
  release_date?: string;
}

interface RawArtist {
  id: string;
  name: string;
  images?: RawImage[];
}

interface RawPlaylist {
  id: string;
  name: string;
  images: RawImage[] | null;
  owner: { id: string };
  collaborative: boolean;
  // Renamed from `tracks` in the Feb 2026 API changes; read both.
  items?: { total: number };
  tracks?: { total: number };
}

export async function request<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await getAccessToken()}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && attempt === 0) {
    await refresh();
    return request(path, init, 1);
  }
  if (res.status === 429 && attempt === 0) {
    const wait = Number(res.headers.get('Retry-After') ?? '1');
    await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
    return request(path, init, 1);
  }
  if (!res.ok) throw new ApiError(res.status, `Spotify API 오류 ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function collect<T>(firstPath: string, max: number): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = firstPath;
  while (next && out.length < max) {
    const page: Page<T> = await request<Page<T>>(next);
    out.push(...page.items);
    next = page.next;
  }
  return out;
}

const nonNull = <T>(x: T | null | undefined): x is T => x != null;

function albumSource(a: RawSimpleAlbum): Source {
  const year = a.release_date?.slice(0, 4);
  return {
    kind: 'album',
    id: a.id,
    name: a.name,
    subtitle: [a.artists.map((x) => x.name).join(', '), year].filter(Boolean).join(' · '),
    imageUrl: pickImage(a.images, 300),
  };
}

function artistSource(a: RawArtist): Source {
  return { kind: 'artist', id: a.id, name: a.name, subtitle: '아티스트', imageUrl: pickImage(a.images, 300) };
}

export const LIKED_SOURCE: Source = {
  kind: 'liked',
  id: 'liked',
  name: '좋아요 표시한 곡',
  subtitle: '내 라이브러리',
  imageUrl: '',
};

export async function searchSources(query: string, type: 'album' | 'artist'): Promise<Source[]> {
  const q = new URLSearchParams({ q: query, type, limit: '10' });
  const res = await request<{ albums?: Page<RawSimpleAlbum | null>; artists?: Page<RawArtist | null> }>(
    `/search?${q}`,
  );
  if (type === 'album') return (res.albums?.items ?? []).filter(nonNull).map(albumSource);
  return (res.artists?.items ?? []).filter(nonNull).map(artistSource);
}

/** Playlists the user owns or collaborates on — the only ones whose items the API returns. */
export async function myPlaylists(): Promise<Source[]> {
  const me = await request<{ id: string }>('/me');
  const lists = await collect<RawPlaylist | null>('/me/playlists?limit=50', 200);
  return lists
    .filter(nonNull)
    .filter((p) => p.owner.id === me.id || p.collaborative)
    .map((p) => ({
      kind: 'playlist' as const,
      id: p.id,
      name: p.name,
      subtitle: `플레이리스트 · ${(p.items ?? p.tracks)?.total ?? 0}곡`,
      imageUrl: pickImage(p.images ?? [], 300),
    }));
}

export async function savedAlbums(): Promise<Source[]> {
  const saved = await collect<{ album: RawSimpleAlbum }>('/me/albums?limit=50', 200);
  return saved.map((s) => albumSource(s.album));
}

export async function loadTracks(source: Source): Promise<Track[]> {
  switch (source.kind) {
    case 'album':
      return albumTracks(source.id);
    case 'playlist': {
      const entries = await collect<{ item?: RawTrack | null; track?: RawTrack | null }>(
        `/playlists/${source.id}/items?limit=50&market=from_token`,
        MAX_TRACKS,
      );
      return entries.map((e) => toTrack(e.item ?? e.track)).filter(nonNull);
    }
    case 'liked': {
      const entries = await collect<{ track: RawTrack }>('/me/tracks?limit=50&market=from_token', MAX_TRACKS);
      return entries.map((e) => toTrack(e.track)).filter(nonNull);
    }
    case 'artist': {
      // Artist top-tracks was removed for Dev Mode apps; gather from recent albums/singles instead.
      const albums = await collect<RawSimpleAlbum>(
        `/artists/${source.id}/albums?include_groups=album,single&limit=10&market=from_token`,
        10,
      );
      const lists = await Promise.all(albums.slice(0, 10).map((a) => albumTracks(a.id)));
      return dedupeByName(lists.flat());
    }
  }
}

async function albumTracks(id: string): Promise<Track[]> {
  const album = await request<RawAlbum & { tracks: Page<RawTrack> }>(`/albums/${id}?market=from_token`);
  const rest = album.tracks.next ? await collect<RawTrack>(album.tracks.next, MAX_TRACKS) : [];
  return [...album.tracks.items, ...rest].map((t) => toTrack(t, album)).filter(nonNull);
}

export function transferPlayback(deviceId: string): Promise<void> {
  return request<void>('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }) });
}

export function playTrack(deviceId: string, uri: string): Promise<void> {
  return request<void>(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [uri] }),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/spotify/api.ts && git commit -m "feat: add Spotify Web API client"
```

---

### Task 8: Web Playback SDK wrapper

**Files:**
- Create: `src/spotify/sdk.d.ts`, `src/spotify/player.ts`

- [ ] **Step 1: Declare the SDK types we use**

<!-- file: src/spotify/sdk.d.ts -->
```ts
declare namespace Spotify {
  interface PlayerInit {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }
  interface WebPlaybackError {
    message: string;
  }
  interface ReadyEvent {
    device_id: string;
  }
  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    activateElement(): Promise<void>;
    addListener(event: 'ready' | 'not_ready', cb: (e: ReadyEvent) => void): boolean;
    addListener(
      event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
      cb: (e: WebPlaybackError) => void,
    ): boolean;
  }
  const Player: { new (init: PlayerInit): Player };
}

interface Window {
  onSpotifyWebPlaybackSDKReady?: () => void;
}
```

- [ ] **Step 2: Implement the wrapper**

<!-- file: src/spotify/player.ts -->
```ts
import { getAccessToken } from '../auth';
import { playTrack, transferPlayback } from './api';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

export type PlayerState = 'connecting' | 'ready' | 'error';

/** This browser tab as a Spotify Connect device. */
export class Player {
  state: PlayerState = 'connecting';
  error = '';
  private deviceId: string | null = null;
  private sdk: Spotify.Player | null = null;
  private readonly listeners = new Set<() => void>();

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async connect(): Promise<void> {
    try {
      await loadSdk();
      const sdk = new Spotify.Player({
        name: 'Spotify Snake',
        volume: 0.8,
        getOAuthToken: (cb) => {
          getAccessToken().then(cb, () => this.fail('로그인이 만료됐어요. 다시 로그인해주세요.'));
        },
      });
      sdk.addListener('ready', ({ device_id }) => {
        this.deviceId = device_id;
        transferPlayback(device_id).catch(() => {});
        this.setState('ready');
      });
      sdk.addListener('not_ready', () => this.setState('connecting'));
      sdk.addListener('initialization_error', (e) => this.fail(`플레이어 초기화 실패: ${e.message}`));
      sdk.addListener('authentication_error', (e) => this.fail(`Spotify 인증 오류: ${e.message}`));
      sdk.addListener('account_error', () => this.fail('Spotify Premium 계정이 필요해요'));
      sdk.addListener('playback_error', (e) => console.warn('playback_error', e.message));
      this.sdk = sdk;
      if (!(await sdk.connect())) this.fail('Spotify 플레이어에 연결하지 못했어요');
    } catch (e) {
      this.fail(e instanceof Error ? e.message : String(e));
    }
  }

  /** Call from a user gesture so the browser allows audio output. */
  activate(): void {
    this.sdk?.activateElement().catch(() => {});
  }

  async play(uri: string): Promise<void> {
    if (!this.deviceId) throw new Error('플레이어가 아직 준비되지 않았어요');
    await playTrack(this.deviceId, uri);
  }

  disconnect(): void {
    this.sdk?.disconnect();
    this.listeners.clear();
  }

  private setState(state: PlayerState): void {
    this.state = state;
    this.listeners.forEach((cb) => cb());
  }

  private fail(message: string): void {
    this.error = message;
    this.setState('error');
  }
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  sdkPromise ??= new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onerror = () => reject(new Error('Spotify SDK를 불러오지 못했어요'));
    document.head.appendChild(script);
  });
  return sdkPromise;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/spotify/sdk.d.ts src/spotify/player.ts && git commit -m "feat: add Web Playback SDK wrapper"
```

---

### Task 9: Page shell, styles, theme, DOM helpers

**Files:**
- Create: `index.html`, `src/style.css`, `src/theme.ts`, `src/ui/dom.ts`, `src/ui/toast.ts`

- [ ] **Step 1: Write the page shell and styles**

<!-- file: index.html -->
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Spotify Snake</title>
  </head>
  <body>
    <div id="bg-0" class="bg-layer visible"></div>
    <div id="bg-1" class="bg-layer"></div>
    <main id="app"></main>
    <div id="toast" role="status"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

<!-- file: src/style.css -->
```css
:root {
  --accent: #1db954;
  --text: #fff;
  --muted: rgba(255, 255, 255, 0.65);
  --panel: rgba(0, 0, 0, 0.4);
  font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', system-ui, sans-serif;
  color: var(--text);
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: #0b0b0b; }
body { min-height: 100vh; }

.bg-layer {
  position: fixed; inset: 0; z-index: 0; overflow: hidden; opacity: 0;
  transition: opacity 1.2s ease;
  background: linear-gradient(135deg, var(--c1, #1db954), var(--c2, #191414) 55%, var(--c3, #535353));
}
.bg-layer::before {
  content: ''; position: absolute; inset: -80px;
  background: var(--img, none) center / cover no-repeat;
  filter: blur(48px) saturate(1.3); opacity: 0.6;
}
.bg-layer::after { content: ''; position: absolute; inset: 0; background: rgba(0, 0, 0, 0.35); }
.bg-layer.visible { opacity: 1; }

#app { position: relative; z-index: 1; min-height: 100vh; }
.screen { max-width: 1100px; margin: 0 auto; padding: 32px 16px; }
.screen.center {
  min-height: 100vh; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; gap: 12px;
}
.logo { font-size: clamp(36px, 7vw, 64px); margin: 0; letter-spacing: -0.02em; }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.error { color: #ff8a80; }
h2 { font-size: 20px; margin: 8px 0 12px; }

.btn {
  border: 0; border-radius: 999px; padding: 12px 24px; font: inherit; font-weight: 700;
  cursor: pointer; color: var(--text); background: rgba(255, 255, 255, 0.12);
}
.btn.primary { background: var(--accent); color: #000; }
.btn.ghost { background: transparent; border: 1px solid rgba(255, 255, 255, 0.3); }
.btn:hover { filter: brightness(1.1); }
.actions { display: flex; gap: 12px; margin-top: 8px; }

.top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.top h1 { margin: 0; font-size: 28px; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tab, .chip {
  border: 0; font: inherit; cursor: pointer; color: var(--text);
  background: rgba(255, 255, 255, 0.08); border-radius: 999px; padding: 8px 16px;
}
.tab.active, .chip.active { background: var(--text); color: #000; }
.search-bar { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.search-bar[hidden] { display: none; }
.search {
  flex: 1; min-width: 200px; padding: 12px 16px; border-radius: 999px; border: 0;
  font: inherit; background: rgba(255, 255, 255, 0.12); color: var(--text); outline: none;
}

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
.card {
  display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 12px;
  border: 0; border-radius: 12px; background: var(--panel); color: var(--text); font: inherit;
  cursor: pointer; transition: transform 0.15s, background 0.15s; min-width: 0;
}
.card:hover { transform: translateY(-2px); background: rgba(255, 255, 255, 0.12); }
.card img, .card .placeholder { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; }
.card.round img { border-radius: 50%; }
.card .placeholder {
  display: grid; place-items: center; font-size: 48px;
  background: linear-gradient(135deg, #450af5, #c4efd9);
}
.card strong, .card span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card span { font-size: 13px; }

.game { display: flex; gap: 24px; align-items: center; justify-content: center; min-height: 100vh; }
.board-wrap { position: relative; flex: 0 1 min(82vh, 720px); min-width: 0; }
.board { display: block; width: 100%; aspect-ratio: 1; }
.overlay {
  position: absolute; inset: 0; display: grid; place-items: center; padding: 24px;
  font-size: 22px; font-weight: 700; text-align: center; pointer-events: none;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
}
.overlay[hidden] { display: none; }
.panel {
  width: 240px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; padding: 20px;
  border-radius: 16px; background: var(--panel); backdrop-filter: blur(12px);
}
.label { font-size: 11px; letter-spacing: 0.12em; color: var(--muted); margin-top: 8px; }
.score { font-size: 48px; font-weight: 800; line-height: 1; }
.now-cover { width: 100%; aspect-ratio: 1; border-radius: 8px; object-fit: cover; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5); }
.now-cover[hidden] { display: none; }

.history { list-style: none; padding: 0; margin: 8px 0; max-height: 50vh; overflow: auto; width: min(480px, 100%); text-align: left; }
.track-row { display: flex; gap: 12px; align-items: center; padding: 8px; border-radius: 8px; background: var(--panel); margin-bottom: 6px; }
.track-row img { width: 44px; height: 44px; border-radius: 4px; flex-shrink: 0; }
.track-row div { display: flex; flex-direction: column; min-width: 0; }
.track-row strong, .track-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

#toast {
  position: fixed; left: 50%; bottom: 24px; z-index: 10; max-width: 90vw;
  transform: translate(-50%, 20px); opacity: 0; pointer-events: none; transition: all 0.25s;
  background: #fff; color: #000; padding: 12px 20px; border-radius: 999px; font-weight: 600;
}
#toast.show { opacity: 1; transform: translate(-50%, 0); }

@media (max-width: 800px) {
  .game { flex-direction: column; }
  .board-wrap { width: 100%; flex: none; }
  .panel { width: 100%; }
}
```

- [ ] **Step 2: Write the DOM helpers**

<!-- file: src/ui/dom.ts -->
```ts
type Child = Node | string | null | undefined | false;

/** Creates an element; text children are inserted as text, never parsed as HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  for (const c of children) if (c) node.append(c);
  return node;
}
```

<!-- file: src/ui/toast.ts -->
```ts
let timer = 0;

export function toast(message: string): void {
  const box = document.getElementById('toast')!;
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(timer);
  timer = window.setTimeout(() => box.classList.remove('show'), 3500);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
```

- [ ] **Step 3: Write the background theme**

<!-- file: src/theme.ts -->
```ts
import { DEFAULT_PALETTE, extractPalette, type Palette } from './color';

const cache = new Map<string, Promise<Palette>>();
let active = 0;
let version = 0;

export function paletteFor(url: string): Promise<Palette> {
  if (!url) return Promise.resolve(DEFAULT_PALETTE);
  let p = cache.get(url);
  if (!p) {
    p = loadPalette(url).catch(() => DEFAULT_PALETTE);
    cache.set(url, p);
  }
  return p;
}

async function loadPalette(url: string): Promise<Palette> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, 32, 32);
  return extractPalette(ctx.getImageData(0, 0, 32, 32).data);
}

/**
 * Crossfades the page background to `url` (blurred) over its palette gradient.
 * Resolves with the palette, or null if a newer call superseded this one.
 */
export async function setBackground(url: string): Promise<Palette | null> {
  const mine = ++version;
  const palette = await paletteFor(url);
  if (mine !== version) return null;
  const layers = [document.getElementById('bg-0')!, document.getElementById('bg-1')!];
  const next = layers[1 - active];
  next.style.setProperty('--img', url ? `url("${url}")` : 'none');
  palette.forEach((c, i) => next.style.setProperty(`--c${i + 1}`, c));
  next.classList.add('visible');
  layers[active].classList.remove('visible');
  active = 1 - active;
  return palette;
}
```

- [ ] **Step 4: Typecheck and commit**

Run: `npm run typecheck` — Expected: no errors.

```bash
git add index.html src/style.css src/theme.ts src/ui/dom.ts src/ui/toast.ts && git commit -m "feat: add page shell, styles and album-color background"
```

---

### Task 10: Canvas renderer

**Files:**
- Create: `src/game/renderer.ts`

- [ ] **Step 1: Implement**

<!-- file: src/game/renderer.ts -->
```ts
import type { Palette } from '../color';
import type { Track } from '../types';
import { DELTA, type SnakeGame } from './engine';

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly images = new Map<string, HTMLImageElement>();
  private cell = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cols: number,
    private readonly rows: number,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    const size = Math.floor(this.canvas.getBoundingClientRect().width) || 600;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr * (this.rows / this.cols);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cell = size / this.cols;
  }

  draw(game: SnakeGame<Track>, palette: Palette, now: number): void {
    const { ctx, cell } = this;
    const w = cell * this.cols;
    const h = cell * this.rows;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < this.cols; i++) {
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, h);
    }
    for (let j = 1; j < this.rows; j++) {
      ctx.moveTo(0, j * cell);
      ctx.lineTo(w, j * cell);
    }
    ctx.stroke();

    const pulse = 0.5 + 0.5 * Math.sin(now / 250);
    for (const f of game.foods) this.drawFood(f.pos.x, f.pos.y, f.item, palette, pulse);

    for (let i = game.snake.length - 1; i >= 0; i--) {
      const p = game.snake[i];
      const item = game.bodyItems[i];
      if (i === 0) this.drawHead(game, palette);
      else if (item) this.drawCover(item.coverUrl, p.x * cell + 1, p.y * cell + 1, cell - 2, cell * 0.18, palette[0]);
      else this.drawBlock(p.x, p.y, palette[0], 0.55);
    }

    for (const f of game.foods) this.drawLabel(f.pos.x, f.pos.y, f.item.name, w);
  }

  private drawFood(x: number, y: number, t: Track, palette: Palette, pulse: number): void {
    const { ctx, cell } = this;
    const pad = cell * 0.06;
    const size = cell - pad * 2;
    ctx.save();
    ctx.shadowColor = palette[0];
    ctx.shadowBlur = 6 + 12 * pulse;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(x * cell + pad, y * cell + pad, size, size, cell * 0.2);
    ctx.fill();
    ctx.restore();
    this.drawCover(t.coverUrl, x * cell + pad, y * cell + pad, size, cell * 0.2, null);
  }

  private drawLabel(x: number, y: number, text: string, boardWidth: number): void {
    const { ctx, cell } = this;
    ctx.save();
    ctx.font = `600 ${Math.max(10, cell * 0.38)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = truncate(ctx, text, cell * 4);
    const tw = ctx.measureText(label).width + 10;
    const th = Math.max(14, cell * 0.55);
    const cx = Math.min(Math.max(x * cell + cell / 2, tw / 2 + 2), boardWidth - tw / 2 - 2);
    const cy = y === this.rows - 1 ? y * cell - th / 2 - 2 : (y + 1) * cell + th / 2 + 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, cy - th / 2, tw, th, th / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx, cy + 0.5);
    ctx.restore();
  }

  private drawHead(game: SnakeGame<Track>, palette: Palette): void {
    const { ctx, cell } = this;
    const head = game.snake[0];
    this.drawBlock(head.x, head.y, game.status === 'over' ? '#ff4d4d' : palette[0], 1);
    const f = DELTA[game.dir];
    const s = { x: -f.y, y: f.x };
    const cx = head.x * cell + cell / 2;
    const cy = head.y * cell + cell / 2;
    ctx.fillStyle = '#fff';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + f.x * cell * 0.18 + s.x * side * cell * 0.2, cy + f.y * cell * 0.18 + s.y * side * cell * 0.2, cell * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBlock(x: number, y: number, color: string, alpha: number): void {
    const { ctx, cell } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2, cell * 0.25);
    ctx.fill();
    ctx.restore();
  }

  private drawCover(url: string, x: number, y: number, size: number, radius: number, border: string | null): void {
    const { ctx } = this;
    const img = this.image(url);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, x, y, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = '#333';
      ctx.fill();
    }
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  private image(url: string): HTMLImageElement | null {
    if (!url) return null;
    let img = this.images.get(url);
    if (!img) {
      img = new Image();
      img.src = url;
      this.images.set(url, img);
    }
    return img;
  }
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npm run typecheck` — Expected: no errors.

```bash
git add src/game/renderer.ts && git commit -m "feat: add canvas renderer"
```

---

### Task 11: Login, source select and game-over screens

**Files:**
- Create: `src/ui/login.ts`, `src/ui/sourceSelect.ts`, `src/ui/gameOver.ts`

- [ ] **Step 1: Implement**

<!-- file: src/ui/login.ts -->
```ts
import { el } from './dom';

export function renderLogin(
  root: HTMLElement,
  opts: { error?: string; missingClientId: boolean; onLogin: () => void },
): void {
  const button = el('button', { class: 'btn primary' }, 'Spotify로 로그인');
  button.addEventListener('click', opts.onLogin);
  root.replaceChildren(
    el(
      'section',
      { class: 'screen center' },
      el('h1', { class: 'logo' }, 'Spotify Snake'),
      el('p', { class: 'muted' }, '노래를 먹는 뱀. 먹은 곡은 다음 곡을 먹을 때까지 재생돼요.'),
      opts.missingClientId
        ? el('p', { class: 'error' }, '.env 파일에 VITE_SPOTIFY_CLIENT_ID를 설정하고 서버를 다시 시작해주세요 (README 참고).')
        : button,
      opts.error ? el('p', { class: 'error' }, opts.error) : null,
    ),
  );
}
```

<!-- file: src/ui/sourceSelect.ts -->
```ts
import { AuthError } from '../auth';
import { LIKED_SOURCE, myPlaylists, savedAlbums, searchSources } from '../spotify/api';
import type { Source } from '../types';
import { el } from './dom';
import { errorMessage, toast } from './toast';

type Tab = 'search' | 'library';
type SearchType = 'album' | 'artist';

export function renderSourceSelect(
  root: HTMLElement,
  opts: { onPick: (s: Source) => void; onLogout: () => void },
): void {
  let tab: Tab = 'search';
  let searchType: SearchType = 'album';
  let timer = 0;
  let requestId = 0;

  const results = el('div');
  const input = el('input', { class: 'search', type: 'search', placeholder: '앨범 또는 아티스트 검색' });
  const tabs = { search: el('button', { class: 'tab' }, '검색'), library: el('button', { class: 'tab' }, '내 라이브러리') };
  const types = { album: el('button', { class: 'chip' }, '앨범'), artist: el('button', { class: 'chip' }, '아티스트') };
  const searchBar = el('div', { class: 'search-bar' }, input, types.album, types.artist);
  const logout = el('button', { class: 'btn ghost' }, '로그아웃');

  const card = (s: Source) => {
    const img = s.imageUrl ? el('img', { src: s.imageUrl, alt: '', loading: 'lazy' }) : el('div', { class: 'placeholder' }, '♥');
    const c = el('button', { class: s.kind === 'artist' ? 'card round' : 'card' }, img, el('strong', {}, s.name), el('span', { class: 'muted' }, s.subtitle));
    c.addEventListener('click', () => opts.onPick(s));
    return c;
  };
  const grid = (sources: Source[], empty: string) =>
    sources.length ? el('div', { class: 'grid' }, ...sources.map(card)) : el('p', { class: 'muted' }, empty);
  const message = (text: string) => results.replaceChildren(el('p', { class: 'muted' }, text));

  const fail = (e: unknown) => {
    if (e instanceof AuthError) throw e;
    message('불러오지 못했어요');
    toast(errorMessage(e));
  };

  async function runSearch() {
    const id = ++requestId;
    const query = input.value.trim();
    if (!query) return message('듣고 싶은 앨범이나 아티스트를 검색해보세요');
    message('검색 중…');
    try {
      const sources = await searchSources(query, searchType);
      if (id === requestId) results.replaceChildren(grid(sources, '결과가 없어요'));
    } catch (e) {
      if (id === requestId) fail(e);
    }
  }

  async function loadLibrary() {
    const id = ++requestId;
    message('라이브러리 불러오는 중…');
    try {
      const [playlists, albums] = await Promise.all([myPlaylists(), savedAlbums()]);
      if (id !== requestId) return;
      results.replaceChildren(
        el('h2', {}, '플레이리스트'),
        grid([LIKED_SOURCE, ...playlists], ''),
        el('h2', {}, '저장한 앨범'),
        grid(albums, '저장한 앨범이 없어요'),
      );
    } catch (e) {
      if (id === requestId) fail(e);
    }
  }

  function update() {
    tabs.search.classList.toggle('active', tab === 'search');
    tabs.library.classList.toggle('active', tab === 'library');
    types.album.classList.toggle('active', searchType === 'album');
    types.artist.classList.toggle('active', searchType === 'artist');
    searchBar.hidden = tab !== 'search';
    void (tab === 'search' ? runSearch() : loadLibrary());
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void runSearch(), 350);
  });
  tabs.search.addEventListener('click', () => ((tab = 'search'), update()));
  tabs.library.addEventListener('click', () => ((tab = 'library'), update()));
  types.album.addEventListener('click', () => ((searchType = 'album'), update()));
  types.artist.addEventListener('click', () => ((searchType = 'artist'), update()));
  logout.addEventListener('click', opts.onLogout);

  root.replaceChildren(
    el(
      'section',
      { class: 'screen' },
      el('header', { class: 'top' }, el('h1', {}, '무엇을 먹을까요?'), logout),
      el('nav', { class: 'tabs' }, tabs.search, tabs.library),
      searchBar,
      results,
    ),
  );
  update();
  input.focus();
}
```

<!-- file: src/ui/gameOver.ts -->
```ts
import type { Source, Track } from '../types';
import { el } from './dom';

export function renderGameOver(
  root: HTMLElement,
  opts: { source: Source; eaten: Track[]; onRetry: () => void; onChangeSource: () => void },
): void {
  const retry = el('button', { class: 'btn primary' }, '다시 하기');
  const change = el('button', { class: 'btn ghost' }, '소스 바꾸기');
  retry.addEventListener('click', opts.onRetry);
  change.addEventListener('click', opts.onChangeSource);

  const history = opts.eaten.length
    ? el(
        'ol',
        { class: 'history' },
        ...opts.eaten.map((t) =>
          el('li', { class: 'track-row' }, el('img', { src: t.coverUrl, alt: '' }), el('div', {}, el('strong', {}, t.name), el('span', { class: 'muted small' }, t.artists))),
        ),
      )
    : el('p', { class: 'muted' }, '한 곡도 먹지 못했어요');

  root.replaceChildren(
    el(
      'section',
      { class: 'screen center' },
      el('h1', { class: 'logo' }, 'GAME OVER'),
      el('p', { class: 'muted' }, `${opts.source.name}에서 ${opts.eaten.length}곡을 먹었어요`),
      history,
      el('div', { class: 'actions' }, retry, change),
    ),
  );
  retry.focus();
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npm run typecheck` — Expected: no errors.

```bash
git add src/ui/login.ts src/ui/sourceSelect.ts src/ui/gameOver.ts && git commit -m "feat: add login, source select and game over screens"
```

---

### Task 12: Game screen

**Files:**
- Create: `src/ui/gameScreen.ts`

- [ ] **Step 1: Implement**

<!-- file: src/ui/gameScreen.ts -->
```ts
import { DEFAULT_PALETTE, type Palette } from '../color';
import { Deck } from '../game/deck';
import { SnakeGame, tickMs, type Direction } from '../game/engine';
import { Renderer } from '../game/renderer';
import type { Player } from '../spotify/player';
import { setBackground } from '../theme';
import type { Source, Track } from '../types';
import { el } from './dom';
import { errorMessage, toast } from './toast';

const COLS = 20;
const ROWS = 20;
const FOOD_COUNT = 3;
const KEYS: Record<string, Direction> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

/** Mounts the game; returns a cleanup function. */
export function renderGame(
  root: HTMLElement,
  opts: { source: Source; tracks: Track[]; player: Player; onOver: (eaten: Track[]) => void; onQuit: () => void },
): () => void {
  const deck = new Deck(opts.tracks);
  const game = new SnakeGame<Track>({ cols: COLS, rows: ROWS, foodCount: FOOD_COUNT, drawFoods: (n) => deck.drawMany(n) });
  let palette: Palette = DEFAULT_PALETTE;
  let paused = false;
  let stopped = false;
  let tickTimer = 0;
  let frame = 0;

  const canvas = el('canvas', { class: 'board' });
  const overlay = el('div', { class: 'overlay' });
  const nowCover = el('img', { class: 'now-cover', alt: '' });
  nowCover.hidden = true;
  const nowTitle = el('strong', {}, '아직 재생 중인 곡이 없어요');
  const nowArtist = el('span', { class: 'muted small' }, '먹이를 먹으면 재생돼요');
  const score = el('div', { class: 'score' }, '0');
  const quit = el('button', { class: 'btn ghost' }, '그만하기');

  root.replaceChildren(
    el(
      'section',
      { class: 'screen game' },
      el('div', { class: 'board-wrap' }, canvas, overlay),
      el(
        'aside',
        { class: 'panel' },
        el('div', { class: 'muted small' }, opts.source.name),
        el('div', { class: 'label' }, 'SCORE'),
        score,
        el('div', { class: 'label' }, 'NOW PLAYING'),
        nowCover,
        nowTitle,
        nowArtist,
        el('p', { class: 'muted small' }, '방향키/WASD 이동 · Space 일시정지'),
        quit,
      ),
    ),
  );

  const renderer = new Renderer(canvas, COLS, ROWS);
  const applyPalette = (p: Palette | null) => {
    if (p) palette = p;
  };
  void setBackground(opts.source.imageUrl).then(applyPalette);

  function updateOverlay() {
    let text = '';
    if (opts.player.state === 'connecting') text = 'Spotify 플레이어 연결 중…';
    else if (opts.player.state === 'error') text = opts.player.error;
    else if (game.status === 'ready') text = '방향키를 눌러 시작';
    else if (paused) text = '일시정지 · Space로 계속';
    overlay.textContent = text;
    overlay.hidden = !text;
  }

  function schedule() {
    clearTimeout(tickTimer);
    tickTimer = window.setTimeout(tick, tickMs(game.eaten.length));
  }

  function tick() {
    if (stopped || paused) return;
    const result = game.step();
    if (result.ate) onAte(result.ate);
    if (result.died) return finish();
    schedule();
  }

  function onAte(t: Track) {
    score.textContent = String(game.eaten.length);
    nowCover.src = t.coverLargeUrl || t.coverUrl;
    nowCover.hidden = false;
    nowTitle.textContent = t.name;
    nowArtist.textContent = t.artists;
    opts.player.play(t.uri).catch((e) => toast(`재생 실패: ${errorMessage(e)}`));
    void setBackground(t.coverLargeUrl).then(applyPalette);
  }

  function setPaused(value: boolean) {
    if (game.status !== 'running' || paused === value) return;
    paused = value;
    updateOverlay();
    if (!paused) schedule();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === ' ') {
      e.preventDefault();
      setPaused(!paused);
      return;
    }
    const d = KEYS[e.key.toLowerCase()];
    if (!d) return;
    e.preventDefault();
    if (opts.player.state !== 'ready' || paused) return;
    const starting = game.status === 'ready';
    if (starting) opts.player.activate();
    game.turn(d);
    if (starting) {
      updateOverlay();
      schedule();
    }
  }

  const onBlur = () => setPaused(true);
  const onResize = () => renderer.resize();

  function draw(now: number) {
    renderer.draw(game, palette, now);
    frame = requestAnimationFrame(draw);
  }

  function cleanup() {
    stopped = true;
    clearTimeout(tickTimer);
    cancelAnimationFrame(frame);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', onResize);
    offPlayer();
  }

  function finish() {
    // Leave the crashed board on screen briefly before the game-over screen.
    window.setTimeout(() => {
      if (stopped) return;
      cleanup();
      opts.onOver(game.eaten.slice());
    }, 800);
  }

  quit.addEventListener('click', () => {
    cleanup();
    opts.onQuit();
  });
  window.addEventListener('keydown', onKey);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', onResize);
  const offPlayer = opts.player.onChange(updateOverlay);
  updateOverlay();
  frame = requestAnimationFrame(draw);
  return cleanup;
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npm run typecheck` — Expected: no errors.

```bash
git add src/ui/gameScreen.ts && git commit -m "feat: add game screen"
```

---

### Task 13: App wiring and README

**Files:**
- Create: `src/main.ts`, `README.md`

- [ ] **Step 1: Implement the router**

<!-- file: src/main.ts -->
```ts
import './style.css';
import { AuthError, handleCallback, hasClientId, isLoggedIn, login, logout } from './auth';
import { loadTracks } from './spotify/api';
import { Player } from './spotify/player';
import { setBackground } from './theme';
import type { Source, Track } from './types';
import { el } from './ui/dom';
import { renderGame } from './ui/gameScreen';
import { renderGameOver } from './ui/gameOver';
import { renderLogin } from './ui/login';
import { renderSourceSelect } from './ui/sourceSelect';
import { errorMessage, toast } from './ui/toast';

const root = document.getElementById('app')!;
let player: Player | null = null;
let cleanupGame: (() => void) | null = null;

function showLogin(error?: string) {
  cleanupGame?.();
  cleanupGame = null;
  player?.disconnect();
  player = null;
  void setBackground('');
  renderLogin(root, { error, missingClientId: !hasClientId(), onLogin: () => void login() });
}

function ensurePlayer(): Player {
  if (!player) {
    player = new Player();
    void player.connect();
  }
  return player;
}

function showSourceSelect() {
  void setBackground('');
  renderSourceSelect(root, {
    onPick: (s) => void startSource(s),
    onLogout: () => {
      logout();
      showLogin();
    },
  });
}

async function startSource(source: Source) {
  root.replaceChildren(el('section', { class: 'screen center' }, el('p', { class: 'muted' }, `${source.name} 곡 불러오는 중…`)));
  try {
    const tracks = await loadTracks(source);
    if (tracks.length === 0) {
      toast('재생할 수 있는 곡이 없어요');
      return showSourceSelect();
    }
    showGame(source, tracks);
  } catch (e) {
    if (e instanceof AuthError) return showLogin(e.message);
    toast(errorMessage(e));
    showSourceSelect();
  }
}

function showGame(source: Source, tracks: Track[]) {
  cleanupGame = renderGame(root, {
    source,
    tracks,
    player: ensurePlayer(),
    onOver: (eaten) => {
      cleanupGame = null;
      renderGameOver(root, { source, eaten, onRetry: () => showGame(source, tracks), onChangeSource: showSourceSelect });
    },
    onQuit: () => {
      cleanupGame = null;
      showSourceSelect();
    },
  });
}

async function boot() {
  // Spotify redirects only to 127.0.0.1, and tokens live per-origin.
  if (window.location.hostname === 'localhost') {
    window.location.replace(window.location.href.replace('//localhost', '//127.0.0.1'));
    return;
  }
  try {
    await handleCallback();
  } catch (e) {
    return showLogin(errorMessage(e));
  }
  if (!hasClientId() || !isLoggedIn()) return showLogin();
  ensurePlayer();
  showSourceSelect();
}

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason instanceof AuthError) showLogin(e.reason.message);
});

void boot();
```

- [ ] **Step 2: Write the README**

<!-- file: README.md -->
````markdown
# Spotify Snake 🐍🎵

사과 대신 노래를 먹는 뱀 게임. 앨범, 아티스트, 내 플레이리스트를 고르면 그 곡들이 먹이로 나오고,
먹은 곡은 다음 곡을 먹을 때까지 재생됩니다. 배경은 지금 재생 중인 앨범 커버 색으로 바뀌어요.

## 준비물

- Node.js 20+
- **Spotify Premium** 계정 (브라우저에서 곡 전체를 재생하는 Web Playback SDK가 Premium 전용)

## 1. Spotify 개발자 앱 만들기 (한 번만)

1. https://developer.spotify.com/dashboard 에 로그인 → **Create app**
2. 입력:
   - App name / description: 아무거나 (예: `Spotify Snake`)
   - **Redirect URI**: `http://127.0.0.1:5173/callback` (정확히 이대로, `localhost` 아님)
   - **APIs used**: `Web API`, `Web Playback SDK` 체크
3. 저장 후 앱의 **Settings**에서 **Client ID** 복사 (Client Secret은 필요 없음)

## 2. 실행

```bash
cp .env.example .env
# .env 파일을 열어 VITE_SPOTIFY_CLIENT_ID= 뒤에 Client ID 붙여넣기
npm install
npm run dev
```

브라우저에서 http://127.0.0.1:5173 접속 → Spotify로 로그인.

## 조작

- 방향키 / WASD: 이동 (아무 방향키나 누르면 시작)
- Space: 일시정지
- 화면에 앨범 커버 3개가 떠 있어요. 하나를 먹으면 그 곡이 재생되고 새 후보 3개가 나옵니다.
- 벽이나 내 몸에 부딪히면 게임 오버.

## 제약 (Spotify API 정책, 2026년 2월 기준)

- 플레이리스트는 **내가 만들었거나 공동 작업 중인 것만** 곡 목록을 불러올 수 있어요.
  그래서 플레이리스트는 검색이 아니라 "내 라이브러리" 탭에서 고릅니다.
- 아티스트 인기곡 API가 막혀서, 아티스트를 고르면 최근 앨범/싱글 최대 10장의 곡을 씁니다.
- 검색 결과는 최대 10개.
- Development Mode 앱은 최대 5명까지 사용 가능 (본인 외 사용자는 대시보드 User Management에 추가).

## 개발

```bash
npm test          # 단위 테스트 (게임 엔진, 셔플 덱, 색 추출, 트랙 변환)
npm run typecheck
npm run build
```
````

- [ ] **Step 3: Verify**

Run: `npm test && npm run build`
Expected: all tests pass; Vite build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts README.md && git commit -m "feat: wire up screens and add README"
```

---

### Task 14: Manual verification

- [ ] **Step 1:** `npm run dev`, open `http://127.0.0.1:5173` without `.env` → login screen shows the missing Client ID message.
- [ ] **Step 2:** Open `http://localhost:5173` → redirects to `127.0.0.1`.
- [ ] **Step 3 (needs the user's Client ID + Premium):** log in, search an album, start, eat a song → it plays; background crossfades; body segment shows the cover; hitting a wall shows the game-over list.
- [ ] **Step 4:** "내 라이브러리" tab lists Liked Songs, owned playlists and saved albums; an artist source loads tracks.
