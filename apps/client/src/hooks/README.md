# hooks

Custom React hooks used across the application.

## Hooks

| Hook | Description |
|---|---|
| `useSocketEvents.ts` | Registers Socket.io event listeners on mount, tears them down on unmount; updates the game store (`gameStore`) when events arrive (e.g. `game_state`, `hand_result`, `bot_thought`); depends on the module-level socket singleton |
| `useCountdown.ts` | Countdown timer hook; accepts a deadline timestamp (`turnDeadlineMs`) from the game store and returns the remaining seconds; drives the per-turn action clock in `ActionPanel` |
