import { DEFAULT_PALETTE, type Palette } from '../color';
import { Deck } from '../game/deck';
import { SnakeGame, tickMs, type Direction } from '../game/engine';
import { Renderer } from '../game/renderer';
import type { Player } from '../spotify/player';
import { setBackground } from '../theme';
import type { Source, Track } from '../types';
import { el } from './dom';
import { errorMessage, toast } from './toast';

const DEBUG = new URLSearchParams(window.location.search).has('debug');
const COLS = 20;
const ROWS = 20;
const FOOD_COUNT = 3;
const KEYS: Record<string, Direction> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

/** Mounts the game; returns a cleanup function. */
export function renderGame(
  root: HTMLElement,
  opts: { source: Source; tracks: Track[]; player: Player; onOver: (eaten: Track[]) => void; onQuit: () => void },
): () => void {
  const deck = new Deck(opts.tracks);
  const game = new SnakeGame<Track>({ cols: COLS, rows: ROWS, foodCount: FOOD_COUNT, drawFoods: (n) => deck.drawMany(n) });
  let palette: Palette = DEFAULT_PALETTE;
  let paused = false;
  let stopped = false;
  let tickTimer = 0;
  let frame = 0;

  const canvas = el('canvas', { class: 'board' });
  const overlay = el('div', { class: 'overlay' });
  const nowCover = el('img', { class: 'now-cover', alt: '' });
  nowCover.hidden = true;
  const nowTitle = el('strong', {}, '아직 재생 중인 곡이 없어요');
  const nowArtist = el('span', { class: 'muted small' }, '먹이를 먹으면 재생돼요');
  const score = el('div', { class: 'score' }, '0');
  const timing = el('div', { class: 'muted small' });
  timing.hidden = !DEBUG;
  const quit = el('button', { class: 'btn ghost' }, '그만하기');

  root.replaceChildren(
    el(
      'section',
      { class: 'screen game' },
      el('div', { class: 'board-wrap' }, canvas, overlay),
      el(
        'aside',
        { class: 'panel' },
        el('div', { class: 'muted small' }, opts.source.name),
        el('div', { class: 'label' }, 'SCORE'),
        score,
        el('div', { class: 'label' }, 'NOW PLAYING'),
        nowCover,
        nowTitle,
        nowArtist,
        timing,
        el('p', { class: 'muted small' }, '방향키/WASD 이동 · Space 일시정지'),
        quit,
      ),
    ),
  );

  const renderer = new Renderer(canvas, COLS, ROWS);
  const applyPalette = (p: Palette | null) => {
    if (p) palette = p;
  };
  void setBackground(opts.source.imageUrl).then(applyPalette);

  function updateOverlay() {
    const lt = opts.player.lastTiming;
    if (lt) timing.textContent = `API ${Math.round(lt.apiMs)}ms · 재생까지 ${(lt.audibleMs / 1000).toFixed(1)}s`;
    let text = '';
    if (opts.player.state === 'connecting') text = 'Spotify 플레이어 연결 중…';
    else if (opts.player.state === 'error') text = opts.player.error;
    else if (game.status === 'ready') text = '방향키를 눌러 시작';
    else if (paused) text = '일시정지 · Space로 계속';
    overlay.textContent = text;
    overlay.hidden = !text;
  }

  function schedule() {
    clearTimeout(tickTimer);
    tickTimer = window.setTimeout(tick, tickMs(game.eaten.length));
  }

  function tick() {
    if (stopped || paused) return;
    const result = game.step();
    if (result.ate) onAte(result.ate);
    if (result.died) return finish();
    schedule();
  }

  function onAte(t: Track) {
    score.textContent = String(game.eaten.length);
    nowCover.src = t.coverLargeUrl || t.coverUrl;
    nowCover.hidden = false;
    nowTitle.textContent = t.name;
    nowArtist.textContent = t.artists;
    opts.player.play(t).catch((e) => toast(`재생 실패: ${errorMessage(e)}`));
    void setBackground(t.coverLargeUrl).then(applyPalette);
  }

  function setPaused(value: boolean) {
    if (game.status !== 'running' || paused === value) return;
    paused = value;
    updateOverlay();
    if (!paused) schedule();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === ' ') {
      e.preventDefault();
      setPaused(!paused);
      return;
    }
    const d = KEYS[e.key.toLowerCase()];
    if (!d) return;
    e.preventDefault();
    if (opts.player.state !== 'ready' || paused) return;
    const starting = game.status === 'ready';
    if (starting) opts.player.activate();
    game.turn(d);
    if (starting) {
      updateOverlay();
      schedule();
    }
  }

  const onBlur = () => setPaused(true);
  const onResize = () => renderer.resize();

  function draw(now: number) {
    renderer.draw(game, palette, now);
    frame = requestAnimationFrame(draw);
  }

  function cleanup() {
    stopped = true;
    clearTimeout(tickTimer);
    cancelAnimationFrame(frame);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', onResize);
    offPlayer();
  }

  function finish() {
    // Leave the crashed board on screen briefly before the game-over screen.
    window.setTimeout(() => {
      if (stopped) return;
      cleanup();
      opts.onOver(game.eaten.slice());
    }, 800);
  }

  quit.addEventListener('click', () => {
    cleanup();
    opts.onQuit();
  });
  window.addEventListener('keydown', onKey);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', onResize);
  const offPlayer = opts.player.onChange(updateOverlay);
  updateOverlay();
  frame = requestAnimationFrame(draw);
  return cleanup;
}
