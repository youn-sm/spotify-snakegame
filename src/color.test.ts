import { describe, expect, it } from 'vitest';
import { accentColor, DEFAULT_PALETTE, extractPalette } from './color';

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

describe('accentColor', () => {
  it('picks the most saturated color', () => {
    expect(accentColor(['#333333', '#ff0000', '#808080'])).toBe('#ff1a1a');
  });

  it('lifts dark colors so the snake stays visible', () => {
    expect(accentColor(['#400000', '#400000', '#400000'])).toBe('#ff1a1a');
  });

  it('falls back to Spotify green for grayscale covers', () => {
    expect(accentColor(['#111111', '#777777', '#eeeeee'])).toBe('#1db954');
  });
});
