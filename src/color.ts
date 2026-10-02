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

/** The palette's most saturated color, brightened enough to stand out on a dark board. */
export function accentColor(palette: Palette): string {
  const hsl = palette.map(toHsl).sort((a, b) => b[1] - a[1])[0];
  if (hsl[1] < 0.15) return DEFAULT_PALETTE[0];
  return toHex(fromHsl(hsl[0], hsl[1], Math.min(0.8, Math.max(0.55, hsl[2]))));
}

function toHsl(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
