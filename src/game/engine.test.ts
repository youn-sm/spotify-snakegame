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
