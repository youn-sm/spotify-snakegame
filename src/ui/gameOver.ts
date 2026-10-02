import type { Source, Track } from '../types';
import { el } from './dom';

export function renderGameOver(
  root: HTMLElement,
  opts: { source: Source; eaten: Track[]; onRetry: () => void; onChangeSource: () => void },
): void {
  const retry = el('button', { class: 'btn primary' }, '다시 하기');
  const change = el('button', { class: 'btn ghost' }, '소스 바꾸기');
  retry.addEventListener('click', opts.onRetry);
  change.addEventListener('click', opts.onChangeSource);

  const history = opts.eaten.length
    ? el(
        'ol',
        { class: 'history' },
        ...opts.eaten.map((t) =>
          el('li', { class: 'track-row' }, el('img', { src: t.coverUrl, alt: '' }), el('div', {}, el('strong', {}, t.name), el('span', { class: 'muted small' }, t.artists))),
        ),
      )
    : el('p', { class: 'muted' }, '한 곡도 먹지 못했어요');

  root.replaceChildren(
    el(
      'section',
      { class: 'screen center' },
      el('h1', { class: 'logo' }, 'GAME OVER'),
      el('p', { class: 'muted' }, `${opts.source.name}에서 ${opts.eaten.length}곡을 먹었어요`),
      history,
      el('div', { class: 'actions' }, retry, change),
    ),
  );
  retry.focus();
}
