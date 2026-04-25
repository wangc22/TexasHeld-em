# Client

React 19 SPA for the Texas Hold'em poker application, built with Vite and Tailwind CSS.

## Structure

```
src/
├── pages/       — Top-level route views (LoginPage, LobbyPage, GamePage)
├── components/  — UI components organised by domain
│   ├── Actions/ — Bet/fold/check/raise action buttons
│   ├── Audio/   — Background music player
│   ├── Card/    — Single playing card renderer
│   ├── Game/    — Game-level panels (bot thoughts, hand history, leaderboard, chat)
│   ├── Player/  — Player seat display
│   ├── Table/   — Poker table layout and community cards
│   ├── Tutorial/— How-to-play modal
│   └── Voice/   — WebRTC voice chat UI
├── store/       — Zustand state stores (auth, game, music, voice)
├── hooks/       — Custom React hooks (socket events, countdown timer)
├── socket/      — Socket.io singleton client
└── utils/       — Client utility functions (chip denomination display)
```

## Running

```bash
pnpm dev      # development server at http://localhost:5173
pnpm build    # production build (TypeScript check + Vite bundle)
pnpm preview  # preview production build locally
```

## Critical: Socket.io Singleton

`src/socket/socketClient.ts` exports a **module-level singleton** socket instance. `connectSocket(token)` updates the auth token and reconnects — it does **not** recreate the socket object.

**Never** do `socket = io(...)` inside `connectSocket`. Recreating the socket drops all event listeners registered by `useSocketEvents`, causing the game UI to go silent without any visible error.

## State Management

Global state lives in Zustand stores in `src/store/`. The game store (`gameStore.ts`) is the primary source of truth for the current table state, populated by socket event handlers in `src/hooks/useSocketEvents.ts`.
