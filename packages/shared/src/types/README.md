# types

TypeScript interfaces and type aliases shared between server and client.

## Files

| File | Key Types |
|---|---|
| `card.ts` | `Card` (`{ rank, suit }`), `HandRankName`, `HandRank` |
| `player.ts` | `Player`, `PlayerStatus` (`'active'` \| `'folded'` \| `'all_in'` \| `'acted'` \| `'sitting_out'`) |
| `action.ts` | `ActionType`, `PlayerAction`, `ActionRecord`, `ValidActions`, `BotDecision` |
| `game.ts` | `GamePhase`, `GameState`, `TableConfig`, `HandResult`, `HandSummary`, `SessionResult`, `SidePot` |

## Notes

- All types are pure interfaces — no runtime code.
- `ValidActions` is the output of `computeValidActions` (in `utils/actions.ts`) and is used by both the client's `ActionPanel` and the server's `BotPlayer`.
- `GameState` is the canonical game snapshot; `GameEngine.getStateForPlayer()` returns a version with opponents' hole cards redacted.
