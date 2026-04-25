# Server

Fastify HTTP + Socket.io WebSocket server for the Texas Hold'em poker application.

## Module Map

```
src/
├── game/       — Core game state machine (GameEngine, Deck, PotManager, BettingRound)
├── table/      — In-memory table registry, async mutex lock, timer management
├── bot/        — AI decision engine (LLM + rule-engine fallback)
├── http/       — REST API routes (guest auth, table list/create)
├── websocket/  — Socket.io handlers and JWT middleware
├── config.ts   — All environment variables and runtime constants
└── index.ts    — Server bootstrap (Fastify setup, Socket.io, broadcast logic)
```

## Key Invariants

1. **Single state entry point** — `GameEngine.applyAction()` is the only method that mutates game state. Nothing else should write to the engine directly.
2. **Per-table mutex** — Every operation on a table goes through `TableManager.withLock(tableId, fn)`. This serialises bot actions, auto-fold timers, and player actions on the same table.
3. **No direct state broadcast** — `index.ts` listens to `GameEvent` emissions from the engine and sends personalised `GameState` objects (with opponents' hole cards redacted) to each connected socket.

## Running

```bash
# Development (watch mode, auto-restart on changes)
npx tsx --env-file=.env src/index.ts

# Build to JavaScript
pnpm build

# Run compiled output
node dist/index.js
```

Requires `apps/server/.env` — copy from `.env.example` and fill in values.

## Tests

```bash
pnpm test
```

Test files live next to their source files (`*.test.ts`), auto-discovered by Vitest.

## Environment Variables

See the root `README.md` for the full environment variable reference.
