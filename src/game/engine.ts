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
