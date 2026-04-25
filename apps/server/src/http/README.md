# http

Fastify REST API route plugins.

## Files

| File | Routes | Description |
|---|---|---|
| `auth.ts` | `POST /auth/guest` | Creates a guest player: generates a UUID player ID and returns a signed JWT (24 h TTL) |
| `tables.ts` | `GET /tables` | Lists all active tables that have at least one human player |
| | `POST /tables` | Creates a new table with an optional config (blinds, buy-in range, max players) |

## Request / Response

### `POST /auth/guest`

```json
// Request body
{ "name": "Alice" }

// Response
{ "playerId": "<uuid>", "name": "Alice", "token": "<jwt>" }
```

### `GET /tables`

```json
// Response
{ "tables": [ { "tableId": "...", "name": "...", "playerCount": 2, "maxPlayers": 6, ... } ] }
```

### `POST /tables`

```json
// Request body (all fields optional except name)
{ "name": "My Table", "smallBlind": 5, "bigBlind": 10, "maxPlayers": 6 }

// Response
{ "tableId": "<uuid>" }
```

Returns `409 Conflict` if the table name is already in use.

## Input Validation

All route inputs are validated by Fastify's built-in JSON Schema validator. `tables.ts` also uses `TableManager.isNameTaken()` for name-conflict checks.
