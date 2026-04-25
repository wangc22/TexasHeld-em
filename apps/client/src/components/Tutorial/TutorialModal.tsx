import { useEffect, useMemo, useState } from 'react';
import { ActionPanel } from '../Actions/ActionPanel.js';
import { PokerTable } from '../Table/PokerTable.js';
import { useAuthStore } from '../../store/authStore.js';
import { computeValidActions, evaluateHand } from '@texas-poker/shared';
import type { Card, GameState, Player, PlayerAction, PlayerStatus } from '@texas-poker/shared';

interface Props {
  onClose: () => void;
}

const HERO_ID = 'tutorial-player';
const BOT1_ID = 'tutorial-bot-1';
const BOT2_ID = 'tutorial-bot-2';
const STREETS = ['pre_flop', 'flop', 'turn', 'river', 'showdown'] as const;
type Street = (typeof STREETS)[number];
const DENOMS = [2, 5, 10, 20, 50, 100];
const SB = 10;
const BB = 20;
const RAISE_UNIT = 20;

const HERO_CARDS: [Card, Card] = [{ rank: 'Q', suit: 'clubs' }, { rank: '3', suit: 'clubs' }];
const BOT1_CARDS: [Card, Card] = [{ rank: 'T', suit: 'spades' }, { rank: '8', suit: 'spades' }];
const BOT2_CARDS: [Card, Card] = [{ rank: 'A', suit: 'hearts' }, { rank: 'J', suit: 'hearts' }];
const SCRIPTED_BOARD: Card[] = [
  { rank: 'A', suit: 'diamonds' },
  { rank: '7', suit: 'hearts' },
  { rank: '5', suit: 'clubs' },
  { rank: 'J', suit: 'spades' },
  { rank: '2', suit: 'diamonds' },
];

type TutorialHighlightTarget =
  | 'dealer'
  | 'sb'
  | 'bb'
  | 'blindBets'
  | 'actionPanel'
  | 'centerPot'
  | 'ruleBtn'
  | 'fold'
  | 'check'
  | 'call'
  | 'allin'
  | 'raiseArea'
  | 'raiseInput'
  | 'addChips'
  | null;

type GuideStep = {
  textZh: string;
  textEn: string;
  highlight: Exclude<TutorialHighlightTarget, null>;
};

type TutorialState = {
  streetIndex: number;
  players: Player[];
  currentPlayerId: string;
  currentBetAmount: number;
  minRaise: number;
  pot: number;
  finished: boolean;
  handNumber: number;
};

const GUIDE_STEPS: GuideStep[] = [
  { textZh: '这是 Dealer（庄位），控制发牌顺序。', textEn: 'This is the Dealer button.', highlight: 'dealer' },
  { textZh: '这是小盲（SB），每手开局先强制下 10。', textEn: 'This is Small Blind (SB), forced 10.', highlight: 'sb' },
  { textZh: '这是大盲（BB），强制下 20，通常是本轮最低开局注。', textEn: 'This is Big Blind (BB), forced 20.', highlight: 'bb' },
  { textZh: '这是 Fold：弃牌并放弃本手。', textEn: 'Fold: give up this hand.', highlight: 'fold' },
  { textZh: '这是 Check：不加注直接过牌（仅在可过牌时可用）。', textEn: 'Check: pass action without betting.', highlight: 'check' },
  { textZh: '这是 Call：跟到当前最高注。', textEn: 'Call: match the highest bet.', highlight: 'call' },
  { textZh: '这是 All-in：一次推入剩余全部筹码。', textEn: 'All-in: push all remaining chips.', highlight: 'allin' },
  { textZh: '这是加注区域，可调整目标注额。', textEn: 'Raise area for target amount.', highlight: 'raiseArea' },
  { textZh: '这是加注输入框，直接输入目标注额。', textEn: 'Raise input for exact value.', highlight: 'raiseInput' },
  { textZh: '这是快速加筹码按钮，可快速调节加注值。', textEn: 'Quick chip buttons for raise.', highlight: 'addChips' },
  {
    textZh: '最后记住：所有玩家都得下注到同样的数值，才可以 proceed 到下一步。你现在下注是 0，得 raise 到 20 才能继续游戏。',
    textEn: 'Remember: the hand proceeds only after all players match the same bet amount. Your current bet is 0, so you need to raise to 20 to continue.',
    highlight: 'blindBets',
  },
  {
    textZh: '玩家下注的筹码会出现在桌子中间，胜利的人可以拿走全部筹码。',
    textEn: 'Bets move to the middle pot, and the winner takes all chips.',
    highlight: 'centerPot',
  },
  {
    textZh: '胜利条件是坚持到最后并比较牌型大小；牌型大小可以看 Rule。',
    textEn: 'To win, survive to showdown and beat others by hand rank; check Rule anytime.',
    highlight: 'ruleBtn',
  },
];

function createInitialTutorialState(): TutorialState {
  const hero: Player = {
    id: HERO_ID, name: 'You', isBot: false, seatIndex: 0, chipStack: 1000, holeCards: HERO_CARDS,
    status: 'active', currentBet: 0, totalBetThisHand: 0, isConnected: true, isReady: true, startingChipStack: 1000,
  };
  const bot1: Player = {
    id: BOT1_ID, name: 'AI 1', isBot: true, seatIndex: 1, chipStack: 1000 - SB, holeCards: null,
    status: 'active', currentBet: SB, totalBetThisHand: SB, isConnected: true, isReady: true, startingChipStack: 1000,
  };
  const bot2: Player = {
    id: BOT2_ID, name: 'AI 2', isBot: true, seatIndex: 2, chipStack: 1000 - BB, holeCards: null,
    status: 'active', currentBet: BB, totalBetThisHand: BB, isConnected: true, isReady: true, startingChipStack: 1000,
  };
  return {
    streetIndex: 0,
    players: [hero, bot1, bot2],
    currentPlayerId: HERO_ID,
    currentBetAmount: BB,
    minRaise: BB,
    pot: SB + BB,
    finished: false,
    handNumber: 1,
  };
}

function getStreetBoardCount(streetIndex: number): number {
  if (streetIndex <= 0) return 0;
  if (streetIndex === 1) return 3;
  if (streetIndex === 2) return 4;
  return 5;
}
function computePot(players: Player[]): number { return players.reduce((sum, p) => sum + p.totalBetThisHand, 0); }
function withPlayers(state: TutorialState, updater: (players: Player[]) => Player[]): TutorialState {
  const players = updater(state.players);
  return { ...state, players, pot: computePot(players) };
}
function nextActivePlayerId(players: Player[], currentPlayerId: string): string {
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const idx = sorted.findIndex((p) => p.id === currentPlayerId);
  if (idx < 0) return sorted[0]?.id ?? currentPlayerId;
  for (let step = 1; step <= sorted.length; step += 1) {
    const p = sorted[(idx + step) % sorted.length];
    if (p.status !== 'folded' && p.status !== 'all_in') return p.id;
  }
  return currentPlayerId;
}
function firstActiveFromSeat(players: Player[], startSeat: number): string {
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const startIdx = sorted.findIndex((p) => p.seatIndex === startSeat);
  if (startIdx < 0) return sorted[0]?.id ?? HERO_ID;
  for (let step = 0; step < sorted.length; step += 1) {
    const p = sorted[(startIdx + step) % sorted.length];
    if (p.status !== 'folded' && p.status !== 'all_in') return p.id;
  }
  return sorted[startIdx].id;
}
function isRoundComplete(players: Player[], currentBetAmount: number): boolean {
  const active = players.filter((p) => p.status !== 'folded');
  if (active.length <= 1) return true;
  const allMatched = active.every((p) => p.status === 'all_in' || p.currentBet === currentBetAmount);
  const noActive = active.every((p) => p.status !== 'active');
  return allMatched && noActive;
}
function settleWinner(state: TutorialState): TutorialState {
  const alive = state.players.filter((p) => p.status !== 'folded');
  if (alive.length === 1) {
    const winnerId = alive[0].id;
    return withPlayers({ ...state, finished: true, currentPlayerId: HERO_ID }, (players) =>
      players.map((p) => (p.id === winnerId ? { ...p, chipStack: p.chipStack + state.pot } : p)));
  }
  const ranks = alive.map((p) => {
    const cards = p.id === HERO_ID ? HERO_CARDS : p.id === BOT1_ID ? BOT1_CARDS : BOT2_CARDS;
    return { playerId: p.id, value: evaluateHand(cards, SCRIPTED_BOARD).value };
  });
  const best = Math.max(...ranks.map((r) => r.value));
  const winners = ranks.filter((r) => r.value === best).map((r) => r.playerId);
  const split = Math.floor(state.pot / winners.length);
  const sortedWinners = [...winners].sort((a, b) => {
    const pa = state.players.find((p) => p.id === a)!;
    const pb = state.players.find((p) => p.id === b)!;
    return pa.seatIndex - pb.seatIndex;
  });
  let rem = state.pot - split * winners.length;
  return withPlayers({ ...state, finished: true, currentPlayerId: HERO_ID }, (players) =>
    players.map((p) => {
      if (!winners.includes(p.id)) return p;
      const extra = rem > 0 && sortedWinners[0] === p.id ? 1 : 0;
      if (extra === 1) rem -= 1;
      return { ...p, chipStack: p.chipStack + split + extra };
    }));
}
function advanceStreet(state: TutorialState): TutorialState {
  const nextStreetIndex = Math.min(state.streetIndex + 1, STREETS.length - 1);
  if (nextStreetIndex >= 4) return settleWinner({ ...state, streetIndex: 4 });
  const resetPlayers = state.players.map((p) => ({
    ...p, currentBet: 0, holeCards: p.id === HERO_ID ? HERO_CARDS : null,
    status: (p.status === 'folded' || p.status === 'all_in' ? p.status : 'active') as PlayerStatus,
  }));
  return {
    ...state, streetIndex: nextStreetIndex, players: resetPlayers, currentBetAmount: 0, minRaise: BB,
    currentPlayerId: firstActiveFromSeat(resetPlayers, 1), pot: computePot(resetPlayers),
  };
}
function applyTutorialAction(state: TutorialState, playerId: string, action: PlayerAction): TutorialState {
  if (state.finished || state.currentPlayerId !== playerId) return state;
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return state;
  const player = state.players[idx];
  const valid = computeValidActions(player, state.currentBetAmount, state.minRaise, state.pot);
  const toCall = Math.max(0, state.currentBetAmount - player.currentBet);
  let next = { ...state };
  let players = [...state.players];
  if (action.type === 'check' && !valid.canCheck) return state;
  if (action.type === 'call' && !valid.canCall) return state;
  if (action.type === 'raise' && !valid.canRaise) return state;
  if (action.type === 'all_in' && !valid.canAllIn) return state;

  if (action.type === 'fold') players[idx] = { ...player, status: 'folded' };
  else if (action.type === 'check') players[idx] = { ...player, status: 'acted' };
  else if (action.type === 'call') {
    const callAmt = Math.min(toCall, player.chipStack);
    const isAllIn = callAmt === player.chipStack;
    players[idx] = { ...player, chipStack: player.chipStack - callAmt, currentBet: player.currentBet + callAmt, totalBetThisHand: player.totalBetThisHand + callAmt, status: isAllIn ? 'all_in' : 'acted' };
  } else if (action.type === 'raise') {
    const target = Math.max(valid.minRaise, Math.min(valid.maxRaise, action.amount ?? valid.minRaise));
    const add = Math.min(target - player.currentBet, player.chipStack);
    const isAllIn = add === player.chipStack;
    players[idx] = { ...player, chipStack: player.chipStack - add, currentBet: player.currentBet + add, totalBetThisHand: player.totalBetThisHand + add, status: isAllIn ? 'all_in' : 'acted' };
    const raiseSize = players[idx].currentBet - state.currentBetAmount;
    next.currentBetAmount = Math.max(state.currentBetAmount, players[idx].currentBet);
    next.minRaise = Math.max(BB, raiseSize);
    players = players.map((p, pIdx) => (pIdx !== idx && p.status === 'acted' ? { ...p, status: 'active' } : p));
  } else if (action.type === 'all_in') {
    const add = player.chipStack;
    players[idx] = { ...player, chipStack: 0, currentBet: player.currentBet + add, totalBetThisHand: player.totalBetThisHand + add, status: 'all_in' };
    if (players[idx].currentBet > state.currentBetAmount) {
      const raiseSize = players[idx].currentBet - state.currentBetAmount;
      next.currentBetAmount = players[idx].currentBet;
      next.minRaise = Math.max(BB, raiseSize);
      players = players.map((p, pIdx) => (pIdx !== idx && p.status === 'acted' ? { ...p, status: 'active' } : p));
    }
  }
  next.players = players;
  next.pot = computePot(players);
  const alive = players.filter((p) => p.status !== 'folded');
  if (alive.length <= 1) return settleWinner(next);
  if (isRoundComplete(players, next.currentBetAmount)) return advanceStreet(next);
  return { ...next, currentPlayerId: nextActivePlayerId(players, playerId) };
}
function pickRandomBotAction(player: Player, state: TutorialState): PlayerAction {
  const valid = computeValidActions(player, state.currentBetAmount, state.minRaise, state.pot);
  const randomPick = Math.floor(Math.random() * 4); // raise/call/fold/check equiprobable
  if (randomPick === 0) {
    if (valid.canRaise) return { type: 'raise', amount: Math.max(valid.minRaise, Math.min(valid.maxRaise, state.currentBetAmount + RAISE_UNIT)) };
    if (valid.canCall) return { type: 'call' };
    if (valid.canCheck) return { type: 'check' };
    return { type: 'fold' };
  }
  if (randomPick === 1) return valid.canCall ? { type: 'call' } : valid.canCheck ? { type: 'check' } : { type: 'fold' };
  if (randomPick === 2) return { type: 'fold' };
  if (valid.canCheck) return { type: 'check' };
  if (valid.canCall) return { type: 'call' };
  return { type: 'fold' };
}

export function TutorialModal({ onClose }: Props) {
  const language = useAuthStore((s) => s.language);
  const [state, setState] = useState<TutorialState>(createInitialTutorialState);
  const [guideStep, setGuideStep] = useState(0);
  const [pendingBotAction, setPendingBotAction] = useState<PlayerAction | null>(null);
  const [pendingBotId, setPendingBotId] = useState<string | null>(null);
  const [botBubbles, setBotBubbles] = useState<Record<string, string>>({});
  const guideActive = guideStep < GUIDE_STEPS.length;
  const guide = GUIDE_STEPS[Math.min(guideStep, GUIDE_STEPS.length - 1)];
  const currentStreet: Street = STREETS[state.streetIndex];
  const communityCards = SCRIPTED_BOARD.slice(0, getStreetBoardCount(state.streetIndex));
  const canAct = !guideActive && state.currentPlayerId === HERO_ID && !state.finished;
  const tutorialHighlight: TutorialHighlightTarget = guideActive ? guide.highlight : null;
  const markerPositions = {
    dealer: { left: 49.45, top: 84.3, width: 22, height: 13 },
    sb: { left: 19.3, top: 75.5, width: 26, height: 13 },
    bb: { left: 4.25, top: 50.5, width: 26, height: 13 },
  } as const;

  const displayPlayers = useMemo(
    () => state.players.map((p) => {
      if (p.id === HERO_ID) return { ...p, holeCards: HERO_CARDS };
      const reveal = currentStreet === 'showdown' || state.finished;
      if (!reveal) return { ...p, holeCards: null };
      const cards = p.id === BOT1_ID ? BOT1_CARDS : BOT2_CARDS;
      return { ...p, holeCards: cards };
    }),
    [currentStreet, state.finished, state.players]
  );

  const tutorialGameState: GameState = useMemo(() => ({
    tableId: 'tutorial-room',
    config: { maxPlayers: 9, smallBlind: SB, bigBlind: BB, turnTimeoutMs: 30_000, minBuyIn: 500, maxBuyIn: 5000, chipDenominations: DENOMS, maxHands: 0 },
    phase: currentStreet,
    players: displayPlayers,
    communityCards,
    pot: state.pot,
    sidePots: [],
    currentPlayerSeatIndex: state.players.find((p) => p.id === state.currentPlayerId)?.seatIndex ?? 0,
    dealerSeatIndex: 0,
    smallBlindSeatIndex: 1,
    bigBlindSeatIndex: 2,
    currentBetAmount: state.currentBetAmount,
    minRaise: state.minRaise,
    handNumber: state.handNumber,
    actionHistory: [],
    sessionStarted: true,
    sessionHandCount: state.handNumber,
    hostPlayerId: HERO_ID,
    handHistory: [],
  }), [communityCards, currentStreet, displayPlayers, state]);

  useEffect(() => {
    if (guideActive || state.finished || pendingBotAction) return;
    const current = state.players.find((p) => p.id === state.currentPlayerId);
    if (!current || !current.isBot) return;
    setPendingBotId(current.id);
    setPendingBotAction(pickRandomBotAction(current, state));
  }, [guideActive, pendingBotAction, state]);

  useEffect(() => {
    if (!pendingBotAction || !pendingBotId) return;
    const actorId = pendingBotId;
    const t = setTimeout(() => {
      const actor = state.players.find((p) => p.id === actorId);
      if (actor) {
        const toCall = Math.max(0, state.currentBetAmount - actor.currentBet);
        const text = (() => {
          if (pendingBotAction.type === 'fold') return `${actor.name}: Fold`;
          if (pendingBotAction.type === 'check') return `${actor.name}: Check`;
          if (pendingBotAction.type === 'call') return `${actor.name}: Call ${toCall}`;
          if (pendingBotAction.type === 'raise') return `${actor.name}: Raise ${pendingBotAction.amount ?? state.currentBetAmount + RAISE_UNIT}`;
          if (pendingBotAction.type === 'all_in') return `${actor.name}: All-in`;
          return `${actor.name}: Action`;
        })();
        setBotBubbles((prev) => ({ ...prev, [actorId]: text }));
        setTimeout(() => {
          setBotBubbles((prev) => {
            const next = { ...prev };
            delete next[actorId];
            return next;
          });
        }, 1800);
      }
      setState((prev) => applyTutorialAction(prev, actorId, pendingBotAction));
      setPendingBotAction(null);
      setPendingBotId(null);
    }, 850);
    return () => clearTimeout(t);
  }, [pendingBotAction, pendingBotId, state.currentBetAmount, state.players]);

  useEffect(() => {
    if (!state.finished || state.handNumber >= 2) return;
    const t = setTimeout(() => {
      const next = createInitialTutorialState();
      setState({ ...next, handNumber: state.handNumber + 1 });
      setBotBubbles({});
    }, 1400);
    return () => clearTimeout(t);
  }, [state.finished, state.handNumber]);

  return (
    <div className="fixed inset-0 bg-black z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full h-full flex flex-col relative">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-2 right-3 z-[61] text-slate-400 hover:text-white transition-colors text-2xl leading-none px-2"
          aria-label="Close"
        >
          ✕
        </button>

        <div
          className="flex items-center justify-end px-4 py-1.5 shrink-0"
          style={{
            background: 'linear-gradient(180deg, #0c1528 0%, #080f1e 100%)',
            borderBottom: '1px solid rgba(100,116,139,0.2)',
          }}
        >
          <div className="relative shrink-0 group mr-[25%]">
            <button
              type="button"
              className="text-sm px-3 py-1 text-slate-300 rounded-md transition-colors hover:text-white"
              style={{ background: 'rgba(21,32,64,0.6)', border: '1px solid rgba(100,116,139,0.3)' }}
              data-highlighted={tutorialHighlight === 'ruleBtn' ? 'true' : 'false'}
            >
              Rule
            </button>
            <div
              className="pointer-events-none absolute right-0 top-full z-[80] hidden pt-2 group-hover:block group-hover:pointer-events-auto"
              role="presentation"
            >
              <div
                className="rounded-lg overflow-hidden border border-slate-600/80 bg-black shadow-2xl"
                style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.85)' }}
              >
                <img
                  src="/image/hand-ranking.jpg"
                  alt=""
                  className="block max-h-[min(78vh,720px)] w-auto max-w-[min(calc(100vw-2rem),520px)] object-contain object-top"
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full flex-1 min-h-0 p-2 overflow-hidden relative" style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(21,32,64,0.5) 0%, transparent 100%)' }}>
          <div className="absolute inset-0"><PokerTable gameState={tutorialGameState} /></div>
          <style>{`
            [data-highlighted="true"]{
              outline: 3px solid rgba(245, 200, 66, 0.95);
              outline-offset: 3px;
              box-shadow: 0 0 0 6px rgba(245, 200, 66, 0.18), 0 10px 28px rgba(0,0,0,0.55);
              animation: tutorialPulse 1.1s ease-in-out infinite;
              border-radius: 12px;
            }
            @keyframes tutorialPulse { 0%, 100% { transform: translateZ(0) scale(1); } 50% { transform: translateZ(0) scale(1.02); } }
          `}</style>

          {(tutorialHighlight === 'dealer' || tutorialHighlight === 'sb' || tutorialHighlight === 'bb') && (
            <>
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-xl"
                data-highlighted={tutorialHighlight === 'dealer' ? 'true' : 'false'}
                style={{
                  left: `${markerPositions.dealer.left}%`,
                  top: `${markerPositions.dealer.top}%`,
                  width: markerPositions.dealer.width,
                  height: markerPositions.dealer.height,
                }}
              />
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-xl"
                data-highlighted={tutorialHighlight === 'sb' ? 'true' : 'false'}
                style={{
                  left: `${markerPositions.sb.left}%`,
                  top: `${markerPositions.sb.top}%`,
                  width: markerPositions.sb.width,
                  height: markerPositions.sb.height,
                }}
              />
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-xl"
                data-highlighted={tutorialHighlight === 'bb' ? 'true' : 'false'}
                style={{
                  left: `${markerPositions.bb.left}%`,
                  top: `${markerPositions.bb.top}%`,
                  width: markerPositions.bb.width,
                  height: markerPositions.bb.height,
                }}
              />
            </>
          )}

          {tutorialHighlight === 'blindBets' && (
            <>
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-xl"
                data-highlighted="true"
                style={{ left: '25%', top: '80%', width: 46, height: 28, zIndex: 24 }}
              />
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-xl"
                data-highlighted="true"
                style={{ left: '10%', top: '55%', width: 46, height: 28, zIndex: 24 }}
              />
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-xl"
                data-highlighted="true"
                style={{ left: '55%', top: '86%', width: 46, height: 28, zIndex: 24 }}
              />
            </>
          )}

          {tutorialHighlight === 'centerPot' && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-xl"
              data-highlighted="true"
              style={{ left: '47.3%', top: '55%', width: 96, height: 38, zIndex: 24 }}
            />
          )}

          {Object.entries(botBubbles).map(([playerId, text]) => {
            const player = tutorialGameState.players.find((p) => p.id === playerId);
            if (!player) return null;
            const top = player.seatIndex === 2 ? '43%' : '66%';
            return (
              <div
                key={`${playerId}-${text}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-chat-bubble"
                style={{ left: `${player.seatIndex === 1 ? 20 : 5}%`, top, zIndex: 25, maxWidth: '170px' }}
              >
                <div
                  className="relative text-xs text-slate-100 px-2.5 py-1.5 rounded-xl leading-snug text-center"
                  style={{ background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(100,116,139,0.35)' }}
                >
                  {text}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid rgba(15,23,42,0.92)',
                    }}
                  />
                </div>
              </div>
            );
          })}

          {guideActive && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-xl text-center max-w-[80vw]" style={{ background: 'rgba(9,19,34,0.92)', border: '1px solid rgba(148,163,184,0.35)' }}>
              <div className="text-slate-100 text-sm">{language === 'zh' ? guide.textZh : guide.textEn}</div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  className="text-xs px-3 py-1 rounded-md bg-slate-600/80 text-white hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={guideStep <= 0}
                  onClick={() => setGuideStep((s) => Math.max(0, s - 1))}
                >
                  {language === 'zh' ? '上一步' : 'Back'}
                </button>
                <button
                  type="button"
                  className="text-xs px-3 py-1 rounded-md bg-indigo-500/85 text-white hover:bg-indigo-400"
                  onClick={() => setGuideStep((s) => s + 1)}
                >
                  {language === 'zh' ? '下一步' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 shrink-0 overflow-x-auto" style={{ background: 'rgba(6,11,24,0.85)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(100,116,139,0.18)' }}>
          <div className="w-full max-w-[980px] mx-auto">
            <div
              data-highlighted={tutorialHighlight === 'actionPanel' ? 'true' : 'false'}
              className="rounded-xl"
              style={{ opacity: canAct ? 1 : 0.65, pointerEvents: canAct ? 'auto' : 'none' }}
            >
              <ActionPanel
                player={tutorialGameState.players.find((p) => p.id === HERO_ID)!}
                gameState={tutorialGameState}
                highlight={
                  tutorialHighlight === 'fold'
                  || tutorialHighlight === 'check'
                  || tutorialHighlight === 'call'
                  || tutorialHighlight === 'allin'
                  || tutorialHighlight === 'raiseArea'
                  || tutorialHighlight === 'raiseInput'
                  || tutorialHighlight === 'addChips'
                    ? tutorialHighlight
                    : undefined
                }
                onSendAction={(type, amount) => {
                  if (!canAct) return;
                  setState((prev) => applyTutorialAction(prev, HERO_ID, { type, amount }));
                }}
              />
            </div>
            {!canAct && (
              <div className="rounded-xl p-3 text-center text-slate-400" style={{ background: 'rgba(12,21,40,0.75)', border: '1px solid rgba(100,116,139,0.25)' }}>
                {guideActive
                  ? (language === 'zh' ? '请先完成开局引导' : 'Please finish the opening guide first')
                  : (
                    state.finished
                      ? (
                        state.handNumber < 2
                          ? (language === 'zh' ? '本手结束，正在开始额外一局...' : 'Hand complete, starting one extra hand...')
                          : (language === 'zh' ? '两局教程已完成' : 'Two tutorial hands complete')
                      )
                      : (language === 'zh' ? 'AI 回合中...' : 'AI turn...')
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
