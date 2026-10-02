import './style.css';
import { AuthError, handleCallback, hasClientId, isLoggedIn, login, logout } from './auth';
import { loadTracks } from './spotify/api';
import { Player } from './spotify/player';
import { setBackground } from './theme';
import type { Source, Track } from './types';
import { el } from './ui/dom';
import { renderGame } from './ui/gameScreen';
import { renderGameOver } from './ui/gameOver';
import { renderLogin } from './ui/login';
import { renderSourceSelect } from './ui/sourceSelect';
import { errorMessage, toast } from './ui/toast';

const root = document.getElementById('app')!;
let player: Player | null = null;
let cleanupGame: (() => void) | null = null;

function showLogin(error?: string) {
  cleanupGame?.();
  cleanupGame = null;
  player?.disconnect();
  player = null;
  void setBackground('');
  renderLogin(root, { error, missingClientId: !hasClientId(), onLogin: () => void login() });
}

function ensurePlayer(): Player {
  if (!player) {
    player = new Player();
    void player.connect();
  }
  return player;
}

function showSourceSelect() {
  void setBackground('');
  renderSourceSelect(root, {
    onPick: (s) => void startSource(s),
    onLogout: () => {
      logout();
      showLogin();
    },
  });
}

async function startSource(source: Source) {
  root.replaceChildren(el('section', { class: 'screen center' }, el('p', { class: 'muted' }, `${source.name} 곡 불러오는 중…`)));
  try {
    const tracks = await loadTracks(source);
    if (tracks.length === 0) {
      toast('재생할 수 있는 곡이 없어요');
      return showSourceSelect();
    }
    showGame(source, tracks);
  } catch (e) {
    if (e instanceof AuthError) return showLogin(e.message);
    toast(errorMessage(e));
    showSourceSelect();
  }
}

function showGame(source: Source, tracks: Track[]) {
  cleanupGame = renderGame(root, {
    source,
    tracks,
    player: ensurePlayer(),
    onOver: (eaten) => {
      cleanupGame = null;
      renderGameOver(root, { source, eaten, onRetry: () => showGame(source, tracks), onChangeSource: showSourceSelect });
    },
    onQuit: () => {
      cleanupGame = null;
      showSourceSelect();
    },
  });
}

async function boot() {
  // Spotify redirects only to 127.0.0.1, and tokens live per-origin.
  if (window.location.hostname === 'localhost') {
    window.location.replace(window.location.href.replace('//localhost', '//127.0.0.1'));
    return;
  }
  try {
    await handleCallback();
  } catch (e) {
    return showLogin(errorMessage(e));
  }
  if (!hasClientId() || !isLoggedIn()) return showLogin();
  ensurePlayer();
  showSourceSelect();
}

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason instanceof AuthError) showLogin(e.reason.message);
});

void boot();
