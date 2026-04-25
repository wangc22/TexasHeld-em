# socket

Socket.io client singleton.

## Files

| File | Description |
|---|---|
| `socketClient.ts` | Exports a module-level `socket` singleton and a `connectSocket(token)` helper |

## Critical Constraint

`connectSocket(token)` updates `socket.auth.token` and calls `socket.connect()`. It does **not** call `io(...)` again.

Recreating the socket object (i.e. `socket = io(...)`) would silently invalidate all references held by `useSocketEvents` and other hooks that captured the original instance, causing all game events to be dropped without any error message.

## Usage

```typescript
import { getSocket, connectSocket } from '@/socket/socketClient';

// On login
connectSocket(token);

// In event handlers
const socket = getSocket();
socket.emit(EVENTS.PLAYER_ACTION, { tableId, action });
```
