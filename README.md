# Texas Hold'em Poker

A multiplayer real-time Texas Hold'em poker web application with Claude AI bots and WebRTC voice chat.

## Features

- Real-time multiplayer (up to 9 players per table)
- Claude AI bots with configurable difficulty (novice / intermediate / expert / conservative / aggressive / random)
- Rule-engine fallback when no API key is configured
- WebRTC P2P voice chat (via Socket.io signaling)
- Session leaderboard, hand history, quick chat
- Guest login (JWT, no account required)

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind + Zustand | SPA at `apps/client` |
| Backend | Node.js + Fastify + Socket.io | API + WebSocket at `apps/server` |
| Shared logic | TypeScript package `@texas-poker/shared` | Types, hand evaluator, action validator |
| State storage | In-memory (`Map`) | No persistence; data lost on server restart |
| Auth | JWT (guest token, 24h TTL) | No user database |
| AI bots | Anthropic Claude API (optional) | Falls back to rule engine without API key |
| Voice | WebRTC P2P + Socket.io signaling | Suitable for ≤ 4 players |

## Monorepo Structure

```
texasPoker/
├── packages/shared/    — shared types, constants, hand evaluator, action validator
├── apps/server/        — Fastify HTTP + Socket.io WebSocket server
└── apps/client/        — React 19 SPA
```

Managed with [pnpm workspaces](https://pnpm.io/workspaces).

## Quick Start

```bash
# Install dependencies (first time)
export PNPM_HOME="$HOME/Library/pnpm" && export PATH="$PNPM_HOME:$PATH"
pnpm install

# Build shared package (required before running server or client)
pnpm --filter @texas-poker/shared build

# Terminal 1 — backend (port 3001)
cd apps/server
npx tsx --env-file=.env src/index.ts

# Terminal 2 — frontend (port 5173)
cd apps/client
pnpm dev
```

Open http://localhost:5173 in your browser. Backend health check: http://localhost:3001.

## Running Tests

```bash
# All tests (shared + server)
pnpm test

# Shared package only
pnpm --filter @texas-poker/shared test

# Server only
pnpm --filter server test
```

## Environment Variables

Edit `apps/server/.env` (see `apps/server/.env.example`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP/WebSocket server port |
| `JWT_SECRET` | `dev-secret-...` | **Change in production** |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `ANTHROPIC_API_KEY` | _(empty)_ | Claude API key; bots use rule engine when absent |
| `REDIS_URL` | `redis://localhost:6379` | Not yet integrated |

## Architecture Decisions

### 1. Single state mutation entry point
`GameEngine.applyAction()` is the **only** method that modifies game state. All paths — WebSocket handlers, bots, and auto-fold timers — go through it.

### 2. Per-table async mutex lock
`TableManager.withLock(tableId, fn)` serialises all operations on a table, preventing concurrent action races between bot moves, timeout auto-folds, and player actions.

### 3. Bot = rule engine + LLM style layer
The rule engine computes the legal action set. The LLM only chooses a "style" within that set. On API timeout (5 s) or an invalid response, the system falls back to the rule engine's conservative choice (check → call → fold).

### 4. Socket.io singleton on the client
`apps/client/src/socket/socketClient.ts` exports a module-level singleton. `connectSocket(token)` updates `auth.token` and reconnects — **never** recreates the socket object, which would silently drop all registered event listeners.

### 5. Per-player state redaction
`GameEngine.getStateForPlayer(playerId)` hides opponents' hole cards until showdown.

### 6. Disconnect grace period
- Turn in progress during disconnect: 30 s auto-fold timer continues.
- Reconnect within 60 s: seat restored, participates in next hand.
- After 60 s: auto-leave seat.
- Same `userId` reconnects: old socket is kicked.
