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
