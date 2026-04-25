# pages

Top-level route views. Routing is handled by conditional rendering in `App.tsx` based on auth and table state.

## Pages

| Page | Route / Condition | Description |
|---|---|---|
| `LoginPage.tsx` | No auth token | Guest login form; calls `POST /auth/guest` and stores the JWT in `authStore` |
| `LobbyPage.tsx` | Authenticated, no active table | Lists open tables (`GET /tables`), create-table form, tutorial button |
| `GamePage.tsx` | Authenticated, joined a table | Full game UI: `PokerTable`, `ActionPanel`, `BotThoughtPanel`, `HandHistoryPanel`, `SessionLeaderboard`, `VoicePanel`, `MusicPlayer` |
