# websocket

Socket.io event handlers and JWT authentication middleware.

## Files

| File | Responsibility |
|---|---|
| `middleware.ts` | JWT verification, `socket.data` population, `signToken` / `verifyToken` helpers |
| `gameHandlers.ts` | Registers all Socket.io game event listeners on a connected socket |

## Authentication Flow

1. Client passes `{ token: "<jwt>" }` in `socket.handshake.auth`.
2. `authMiddleware` calls `verifyToken`, extracts `playerId` and `playerName`.
3. Values are stored in `socket.data` for use by all handlers.
4. Connection is rejected with `MISSING_TOKEN` or `INVALID_TOKEN` if verification fails.

## Event Handler Validation (6 layers)

Every incoming game event is validated through six layers before being applied:

| Layer | What is checked |
|---|---|
| 1 | JWT valid + `playerId` present in `socket.data` |
| 2 | `tableId` valid + player is registered at this table |
| 3 | Game phase permits this operation |
| 4 | It is this player's turn to act |
| 5 | Action type is in the player's legal action set |
| 6 | Amount is within legal bounds |

Layers 1–3 are enforced in `gameHandlers.ts`; layers 4–6 are enforced inside `GameEngine.applyAction()`.

## Input Validation

Incoming socket payloads are validated with [Zod](https://zod.dev) schemas defined at the top of `gameHandlers.ts`. Invalid payloads are rejected before reaching the game engine.

## Key Events Handled

`join_table`, `leave_table`, `player_action`, `start_game`, `add_bot`, `remove_bot`, `set_difficulty`, `pause_game`, `resume_game`, `webrtc_offer`, `webrtc_answer`, `webrtc_ice_candidate`
