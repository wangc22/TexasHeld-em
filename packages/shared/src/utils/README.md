# utils

Pure utility functions with no side effects. Safe to import on both server and client.

## Files

| File | Exports | Description |
|---|---|---|
| `handEvaluator.ts` | `evaluateHand`, `compareHands`, `findWinners` | 7-card Texas Hold'em hand evaluator |
| `actions.ts` | `computeValidActions` | Computes the legal action set for a player given current bet and stack |

## Hand Evaluator

`evaluateHand(holeCards: Card[], communityCards: Card[]): HandRank`

Enumerates all C(7, 5) = 21 five-card combinations from the 7 available cards and returns the best hand rank. Time complexity: O(21) with constant inner loops.

`compareHands(hand1: HandRank, hand2: HandRank): number`

Returns negative if `hand1 < hand2`, zero if equal, positive if `hand1 > hand2`. Uses `HAND_RANK_VALUE` then compares kickers.

`findWinners(playerHands: { playerId: string; rank: HandRank }[]): string[]`

Returns an array of `playerId` values for the winner(s). Multiple IDs indicate a split pot.

## Action Validator

`computeValidActions(player, currentBetAmount, minRaise, pot): ValidActions`

Pure function — no mutation, no side effects. Used by:
- Server: `BotPlayer.decideBotAction` (determines legal moves before calling LLM)
- Client: `ActionPanel` (enables/disables action buttons)
- Server: `GameEngine.applyAction` (validates player actions)

## Tests

- `handEvaluator.test.ts` — 16 tests covering all hand ranks, comparisons, and multi-winner scenarios
- `actions.test.ts` — 10 tests covering all `ValidActions` fields and edge cases
