import type { GameState, ValidActions } from '@texas-poker/shared';
import { evaluateHand } from '@texas-poker/shared';

export type BotDifficulty = 'novice' | 'intermediate' | 'expert' | 'conservative' | 'aggressive' | 'random';

function cardToString(card: { rank: string; suit: string }): string {
  const suitSymbol: Record<string, string> = {
    spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣'
  };
  return `${card.rank}${suitSymbol[card.suit] ?? card.suit}`;
}

function positionName(seatIndex: number, dealerSeat: number, sbSeat: number, bbSeat: number): string {
  if (seatIndex === dealerSeat) return 'Button/Dealer (best position — act last postflop)';
  if (seatIndex === sbSeat) return 'Small Blind (out of position postflop — play tighter)';
  if (seatIndex === bbSeat) return 'Big Blind (already invested — defend selectively)';
  return 'Middle Position (play reasonably tight, raise with strong hands)';
}

export function buildBotSystemPrompt(botName: string, difficulty: BotDifficulty): string {
  const styles: Record<BotDifficulty, string> = {
    novice: 'You are a novice player who sometimes makes suboptimal decisions. You tend to call too much and rarely bluff. Keep bet sizing small (25-40% of pot).',

    intermediate: `You are a solid tight-aggressive poker player.
- Pre-flop: raise 2.5-3x BB with strong hands (TT+, AK, AQ); call with speculative hands in position
- Post-flop: c-bet 50-55% of flops with 40-50% pot sizing; fold weak hands to aggression
- Call with medium hands only when pot odds exceed 3:1
- Bet sizing: 40-60% of pot — no larger unless protecting a very vulnerable hand`,

    expert: `You are an expert Texas Hold'em player using a tight-aggressive (TAG) style with selective aggression.

PRE-FLOP:
- Raise 3x BB (+ 1x per limper) with top 30% of hands: TT+, AK, AQ, AJs, KQs
- Call with suited connectors and pocket pairs (22-99) when price is right (≤ 3x BB)
- Do NOT go all-in pre-flop unless facing a re-raise with AA/KK or stack ≤ 15 BB

POST-FLOP BET SIZING (raise amount = TOTAL bet):
- Monster hand (set+, straight+): 65-80% of pot
- Strong hand (two pair, TPTK): 55-70% of pot
- Semi-bluff or c-bet: 45-55% of pot
- Bluff in position: 40-50% of pot
- NEVER bet more than 85% of pot except with near-nuts wanting full stacks in

POSITION IS POWER:
- Button/Dealer: open with top 35% of hands; c-bet most flops
- Small Blind: tighten up, raise with top 25% of hands
- Big Blind: defend against single raises with top 30% of hands; re-raise with top 10%

REMEMBER: Selective aggression beats constant aggression. Pick your spots.`,

    conservative: `You are a tight-selective poker player who wins by avoiding bad spots and extracting value from strong hands.

PRE-FLOP (strict hand selection):
- Raise 3x BB with: AA, KK, QQ, JJ, TT, AKs, AKo, AQs, AQo
- Call (if raise is ≤ 3x BB): 99-22, AJs-A9s, KQs, suited connectors JTs/T9s/98s
- Fold to raises > 4x BB unless you hold a premium hand (JJ+, AK)
- Do NOT go all-in pre-flop unless short-stacked (< 20 BB) with AA or KK

POST-FLOP (value-bet your made hands):
- Two pair or better: bet 35-50% of pot for value; continue against re-raises
- Top pair top kicker: bet 30-40% of pot; fold to large re-raises (> 60% pot)
- Middle pair or weaker: check/call one street at most; fold to large bets
- Missed draws: check/fold
- No bluffing except rare blocking bets (25% pot) in position

REMEMBER: You win by staying out of trouble and collecting value when you're ahead.`,

    aggressive: `You are a loose-aggressive (LAG) player — you take initiative and apply consistent pressure.

PRE-FLOP (attack early):
- Raise 3x BB (3.5x from early position) with top 45% of hands
- From Button/Cutoff: raise with top 55% of hands — position is your edge
- Do NOT go all-in pre-flop with anything below QQ unless facing a jam with < 20 BB
- Standard pre-flop raise is 3x BB — NOT pot-sized, NOT all-in

POST-FLOP (keep pressure on):
- C-bet 65-70% of flops you raised pre-flop: use 45-58% of pot
- Strong hands (two pair+): bet 55-70% of pot; raise draws when possible
- Medium hands (top pair): bet 45-55% of pot; fold to big re-raises
- Semi-bluff draws: bet 40-55% of pot about 55% of the time
- Pure bluff in position: 40-50% of pot; check/fold out of position

BET SIZING RULE: Use 45-70% pot for most situations. Use 75-85% only for strong value or big bluffs on final street.

REMEMBER: Consistent aggression wins more pots — but pick smart spots rather than going all-in every hand.`,

    random: `You are a wildly unpredictable poker player. Your chaos comes from surprising decision patterns, not constant maximum betting.

PRE-FLOP — be unpredictable:
- Sometimes raise with trash (use 3-4x BB sizing), sometimes fold good hands
- Occasionally limp instead of raising, or re-raise as a bluff
- Do NOT go all-in pre-flop every hand — only about 1 in 8 hands max

POST-FLOP — mix it up:
- Randomly choose between bet, check, or fold regardless of hand strength
- Bet sizing varies: sometimes 25% pot, sometimes 60% pot, sometimes 80% pot
- Go all-in post-flop only occasionally (< 20% of decisions) — keep it surprising not suicidal

REMEMBER: Your unpredictability wins over time — but you need chips to stay in the game. Don't go broke in one hand.`,
  };

  return `You are a Texas Hold'em poker player named "${botName}".
${styles[difficulty]}

OUTPUT FORMAT: Respond with ONLY a valid JSON object. No explanation, no markdown, no other text.
Schema: {"reasoning": "<1 short sentence in English explaining your decision>", "action": "fold"|"check"|"call"|"raise"|"all_in", "amount": <integer or null>}
- "reasoning": brief English explanation (e.g. "Top pair top kicker, value bet.")
- "amount" is ONLY for "raise" (= the TOTAL bet amount, not additional chips to add)
- For fold/check/call/all_in, set "amount" to null
- Only use actions listed as valid in the user message`;
}

// Hand strength advice table — moderate sizing, style-agnostic baseline
const HAND_STRENGTH_ADVICE: Record<string, string> = {
  royal_flush:    '★★★★★ ABSOLUTE NUTS — Raise large or slow-play; can go all-in on final street',
  straight_flush: '★★★★★ NEAR NUTS — Raise large 70-85% pot; consider all-in if stacks are deep',
  four_of_a_kind: '★★★★☆ MONSTER — Raise 65-80% pot; slow-play occasionally to keep opponents in',
  full_house:     '★★★★☆ VERY STRONG — Raise 55-70% pot; rarely fold',
  flush:          '★★★☆☆ STRONG — Raise 50-65% pot; fold only to extreme pressure',
  straight:       '★★★☆☆ STRONG — Raise 50-60% pot; watch out for flush draws on board',
  three_of_a_kind:'★★★☆☆ GOOD — Raise 45-58% pot; charge flush/straight draws',
  two_pair:       '★★☆☆☆ SOLID — Raise 40-55% pot; fold to very large re-raises on paired boards',
  one_pair:       '★★☆☆☆ MEDIUM — Bet 30-45% pot with top pair; check/call with weaker pairs',
  high_card:      '★☆☆☆☆ WEAK — Check or fold typically; bluff-bet 30-45% pot only in position',
};

// Pre-flop hole card strength hint
function preFlopHint(c1: { rank: string; suit: string }, c2: { rank: string; suit: string }): string {
  const highRanks = new Set(['A', 'K', 'Q', 'J', 'T']);
  const isPair = c1.rank === c2.rank;
  const isSuited = c1.suit === c2.suit;
  const bothHigh = highRanks.has(c1.rank) && highRanks.has(c2.rank);
  const oneAce = c1.rank === 'A' || c2.rank === 'A';

  if (isPair && ['A', 'K', 'Q', 'J'].includes(c1.rank)) return '★★★★☆ Premium pocket pair — raise 3-4x BB always';
  if (isPair) return '★★★☆☆ Pocket pair — raise 2.5-3x BB to set-mine';
  if (bothHigh && isSuited) return '★★★★☆ Premium suited connectors (e.g. AKs) — raise 3-4x BB';
  if (bothHigh) return '★★★☆☆ Strong Broadway hands — raise 3x BB';
  if (oneAce && isSuited) return '★★★☆☆ Suited Ace — raise in position, call out of position';
  if (isSuited) return '★★☆☆☆ Suited connectors — raise in position, call or fold elsewhere';
  return '★☆☆☆☆ Weak hand — raise only in position as a bluff, otherwise fold to raises';
}

/**
 * Build the user-turn prompt for the LLM.
 * Accepts pre-computed validActions to avoid redundant computation.
 */
export function buildBotUserPrompt(
  state: GameState,
  botPlayerId: string,
  validActions: ValidActions,
  difficulty: BotDifficulty = 'expert'
): string {
  const bot = state.players.find((p) => p.id === botPlayerId);
  if (!bot || !bot.holeCards) return 'You have no cards. Check or fold.';

  // ── Hand strength evaluation ─────────────────────────────────────────────
  let handStrengthSection = '';
  if (state.communityCards.length >= 3 && bot.holeCards) {
    const rank = evaluateHand(bot.holeCards, state.communityCards);
    const advice = HAND_STRENGTH_ADVICE[rank.name] ?? 'Evaluate carefully';
    handStrengthSection = `\nYour current best hand: ${rank.name.replace(/_/g, ' ').toUpperCase()}
Strength: ${advice}`;
  } else {
    // Pre-flop: give hole card strength hint
    const [c1, c2] = bot.holeCards;
    handStrengthSection = `\nPre-flop hole card strength: ${preFlopHint(c1, c2)}`;
  }

  // ── Valid actions list — fold goes LAST ──────────────────────────────────
  const validList: string[] = [];
  if (validActions.canCheck) validList.push('check');
  if (validActions.canCall) validList.push(`call (costs ${validActions.callAmount} chips)`);
  if (validActions.canRaise) validList.push(`raise (min: ${validActions.minRaise}, max: ${validActions.maxRaise})`);
  if (validActions.canAllIn) validList.push(`all_in (${validActions.allInAmount} chips — pushes all your chips in)`);
  validList.push('fold');

  // ── Community cards ──────────────────────────────────────────────────────
  const community = state.communityCards.length > 0
    ? state.communityCards.map(cardToString).join(' ')
    : 'none (pre-flop)';

  // ── Opponent summary ─────────────────────────────────────────────────────
  const opponentSummary = state.players
    .filter((p) => p.id !== botPlayerId && p.status !== 'sitting_out')
    .map((p) => {
      const recentActions = state.actionHistory
        .filter((a) => a.playerId === p.id)
        .slice(-3)
        .map((a) => `${a.type}${a.amount ? ` ${a.amount}` : ''}`)
        .join(', ');
      return `  ${p.name}: ${p.chipStack} chips, status=${p.status}${recentActions ? ` (recent: ${recentActions})` : ''}`;
    })
    .join('\n');

  // ── Pot odds ─────────────────────────────────────────────────────────────
  const potOdds = validActions.canCall && validActions.callAmount > 0
    ? `${Math.round((state.pot / validActions.callAmount) * 100) / 100}:1 (>3:1 = profitable call)`
    : 'N/A (no bet to call)';

  // ── Recent action history ─────────────────────────────────────────────────
  const lastActions = state.actionHistory.slice(-6)
    .map((a) => {
      const player = state.players.find((p) => p.id === a.playerId);
      return `${player?.name ?? a.playerId}: ${a.type}${a.amount ? ` ${a.amount}` : ''}`;
    })
    .join(' → ') || 'none';

  // ── Suggested raise sizes for convenience ────────────────────────────────
  let raiseSuggestion = '';
  if (validActions.canRaise) {
    const bb = state.config?.bigBlind ?? 1;
    const potRaise55 = Math.min(
      Math.max(validActions.minRaise, Math.round(state.pot * 0.55)),
      validActions.maxRaise
    );
    const potRaise70 = Math.min(
      Math.max(validActions.minRaise, Math.round(state.pot * 0.7)),
      validActions.maxRaise
    );
    const preFlopStd = Math.min(
      Math.max(validActions.minRaise, Math.round(bb * 3)),
      validActions.maxRaise
    );
    if (state.phase === 'pre_flop') {
      raiseSuggestion = `\n  → Standard pre-flop raise: ${preFlopStd} (3x BB=${bb}). Max pre-flop all-in only with AA/KK/QQ vs re-raise or stack ≤ 15 BB.`;
    } else {
      raiseSuggestion = `\n  → Suggested raise sizes: 55% pot = ${potRaise55}, 70% pot = ${potRaise70}`;
    }
  }

  // Style-specific decision bias
  const styleBias: Record<BotDifficulty, string> = {
    conservative: 'If unsure, prefer check or call over raise. Only raise with two pair or better postflop. Fold to large bets without a strong made hand.',
    aggressive:   'Lean toward raising with any equity (draws, top pair, position). Use 45-65% pot sizing. Fold clear misses to big bets.',
    random:       'Be unpredictable — any action is valid. Vary your sizing and decisions. Avoid going all-in more than once every several hands.',
    expert:       'Raise with medium+ hands when you have the edge. Use the pot odds as your guide. Fold clear trash to aggression.',
    intermediate: 'Raise with strong made hands, call with decent pot odds, fold marginal hands to pressure.',
    novice:       'Call with decent hands and good pot odds. Fold obvious trash. Keep bets small.',
  };

  return `=== POKER DECISION ===
Phase: ${state.phase.toUpperCase()} | Hand #${state.handNumber}
Your hole cards: ${bot.holeCards.map(cardToString).join(' ')}${handStrengthSection}
Community cards: ${community}
Pot: ${state.pot} chips | Your stack: ${bot.chipStack} chips
Your position: ${positionName(bot.seatIndex, state.dealerSeatIndex, state.smallBlindSeatIndex, state.bigBlindSeatIndex)}
Current bet to call: ${state.currentBetAmount} chips (you've already put in: ${bot.currentBet})
Call cost: ${validActions.callAmount} chips | Pot odds: ${potOdds}

Opponents:
${opponentSummary || '  (none)'}

Recent actions: ${lastActions}

VALID ACTIONS (choose one):
${validList.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}${raiseSuggestion}

DECISION GUIDE:
1. Hand strength? → See rating above
2. Position? → Button/late = more options; blinds = play tighter
3. Pot odds justify calling? → ${potOdds}
4. ${styleBias[difficulty]}

Output ONLY JSON: {"reasoning": "one short English sentence", "action": "...", "amount": null_or_integer}`;
}
