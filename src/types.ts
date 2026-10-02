export interface Track {
  id: string;
  uri: string;
  name: string;
  artists: string;
  albumName: string;
  /** ~64px cover for board tiles. */
  coverUrl: string;
  /** ~640px cover for the background and now-playing panel. */
  coverLargeUrl: string;
}

export type SourceKind = 'album' | 'artist' | 'playlist' | 'liked';

export interface Source {
  kind: SourceKind;
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string;
}
