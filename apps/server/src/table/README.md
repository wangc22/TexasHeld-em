# table

In-memory table registry. Manages the lifecycle of all active poker tables and their associated resources.

## Files

| File | Responsibility |
|---|---|
| `TableManager.ts` | Central registry: table CRUD, mutex lock, timers, socket tracking, host management |

## Async Mutex Lock

Every write operation on a table must go through `TableManager.withLock(tableId, fn)`. This chains a promise so that concurrent operations on the same table are serialised:

```
withLock(id, opA)  →  lock acquired, opA runs
withLock(id, opB)  →  queued, runs only after opA resolves
```

The lock has a 30-second timeout guard to prevent a stuck operation from blocking the table permanently.

## Timers

Each `TableEntry` tracks four categories of timer:

| Timer | Purpose |
|---|---|
| `turnTimer` | Auto-folds the current player after their turn deadline expires |
| `confirmTimer` | Auto-confirms all players 30 s after `hand_complete` |
| `disconnectTimers` | Per-player: removes player from seat after 60 s offline |
| `emptyTimer` | Destroys an empty table after a 30 s grace period |

## Socket Tracking

`registerSocket` / `unregisterSocket` / `getPlayerIdForSocket` maintain bidirectional maps between socket IDs and player IDs. When the same player reconnects with a new socket, the old socket entry is evicted automatically.

## Storage

All state is stored in a JavaScript `Map` — no database or Redis integration yet. Data is lost on server restart.
