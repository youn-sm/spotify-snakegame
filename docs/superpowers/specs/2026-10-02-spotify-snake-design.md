# Spotify Snake — Design

Date: 2026-10-02

A local, browser-based snake game where the "apples" are songs from a Spotify source the
player picks (album, artist, or one of their own playlists). Eating a song plays it in full
until the next song is eaten. The background follows the currently playing album art.

## Constraints (Spotify, as of the February 2026 Dev Mode changes)

- The app runs as a Spotify **Development Mode** app registered by the player. The owner
  must have **Premium** (also required by the Web Playback SDK). Max 5 users per app.
- Redirect URI must be a loopback IP: `http://127.0.0.1:5173/callback` (not `localhost`).
- Search `limit` max is **10** per request.
- `GET /playlists/{id}/items` returns items **only for playlists the user owns or
  collaborates on**. Other playlists return metadata only.
  → Playlists are offered only from the user's library (`GET /me/playlists`), filtered to
  ones they own or collaborate on. Search covers **albums and artists** only.
- `GET /artists/{id}/top-tracks` is removed.
  → Artist source = `GET /artists/{id}/albums` (album + single, first 10) then
  `GET /albums/{id}/tracks` per album (no batch fetch available), de-duplicated by name.
- `GET /me` no longer returns `product`, so Premium cannot be pre-checked; we rely on the
  SDK's `account_error` event and show a clear message.

## Screen flow

```
[Login] → [Source select] → [Game] → [Game over] → (Play again | Change source)
```

- **Login**: "Connect Spotify" button → PKCE authorization code flow.
- **Source select**, two tabs:
  - **Search**: album / artist search, results as a cover grid.
  - **My library**: owned/collaborative playlists, saved albums, Liked Songs.
- Picking a source loads its tracks. Local files and tracks with `is_playable === false`
  are filtered out. Sources with 0 playable tracks show an error and stay on this screen.

## Game rules

- 20×20 grid. Arrow keys / WASD to steer, Space to pause. Reversing direction is ignored.
- **3 food tiles** at a time, each an album-cover tile with a small track-title label.
- Eating a food:
  - plays that track from the start on the in-browser SDK device;
  - snake grows by 1; the new segment shows that track's cover;
  - the other 2 foods disappear and 3 fresh candidates spawn on empty cells.
- Track order: **shuffle deck** — no track repeats until the deck is exhausted, then it
  reshuffles. Sources with fewer than 3 tracks repeat tracks to fill 3 slots.
- Game over on wall or self collision. The current song keeps playing. Game-over screen
  shows score (tracks eaten) and the list of eaten tracks in order.
- Speed: starts at 150 ms/tick, −5 ms per track eaten, floor 70 ms.
- Silence until the first track is eaten.

## Visuals

- **Background**: current track's album cover, scaled up and blurred, under a gradient of
  2–3 dominant colors extracted from the cover. Crossfades on track change.
- Before the first track: artist image (artist source) or the source's cover image.
- **Snake**: head filled with the dominant color; each body segment draws the cover of the
  track eaten at that point (the body is the play history).

## Architecture (Vite + TypeScript, no server)

| Module | Responsibility |
|---|---|
| `src/auth.ts` | PKCE login, token storage in localStorage, refresh |
| `src/spotify/api.ts` | Typed fetch wrapper; search, library, source → tracks |
| `src/spotify/player.ts` | Web Playback SDK wrapper: device ready state, `play(uri)` |
| `src/game/engine.ts` | Pure game state + `step()`; no DOM |
| `src/game/deck.ts` | Shuffle deck with injectable RNG |
| `src/game/renderer.ts` | Canvas drawing of board, foods, snake |
| `src/theme.ts` | Dominant-color extraction + background crossfade |
| `src/ui/*.ts` | Login, source select, game-over screens |
| `src/main.ts` | Screen router, wiring |

Client ID lives in `.env` (`VITE_SPOTIFY_CLIENT_ID`). README documents app registration.

## Error handling

- 401 → refresh token once and retry; refresh failure → back to Login.
- 429 → respect `Retry-After` once.
- Player not ready → Start button disabled with "Connecting player…".
- SDK `account_error` → "Spotify Premium required" message.
- Play request failure → toast, game continues.

## Testing

- Vitest unit tests: `engine` (movement, growth, collisions, food spawning), `deck`
  (no repeats until exhausted, small sources), color extraction (on pixel arrays),
  track filtering/dedup in `api`.
- Spotify login/playback verified manually with a real Premium account.

## Out of scope (later)

Track-end penalty, save run as playlist, BPM-linked speed, high scores per source.
