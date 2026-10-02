import { AuthError } from '../auth';
import { LIKED_SOURCE, myPlaylists, savedAlbums, searchSources } from '../spotify/api';
import type { Source } from '../types';
import { el } from './dom';
import { errorMessage, toast } from './toast';

type Tab = 'search' | 'library';
type SearchType = 'album' | 'artist';

export function renderSourceSelect(
  root: HTMLElement,
  opts: { onPick: (s: Source) => void; onLogout: () => void },
): void {
  let tab: Tab = 'search';
  let searchType: SearchType = 'album';
  let timer = 0;
  let requestId = 0;

  const results = el('div');
  const input = el('input', { class: 'search', type: 'search', placeholder: '앨범 또는 아티스트 검색' });
  const tabs = { search: el('button', { class: 'tab' }, '검색'), library: el('button', { class: 'tab' }, '내 라이브러리') };
  const types = { album: el('button', { class: 'chip' }, '앨범'), artist: el('button', { class: 'chip' }, '아티스트') };
  const searchBar = el('div', { class: 'search-bar' }, input, types.album, types.artist);
  const logout = el('button', { class: 'btn ghost' }, '로그아웃');

  const card = (s: Source) => {
    const img = s.imageUrl ? el('img', { src: s.imageUrl, alt: '', loading: 'lazy' }) : el('div', { class: 'placeholder' }, '♥');
    const c = el('button', { class: s.kind === 'artist' ? 'card round' : 'card' }, img, el('strong', {}, s.name), el('span', { class: 'muted' }, s.subtitle));
    c.addEventListener('click', () => opts.onPick(s));
    return c;
  };
  const grid = (sources: Source[], empty: string) =>
    sources.length ? el('div', { class: 'grid' }, ...sources.map(card)) : el('p', { class: 'muted' }, empty);
  const message = (text: string) => results.replaceChildren(el('p', { class: 'muted' }, text));

  const fail = (e: unknown) => {
    if (e instanceof AuthError) throw e;
    message('불러오지 못했어요');
    toast(errorMessage(e));
  };

  async function runSearch() {
    const id = ++requestId;
    const query = input.value.trim();
    if (!query) return message('듣고 싶은 앨범이나 아티스트를 검색해보세요');
    message('검색 중…');
    try {
      const sources = await searchSources(query, searchType);
      if (id === requestId) results.replaceChildren(grid(sources, '결과가 없어요'));
    } catch (e) {
      if (id === requestId) fail(e);
    }
  }

  async function loadLibrary() {
    const id = ++requestId;
    message('라이브러리 불러오는 중…');
    try {
      const [playlists, albums] = await Promise.all([myPlaylists(), savedAlbums()]);
      if (id !== requestId) return;
      results.replaceChildren(
        el('h2', {}, '플레이리스트'),
        grid([LIKED_SOURCE, ...playlists], ''),
        el('h2', {}, '저장한 앨범'),
        grid(albums, '저장한 앨범이 없어요'),
      );
    } catch (e) {
      if (id === requestId) fail(e);
    }
  }

  function update() {
    tabs.search.classList.toggle('active', tab === 'search');
    tabs.library.classList.toggle('active', tab === 'library');
    types.album.classList.toggle('active', searchType === 'album');
    types.artist.classList.toggle('active', searchType === 'artist');
    searchBar.hidden = tab !== 'search';
    void (tab === 'search' ? runSearch() : loadLibrary());
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void runSearch(), 350);
  });
  tabs.search.addEventListener('click', () => ((tab = 'search'), update()));
  tabs.library.addEventListener('click', () => ((tab = 'library'), update()));
  types.album.addEventListener('click', () => ((searchType = 'album'), update()));
  types.artist.addEventListener('click', () => ((searchType = 'artist'), update()));
  logout.addEventListener('click', opts.onLogout);

  root.replaceChildren(
    el(
      'section',
      { class: 'screen' },
      el('header', { class: 'top' }, el('h1', {}, '무엇을 먹을까요?'), logout),
      el('nav', { class: 'tabs' }, tabs.search, tabs.library),
      searchBar,
      results,
    ),
  );
  update();
  input.focus();
}
