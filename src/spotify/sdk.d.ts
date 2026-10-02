declare namespace Spotify {
  interface PlayerInit {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }
  interface WebPlaybackError {
    message: string;
  }
  interface PlaybackTrack {
    uri: string;
    linked_from?: { uri: string | null };
  }
  interface PlaybackState {
    paused: boolean;
    loading?: boolean;
    position: number;
    track_window: { current_track: PlaybackTrack | null };
  }
  interface ReadyEvent {
    device_id: string;
  }
  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    activateElement(): Promise<void>;
    addListener(event: 'ready' | 'not_ready', cb: (e: ReadyEvent) => void): boolean;
    addListener(event: 'player_state_changed', cb: (s: PlaybackState | null) => void): boolean;
    addListener(
      event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
      cb: (e: WebPlaybackError) => void,
    ): boolean;
  }
  const Player: { new (init: PlayerInit): Player };
}

interface Window {
  onSpotifyWebPlaybackSDKReady?: () => void;
}
