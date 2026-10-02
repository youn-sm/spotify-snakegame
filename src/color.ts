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
