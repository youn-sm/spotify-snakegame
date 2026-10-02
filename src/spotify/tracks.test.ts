import { describe, expect, it } from 'vitest';
import type { Track } from '../types';
import { dedupeByName, pickImage, startPositionMs, toTrack, type RawAlbum, type RawTrack } from './tracks';

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
  duration_ms: 200_000,
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
      durationMs: 200_000,
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

describe('startPositionMs', () => {
  it('starts about 30% into the track', () => {
    expect(startPositionMs(200_000)).toBe(60_000);
  });
  it('clamps to between 20s and 70s', () => {
    expect(startPositionMs(60_000)).toBe(20_000);
    expect(startPositionMs(600_000)).toBe(70_000);
  });
  it('leaves at least 30s to play on short tracks', () => {
    expect(startPositionMs(40_000)).toBe(10_000);
    expect(startPositionMs(25_000)).toBe(0);
  });
});
