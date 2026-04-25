# @texas-poker/shared

Shared TypeScript package used by both `apps/server` and `apps/client`. Contains all domain types, Socket.io event name constants, and pure utility functions.

## Contents

| Directory | Purpose |
|---|---|
| `src/types/` | TypeScript interfaces: `Card`, `Player`, `GameState`, `PlayerAction`, `ValidActions`, etc. |
| `src/constants/` | Socket.io event names (`events.ts`) and poker domain constants (`poker.ts`) |
| `src/utils/` | Pure functions: hand evaluator (`handEvaluator.ts`) and action validator (`actions.ts`) |

## Usage

```typescript
import { GameState, computeValidActions, EVENTS, RANKS } from '@texas-poker/shared';
```

## Build

The package must be compiled before it can be used by the server or client:

```bash
pnpm --filter @texas-poker/shared build   # compile TypeScript → dist/
pnpm --filter @texas-poker/shared dev     # watch mode
```

Output goes to `dist/` (CommonJS + type declarations).

## Tests

```bash
pnpm --filter @texas-poker/shared test
```

Tests are in `src/utils/` alongside their source files (Vitest, globals enabled).
