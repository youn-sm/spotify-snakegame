import { el } from './dom';

export function renderLogin(
  root: HTMLElement,
  opts: { error?: string; missingClientId: boolean; onLogin: () => void },
): void {
  const button = el('button', { class: 'btn primary' }, 'Spotify로 로그인');
  button.addEventListener('click', opts.onLogin);
  root.replaceChildren(
    el(
      'section',
      { class: 'screen center' },
      el('h1', { class: 'logo' }, 'Spotify Snake'),
      el('p', { class: 'muted' }, '노래를 먹는 뱀. 먹은 곡은 다음 곡을 먹을 때까지 재생돼요.'),
      opts.missingClientId
        ? el('p', { class: 'error' }, '.env 파일에 VITE_SPOTIFY_CLIENT_ID를 설정하고 서버를 다시 시작해주세요 (README 참고).')
        : button,
      opts.error ? el('p', { class: 'error' }, opts.error) : null,
    ),
  );
}
