/**
 * BotPlayer: drives AI decision-making for bot players.
 *
 * When notified it's a bot's turn, it:
 * 1. Computes valid actions once (shared across fallback, LLM prompt, validation)
 * 2. Calls LLM with structured prompt
 * 3. Validates LLM response is within legal actions
 * 4. Applies the action via GameEngine (through TableManager lock)
 *
 * The LLM only affects "style"; the rule engine guarantees legality.
 */
import type { GameState, PlayerAction, ValidActions } from '@texas-poker/shared';
import { computeValidActions } from '@texas-poker/shared';
import {
  buildBotSystemPrompt,
  buildBotUserPrompt,
  type BotDifficulty,
} from './BotPromptBuilder.js';
import { askClaude } from './AnthropicClient.js';
import { config } from '../config.js';

/** Maps botPlayerId -> difficulty for this session */
const botDifficulties = new Map<string, BotDifficulty>();

export function setBotDifficulty(botPlayerId: string, difficulty: BotDifficulty): void {
  botDifficulties.set(botPlayerId, difficulty);
}

export function getBotDifficulty(botPlayerId: string): BotDifficulty {
  return botDifficulties.get(botPlayerId) ?? 'expert';
}

/**
 * Compute a safe fallback action from pre-computed valid actions.
 * Priority: check > call > fold. Never raises (safe conservative play).
 */
function computeFallback(valid: ValidActions): PlayerAction {
  if (valid.canCheck) return { type: 'check' };
  if (valid.canCall) return { type: 'call' };
  return { type: 'fold' };
}

/**
 * Validate that the LLM-suggested action is within legal bounds.
 * If not, return the fallback.
 */
function validateAndClampAction(
  action: PlayerAction,
  valid: ValidActions,
  fallback: PlayerAction
): PlayerAction {
  switch (action.type) {
    case 'fold':
      return action;
    case 'check':
      return valid.canCheck ? action : fallback;
    case 'call':
      return valid.canCall ? action : fallback;
    case 'raise': {
      if (!valid.canRaise) return fallback;
      const amount = action.amount ?? valid.minRaise;
      const clamped = Math.max(valid.minRaise, Math.min(valid.maxRaise, amount));
      return { type: 'raise', amount: clamped };
    }
    case 'all_in':
      return valid.canAllIn ? action : fallback;
    default:
      return fallback;
  }
}

function randomThinkDelayMs(): number {
  return config.botThinkMinMs + Math.random() * (config.botThinkMaxMs - config.botThinkMinMs);
}

/**
 * Main entry point: decide and return the action for a bot player.
 * Called by the server when it's the bot's turn.
 */
export async function decideBotAction(
  state: GameState,
  botPlayerId: string
): Promise<PlayerAction & { reasoning?: string }> {
  const difficulty = getBotDifficulty(botPlayerId);
  const bot = state.players.find((p) => p.id === botPlayerId);
  if (!bot) return { type: 'fold' };

  // Compute valid actions once — reused by fallback, prompt, and validation
  const valid = computeValidActions(bot, state.currentBetAmount, state.minRaise, state.pot);
  const fallback = computeFallback(valid);
  const thinkMs = randomThinkDelayMs();

  // If no API key configured, just use rule-based fallback with a default reasoning
  if (!config.openRouterApiKey && !config.anthropicApiKey) {
    await new Promise((resolve) => setTimeout(resolve, thinkMs));
    const reasoningMap: Record<string, string> = {
      check: 'No bet to call, checking.',
      call: 'Pot odds are acceptable, calling.',
      fold: 'Hand is too weak, folding.',
    };
    return { ...fallback, reasoning: reasoningMap[fallback.type] ?? 'Rule-based decision.' };
  }

  const systemPrompt = buildBotSystemPrompt(bot.name, difficulty);
  const userPrompt = buildBotUserPrompt(state, botPlayerId, valid, difficulty);

  // Random delay between botThinkMinMs and botThinkMaxMs to simulate thinking
  const fallbackDecision = { action: fallback.type, amount: fallback.amount };
  const [decision] = await Promise.all([
    askClaude(systemPrompt, userPrompt, fallbackDecision),
    new Promise((resolve) => setTimeout(resolve, thinkMs)),
  ]);

  const botDecision = decision as { action: string; amount?: number; reasoning?: string };
  const playerAction: PlayerAction = {
    type: botDecision.action as PlayerAction['type'],
    amount: botDecision.amount,
  };
  const validated = validateAndClampAction(playerAction, valid, fallback);
  const reasoning = botDecision.reasoning ?? '(No reasoning returned by AI)';
  return { ...validated, reasoning };
}
