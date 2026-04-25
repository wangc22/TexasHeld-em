# game

Core game state machine for a single poker table. Contains all rules logic for Texas Hold'em.

## Files

| File | Responsibility |
|---|---|
| `GameEngine.ts` | State machine; sole mutation point via `applyAction()` |
| `Deck.ts` | 52-card deck with Fisher-Yates shuffle |
| `PotManager.ts` | Side pot calculation for all-in scenarios |
| `BettingRound.ts` | Betting round completion logic and player ordering |

## Key Rules

- `GameEngine.applyAction(playerId, action)` is the **only** method that changes game state. All external code — WebSocket handlers, bots, timers — must use this method.
- `GameEngine.getStateForPlayer(playerId)` returns a redacted copy of the state with opponents' hole cards set to `null` outside of showdown.
- `GameEngine` emits typed `GameEvent` objects (e.g. `turn_start`, `hand_complete`, `state_updated`) which the server uses to drive Socket.io broadcasts and bot scheduling.

## Side Pot Algorithm (PotManager)

1. Sort all-in amounts ascending.
2. For each unique contribution level, calculate the slice: `(level − previous_level) × number_of_players_who_contributed_at_least_this_much`.
3. Folded players contribute chips but are excluded from `eligiblePlayerIds`.
4. Consecutive slices with identical eligible sets are merged.

## Tests

Test files live alongside their source:
- `GameEngine.test.ts`
- `Deck.test.ts`
- `PotManager.test.ts`
- `BettingRound.test.ts`
