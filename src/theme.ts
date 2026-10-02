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
