# store

Zustand state stores. Each store manages a distinct concern.

## Stores

| Store | State | Description |
|---|---|---|
| `authStore.ts` | `token`, `playerId`, `playerName` | JWT auth state; persisted to `localStorage`; cleared on logout |
| `gameStore.ts` | `tableId`, `gameState`, `handResult`, `botThoughts`, `turnDeadlineMs`, `validActions`, `handHistory` | Primary game state; populated by `useSocketEvents`; the single source of truth for all in-game UI |
| `musicStore.ts` | `isPlaying`, `volume` | Background music toggle and volume level |
| `voiceStore.ts` | `isInCall`, `isMuted`, `peers` | WebRTC voice channel state; peer connection map keyed by player ID |
