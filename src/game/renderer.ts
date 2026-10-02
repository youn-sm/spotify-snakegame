import { accentColor, type Palette } from '../color';
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

    const accent = accentColor(palette);
    const pulse = 0.5 + 0.5 * Math.sin(now / 250);
    for (const f of game.foods) this.drawFood(f.pos.x, f.pos.y, f.item, accent, pulse);

    for (let i = game.snake.length - 1; i >= 0; i--) {
      const p = game.snake[i];
      const item = game.bodyItems[i];
      if (i === 0) this.drawHead(game, accent);
      else if (item) this.drawCover(item.coverUrl, p.x * cell + 1, p.y * cell + 1, cell - 2, cell * 0.18, accent);
      else this.drawBlock(p.x, p.y, accent, 0.6);
    }

    for (const f of game.foods) {
      // Put the label above the tile when the cell below is the edge or another food.
      const above = f.pos.y === this.rows - 1 || game.foods.some((o) => o.pos.x === f.pos.x && o.pos.y === f.pos.y + 1);
      this.drawLabel(f.pos.x, f.pos.y, f.item.name, w, above);
    }
  }

  private drawFood(x: number, y: number, t: Track, glow: string, pulse: number): void {
    const { ctx, cell } = this;
    const pad = cell * 0.06;
    const size = cell - pad * 2;
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 6 + 12 * pulse;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(x * cell + pad, y * cell + pad, size, size, cell * 0.2);
    ctx.fill();
    ctx.restore();
    this.drawCover(t.coverUrl, x * cell + pad, y * cell + pad, size, cell * 0.2, null);
  }

  private drawLabel(x: number, y: number, text: string, boardWidth: number, above: boolean): void {
    const { ctx, cell } = this;
    ctx.save();
    ctx.font = `600 ${Math.max(10, cell * 0.38)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = truncate(ctx, text, cell * 4);
    const tw = ctx.measureText(label).width + 10;
    const th = Math.max(14, cell * 0.55);
    const cx = Math.min(Math.max(x * cell + cell / 2, tw / 2 + 2), boardWidth - tw / 2 - 2);
    const cy = above ? y * cell - th / 2 - 2 : (y + 1) * cell + th / 2 + 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, cy - th / 2, tw, th, th / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx, cy + 0.5);
    ctx.restore();
  }

  private drawHead(game: SnakeGame<Track>, color: string): void {
    const { ctx, cell } = this;
    const head = game.snake[0];
    this.drawBlock(head.x, head.y, game.status === 'over' ? '#ff4d4d' : color, 1);
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
