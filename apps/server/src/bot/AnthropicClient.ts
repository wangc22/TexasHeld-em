import { config } from '../config.js';
import type { BotDecision } from '@texas-poker/shared';
import type { ActionType } from '@texas-poker/shared';

const VALID_ACTIONS = new Set<ActionType>(['fold', 'check', 'call', 'raise', 'all_in']);

// OpenRouter endpoint (OpenAI-compatible API)
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Claude 3.5 Haiku via OpenRouter — fast, smart, cost-effective
const MODEL = 'anthropic/claude-3-5-haiku';

/**
 * Call Claude via OpenRouter API and parse the bot decision.
 * Falls back gracefully to { action: fallback } on any failure.
 */
export async function askClaude(
  systemPrompt: string,
  userPrompt: string,
  fallback: BotDecision
): Promise<BotDecision> {
  const apiKey = config.openRouterApiKey || config.anthropicApiKey;
  if (!apiKey) return fallback;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.botApiTimeoutMs);

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://texas-poker-app',
        'X-Title': 'Texas Hold\'em Poker Bot',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 250,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Bot] OpenRouter error ${response.status}:`, errText);
      return fallback;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message: string };
    };

    if (data.error) {
      console.warn('[Bot] OpenRouter API error:', data.error.message);
      return fallback;
    }

    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    console.log(`[Bot] Claude response: ${text}`);
    return parseDecision(text, fallback);
  } catch (err) {
    console.warn('[Bot] API error, using fallback:', err instanceof Error ? err.message : err);
    return fallback;
  }
}

function parseDecision(raw: string, fallback: BotDecision): BotDecision {
  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const action = parsed['action'] as string;
    if (!VALID_ACTIONS.has(action as ActionType)) {
      console.warn('[Bot] Invalid action in response:', action);
      return fallback;
    }

    const amount = typeof parsed['amount'] === 'number' ? Math.floor(parsed['amount']) : undefined;
    const reasoning = typeof parsed['reasoning'] === 'string' ? parsed['reasoning'] : undefined;
    return { action: action as ActionType, amount: amount ?? undefined, reasoning };
  } catch {
    console.warn('[Bot] Failed to parse response:', raw);
    return fallback;
  }
}
