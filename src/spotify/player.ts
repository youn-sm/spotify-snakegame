import { getAccessToken } from '../auth';
import { playTrack, transferPlayback } from './api';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

export type PlayerState = 'connecting' | 'ready' | 'error';

/** This browser tab as a Spotify Connect device. */
export class Player {
  state: PlayerState = 'connecting';
  error = '';
  private deviceId: string | null = null;
  private sdk: Spotify.Player | null = null;
  private readonly listeners = new Set<() => void>();

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async connect(): Promise<void> {
    try {
      await loadSdk();
      const sdk = new Spotify.Player({
        name: 'Spotify Snake',
        volume: 0.8,
        getOAuthToken: (cb) => {
          getAccessToken().then(cb, () => this.fail('로그인이 만료됐어요. 다시 로그인해주세요.'));
        },
      });
      sdk.addListener('ready', ({ device_id }) => {
        this.deviceId = device_id;
        transferPlayback(device_id).catch(() => {});
        this.setState('ready');
      });
      sdk.addListener('not_ready', () => this.setState('connecting'));
      sdk.addListener('initialization_error', (e) => this.fail(`플레이어 초기화 실패: ${e.message}`));
      sdk.addListener('authentication_error', (e) => this.fail(`Spotify 인증 오류: ${e.message}`));
      sdk.addListener('account_error', () => this.fail('Spotify Premium 계정이 필요해요'));
      sdk.addListener('playback_error', (e) => console.warn('playback_error', e.message));
      this.sdk = sdk;
      if (!(await sdk.connect())) this.fail('Spotify 플레이어에 연결하지 못했어요');
    } catch (e) {
      this.fail(e instanceof Error ? e.message : String(e));
    }
  }

  /** Call from a user gesture so the browser allows audio output. */
  activate(): void {
    this.sdk?.activateElement().catch(() => {});
  }

  async play(uri: string): Promise<void> {
    if (!this.deviceId) throw new Error('플레이어가 아직 준비되지 않았어요');
    await playTrack(this.deviceId, uri);
  }

  disconnect(): void {
    this.sdk?.disconnect();
    this.listeners.clear();
  }

  private setState(state: PlayerState): void {
    this.state = state;
    this.listeners.forEach((cb) => cb());
  }

  private fail(message: string): void {
    this.error = message;
    this.setState('error');
  }
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  sdkPromise ??= new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onerror = () => reject(new Error('Spotify SDK를 불러오지 못했어요'));
    document.head.appendChild(script);
  });
  return sdkPromise;
}
