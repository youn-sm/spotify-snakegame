# Spotify Snake 🐍🎵

사과 대신 노래를 먹는 뱀 게임. 앨범, 아티스트, 내 플레이리스트를 고르면 그 곡들이 먹이로 나오고,
먹은 곡은 다음 곡을 먹을 때까지 재생됩니다. 배경은 지금 재생 중인 앨범 커버 색으로 바뀌어요.

## 준비물

- Node.js 20+
- **Spotify Premium** 계정 (브라우저에서 곡 전체를 재생하는 Web Playback SDK가 Premium 전용)

## 1. Spotify 개발자 앱 만들기 (한 번만)

1. https://developer.spotify.com/dashboard 에 로그인 → **Create app**
2. 입력:
   - App name / description: 아무거나 (예: `Spotify Snake`)
   - **Redirect URI**: `http://127.0.0.1:5173/callback` (정확히 이대로, `localhost` 아님)
   - **APIs used**: `Web API`, `Web Playback SDK` 체크
3. 저장 후 앱의 **Settings**에서 **Client ID** 복사 (Client Secret은 필요 없음)

## 2. 실행

```bash
cp .env.example .env
# .env 파일을 열어 VITE_SPOTIFY_CLIENT_ID= 뒤에 Client ID 붙여넣기
npm install
npm run dev
```

브라우저에서 http://127.0.0.1:5173 접속 → Spotify로 로그인.

## 조작

- 방향키 / WASD: 이동 (아무 방향키나 누르면 시작)
- Space: 일시정지
- 화면에 앨범 커버 3개가 떠 있어요. 하나를 먹으면 그 곡이 재생되고 새 후보 3개가 나옵니다.
- 벽이나 내 몸에 부딪히면 게임 오버.

## 제약 (Spotify API 정책, 2026년 2월 기준)

- 플레이리스트는 **내가 만들었거나 공동 작업 중인 것만** 곡 목록을 불러올 수 있어요.
  그래서 플레이리스트는 검색이 아니라 "내 라이브러리" 탭에서 고릅니다.
- 아티스트 인기곡 API가 막혀서, 아티스트를 고르면 최근 앨범/싱글 최대 10장의 곡을 씁니다.
- 검색 결과는 최대 10개.
- Development Mode 앱은 최대 5명까지 사용 가능 (본인 외 사용자는 대시보드 User Management에 추가).

## 개발

```bash
npm test          # 단위 테스트 (게임 엔진, 셔플 덱, 색 추출, 트랙 변환)
npm run typecheck
npm run build
```
