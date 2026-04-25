# bot

AI decision engine for bot players. Combines a deterministic rule engine with an optional LLM style layer.

## Files

| File | Responsibility |
|---|---|
| `BotPlayer.ts` | Orchestration: computes valid actions, calls LLM, validates response, falls back |
| `BotPromptBuilder.ts` | Serialises game state into a structured prompt for the LLM |
| `AnthropicClient.ts` | Anthropic SDK call with timeout, JSON response parsing |

## Decision Flow

```
decideBotAction(state, botPlayerId)
  1. computeValidActions()         — rule engine: legal action set
  2. computeFallback()             — conservative default (check > call > fold)
  3. No API key? → return fallback
  4. buildBotSystemPrompt()        — personality + difficulty instructions
  5. buildBotUserPrompt()          — current board, valid actions, pot odds
  6. askClaude() + think delay     — parallel: LLM call + artificial delay (3–5 s)
  7. validateAndClampAction()      — clamp LLM choice to legal bounds
  8. return validated action + reasoning
```

## Fallback Strategy

If `ANTHROPIC_API_KEY` is not set, or if the LLM returns an invalid/timed-out response, the bot uses the fallback: **check if possible → call → fold**. The fallback is always legal because `computeValidActions` runs first.

## Difficulty Levels

| Level | Style |
|---|---|
| `novice` | Suboptimal play, calls too much, rarely bluffs |
| `intermediate` | Tight-aggressive, standard bet sizing |
| `expert` | TAG with selective aggression, position-aware |
| `conservative` | Tight-selective, value bets only |
| `aggressive` | Loose-aggressive, consistent pressure |
| `random` | Unpredictable bet sizing and decisions |
