const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';
const REDIRECT_URI = `${window.location.origin}/callback`;
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
].join(' ');
const TOKEN_KEY = 'spotify-snake.token';
const VERIFIER_KEY = 'spotify-snake.verifier';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class AuthError extends Error {
  constructor(message = 'Spotify 로그인이 필요해요') {
    super(message);
    this.name = 'AuthError';
  }
}

export function hasClientId(): boolean {
  return CLIENT_ID.length > 0;
}

export function isLoggedIn(): boolean {
  return readToken() !== null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(): Promise<void> {
  const verifier = randomString(64);
  localStorage.setItem(VERIFIER_KEY, verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: await sha256Base64Url(verifier),
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

/** Finishes the Spotify redirect when the page was opened on /callback. */
export async function handleCallback(): Promise<void> {
  if (window.location.pathname !== '/callback') return;
  const params = new URLSearchParams(window.location.search);
  window.history.replaceState(null, '', '/');
  const error = params.get('error');
  if (error) throw new AuthError(`Spotify 로그인이 취소되었거나 실패했어요 (${error})`);
  const code = params.get('code');
  const verifier = localStorage.getItem(VERIFIER_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  if (!code || !verifier) throw new AuthError('로그인 정보가 없어요. 다시 시도해주세요.');
  await requestToken({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier });
}

export async function getAccessToken(): Promise<string> {
  const token = readToken();
  if (!token) throw new AuthError();
  if (Date.now() < token.expiresAt - 60_000) return token.accessToken;
  await refresh();
  return readToken()!.accessToken;
}

let refreshing: Promise<void> | null = null;

/** Refreshes the access token; concurrent callers share one request. */
export function refresh(): Promise<void> {
  const token = readToken();
  if (!token) return Promise.reject(new AuthError());
  refreshing ??= requestToken({ grant_type: 'refresh_token', refresh_token: token.refreshToken })
    .catch(() => {
      logout();
      throw new AuthError('로그인이 만료됐어요. 다시 로그인해주세요.');
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function requestToken(body: Record<string, string>): Promise<void> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  });
  if (!res.ok) throw new AuthError(`토큰 요청에 실패했어요 (${res.status})`);
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  writeToken({
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? readToken()?.refreshToken ?? '',
    expiresAt: Date.now() + json.expires_in * 1000,
  });
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

function writeToken(token: StoredToken): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
