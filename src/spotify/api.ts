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
