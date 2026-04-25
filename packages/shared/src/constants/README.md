# constants

Shared constants used by both server and client. Having these in a single package guarantees that the two sides never drift out of sync.

## Files

| File | Exports | Description |
|---|---|---|
| `events.ts` | `EVENTS`, `EventName` | All Socket.io event name strings as a typed constant object; both sides import from here to avoid typos |
| `poker.ts` | `RANKS`, `SUITS`, `RANK_VALUE`, `HAND_RANK_VALUE`, `DEFAULT_TABLE_CONFIG` | Card rank and suit arrays, numeric rank/hand-rank lookup maps, and the default table configuration |

## Event Names

`EVENTS` contains ~38 named events split into categories:

- **Auth / connection**: `AUTH`, `DISCONNECT`, ...
- **Table lifecycle**: `JOIN_TABLE`, `LEAVE_TABLE`, `START_GAME`, ...
- **Game flow**: `GAME_STATE`, `PLAYER_ACTION`, `HAND_RESULT`, `TURN_START`, ...
- **Bot**: `ADD_BOT`, `BOT_THOUGHT`, ...
- **Voice / WebRTC**: `WEBRTC_OFFER`, `WEBRTC_ANSWER`, `WEBRTC_ICE_CANDIDATE`, ...
