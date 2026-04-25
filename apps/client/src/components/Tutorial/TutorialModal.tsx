import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionPanel } from '../Actions/ActionPanel.js';
import { PlayingCard } from '../Card/PlayingCard.js';
import { BetDisplay } from '../Table/BetDisplay.js';
import { useAuthStore } from '../../store/authStore.js';
import { useLang } from '../../i18n/useLang.js';
import { computeValidActions, evaluateHand } from '@texas-poker/shared';
import type { Card, GameState, Player, PlayerAction, PlayerStatus } from '@texas-poker/shared';
import type { Language } from '../../i18n/strings.js';

interface Props {
  onClose: () => void;
}

const NPC_FRAMES = ['/image/default.png', '/image/mid-blink.png', '/image/fully-blink.png', '/image/look-right.png'] as const;
const HERO_ID = 'tutorial-player';
const NPC_ID = 'tutorial-npc';
const STREETS = ['pre_flop', 'flop', 'turn', 'river', 'showdown'] as const;
type Street = (typeof STREETS)[number];
const DENOMS = [2, 5, 10, 20, 50, 100];
const SB = 10;
const BB = 20;

const HERO_CARDS: [Card, Card] = [
  { rank: 'T', suit: 'spades' },
  { rank: '2', suit: 'clubs' },
];
const NPC_CARDS: [Card, Card] = [
  { rank: '2', suit: 'hearts' },
  { rank: '5', suit: 'clubs' },
];
const headerBtnStyle = {
  background: 'rgba(21,32,64,0.6)',
  border: '1px solid rgba(100,116,139,0.3)',
};

const SCRIPTED_BOARD: Card[] = [
  { rank: '3', suit: 'hearts' },
  { rank: '6', suit: 'hearts' },
  { rank: '8', suit: 'hearts' },
  { rank: 'T', suit: 'diamonds' },
  { rank: '7', suit: 'spades' },
];

type TutorialHighlightTarget =
  | 'heroBlind10'
  | 'npcBlind20'
  | 'fold'
  | 'call'
  | 'raise'
  | 'raiseArea'
  | 'raiseInput'
  | 'addChips'
  | null;

type IntroAction = 'startGame';

type IntroLine = {
  from: 'npc' | 'player' | 'guide';
  text: string;
  /** Triggered AFTER this line finishes (i.e. when user advances past it). */
  after?: IntroAction;
  /** Highlight while this line is shown. Clears automatically on next step. */
  highlight?: Exclude<TutorialHighlightTarget, null>;
};

type StreetScript = {
  npcAction: PlayerAction;
  dialogueBefore: string[];
  dialogueAfter: string[];
  playerFoldDisabled?: boolean;
  playerAllInDisabled?: boolean;
};

type DialogueSource = 'npc' | 'player' | 'system';
type DialogueEntry = { text: string; source: DialogueSource };

const LOCALE_TEXT: Record<Language, {
  title: string;
  hint: string;
  introClickHint: string;
  introFooter: string;
  introDialogue: IntroLine[];
  npcLines: string[];
  actionLines: Record<PlayerAction['type'], string>;
  npcWin: string;
  heroWin: string;
  tie: string;
}> = {
  zh: {
    title: '教程房间',
    hint: '点击眼睛与 NPC 互动',
    introClickHint: '点击黑色空白处继续对话',
    introFooter: '对话结束后将自动下大小盲并开始本手。',
    introDialogue: [
      { from: 'npc', text: '新面孔？第一次来这里？放轻松。' },
      { from: 'npc', text: '这张桌子由我来定规矩——筹码怎么走，结果怎么落。' },
      { from: 'guide', text: '从最基础开始。', after: 'startGame' },
      { from: 'npc', text: '这手你是小盲位。小盲必须先下强制注：10。' },
      { from: 'guide', text: '你先放入 10。', highlight: 'heroBlind10' },
      { from: 'npc', text: '然后到我。坐在你旁边，我是大盲位。' },
      { from: 'npc', text: '大盲同样是强制注，而且是你的两倍：20。' },
      { from: 'guide', text: '我放入 20。', highlight: 'npcBlind20' },
      { from: 'npc', text: '现在行动回到你：Fold、Call、Raise。' },
      { from: 'npc', text: 'Fold：弃掉这手，底池里的 10 也会留在桌上。', highlight: 'fold' },
      { from: 'npc', text: 'Call：补齐到 20，继续打。', highlight: 'call' },
      { from: 'npc', text: 'Raise：把注码再抬高，逼我回应。', highlight: 'raiseArea' },
    ],
    npcLines: [
      '现在你怎么选？',
      '试着自己打一整手：翻牌、转牌、河牌、摊牌。',
    ],
    actionLines: {
      fold: '你选择了 Fold。',
      check: '你选择了 Check。',
      call: '你选择了 Call。',
      raise: '你选择了 Raise。',
      all_in: '你选择了 All-in。',
    },
    npcWin: 'NPC 赢下这一手。',
    heroWin: '你赢下这一手。',
    tie: '平分底池。',
  },
  en: {
    title: 'Tutorial Room',
    hint: 'Click the eyes to interact with NPC',
    introClickHint: 'Click empty black space to advance the dialogue',
    introFooter: 'When the dialogue ends, the small/big blind will post and the hand begins.',
    introDialogue: [
      { from: 'npc', text: 'A new face? First time here? Relax.' },
      { from: 'npc', text: 'I run this table - the rules, the chips, and how the hand ends.' },
      { from: 'guide', text: 'Let us start from the beginning.', after: 'startGame' },
      { from: 'npc', text: 'This hand, you are the Small Blind. Small Blind posts a forced 10.' },
      { from: 'guide', text: 'You put in 10 first.', highlight: 'heroBlind10' },
      { from: 'npc', text: 'Now me. I am the Big Blind, right next to you.' },
      { from: 'npc', text: 'Big Blind is forced too, and it is double yours: 20.' },
      { from: 'guide', text: 'I put in 20.', highlight: 'npcBlind20' },
      { from: 'npc', text: 'Action is back to you: Fold, Call, or Raise.' },
      { from: 'npc', text: 'Fold: leave this hand and your 10 stays in the pot.', highlight: 'fold' },
      { from: 'npc', text: 'Call: match 20 and continue.', highlight: 'call' },
      { from: 'npc', text: 'Raise: increase the stakes and force me to respond.', highlight: 'raiseArea' },
    ],
    npcLines: [
      "Now what's your choice?",
      'Play a full hand yourself: flop, turn, river, showdown.',
    ],
    actionLines: {
      fold: 'You chose Fold.',
      check: 'You chose Check.',
      call: 'You chose Call.',
      raise: 'You chose Raise.',
      all_in: 'You chose All-in.',
    },
    npcWin: 'NPC wins this hand.',
    heroWin: 'You win this hand.',
    tie: 'Pot is split.',
  },
};

type TutorialState = {
  streetIndex: number;
  players: [Player, Player];
  currentPlayerId: string;
  currentBetAmount: number;
  minRaise: number;
  pot: number;
  finished: boolean;
};

/** Pre-dialogue: no blinds posted, no pot, stacks full. */
function createPreBlindsTutorialState(): TutorialState {
  const hero: Player = {
    id: HERO_ID,
    name: 'Player',
    isBot: false,
    seatIndex: 0,
    chipStack: 500,
    holeCards: HERO_CARDS,
    status: 'active',
    currentBet: 0,
    totalBetThisHand: 0,
    isConnected: true,
    isReady: true,
    startingChipStack: 500,
  };
  const npc: Player = {
    id: NPC_ID,
    name: 'NPC',
    isBot: true,
    seatIndex: 1,
    chipStack: 500,
    holeCards: NPC_CARDS,
    status: 'active',
    currentBet: 0,
    totalBetThisHand: 0,
    isConnected: true,
    isReady: true,
    startingChipStack: 500,
  };
  return {
    streetIndex: 0,
    players: [hero, npc],
    currentPlayerId: HERO_ID,
    currentBetAmount: 0,
    minRaise: BB,
    pot: 0,
    finished: false,
  };
}

/** After intro: SB/BB posted, same as real heads-up preflop. */
function createPostedBlindsState(): TutorialState {
  const hero: Player = {
    id: HERO_ID,
    name: 'Player',
    isBot: false,
    seatIndex: 0,
    chipStack: 490,
    holeCards: HERO_CARDS,
    status: 'active',
    currentBet: SB,
    totalBetThisHand: SB,
    isConnected: true,
    isReady: true,
    startingChipStack: 500,
  };
  const npc: Player = {
    id: NPC_ID,
    name: 'NPC',
    isBot: true,
    seatIndex: 1,
    chipStack: 480,
    holeCards: NPC_CARDS,
    status: 'active',
    currentBet: BB,
    totalBetThisHand: BB,
    isConnected: true,
    isReady: true,
    startingChipStack: 500,
  };
  return {
    streetIndex: 0,
    players: [hero, npc],
    currentPlayerId: HERO_ID, // heads-up preflop SB acts first
    currentBetAmount: BB,
    minRaise: BB,
    pot: SB + BB,
    finished: false,
  };
}

function getStreetBoardCount(streetIndex: number): number {
  if (streetIndex <= 0) return 0;
  if (streetIndex === 1) return 3;
  if (streetIndex === 2) return 4;
  return 5;
}

function nextPlayerId(currentPlayerId: string): string {
  return currentPlayerId === HERO_ID ? NPC_ID : HERO_ID;
}

function computePot(players: Player[]): number {
  return players.reduce((sum, p) => sum + p.totalBetThisHand, 0);
}

/** Chips already moved to the table center = total pot minus current-street bets still in front of seats. */
function committedPotOnTable(players: Player[], pot: number): number {
  const inFront = players.reduce((s, p) => s + p.currentBet, 0);
  return Math.max(0, pot - inFront);
}

function withPlayers(
  state: TutorialState,
  updater: (players: [Player, Player]) => [Player, Player]
): TutorialState {
  const players = updater(state.players);
  return { ...state, players, pot: computePot(players) };
}

function settleWinner(state: TutorialState): TutorialState {
  const alive = state.players.filter((p) => p.status !== 'folded');
  if (alive.length === 1) {
    const winnerId = alive[0].id;
    return withPlayers({ ...state, finished: true, currentPlayerId: HERO_ID }, ([h, n]) => {
      if (winnerId === HERO_ID) return [{ ...h, chipStack: h.chipStack + state.pot }, n];
      return [h, { ...n, chipStack: n.chipStack + state.pot }];
    });
  }

  const board = SCRIPTED_BOARD;
  const heroRank = evaluateHand(HERO_CARDS, board);
  const npcRank = evaluateHand(NPC_CARDS, board);
  if (heroRank.value > npcRank.value) {
    return withPlayers({ ...state, finished: true, currentPlayerId: HERO_ID }, ([h, n]) => [
      { ...h, chipStack: h.chipStack + state.pot },
      n,
    ]);
  }
  if (npcRank.value > heroRank.value) {
    return withPlayers({ ...state, finished: true, currentPlayerId: HERO_ID }, ([h, n]) => [
      h,
      { ...n, chipStack: n.chipStack + state.pot },
    ]);
  }
  const split = Math.floor(state.pot / 2);
  const rem = state.pot - split * 2;
  return withPlayers({ ...state, finished: true, currentPlayerId: HERO_ID }, ([h, n]) => [
    { ...h, chipStack: h.chipStack + split + rem },
    { ...n, chipStack: n.chipStack + split },
  ]);
}

function isRoundComplete(players: Player[], currentBetAmount: number): boolean {
  const active = players.filter((p) => p.status !== 'folded');
  if (active.length <= 1) return true;
  const allMatched = active.every(
    (p) => p.status === 'all_in' || p.currentBet === currentBetAmount
  );
  const noActive = active.every((p) => p.status !== 'active');
  return allMatched && noActive;
}

function advanceStreet(state: TutorialState): TutorialState {
  const nextStreetIndex = Math.min(state.streetIndex + 1, STREETS.length - 1);
  if (nextStreetIndex >= 4) {
    return settleWinner({ ...state, streetIndex: 4 });
  }
  const resetPlayers = state.players.map((p) => ({
    ...p,
    currentBet: 0,
    status: (p.status === 'folded' || p.status === 'all_in' ? p.status : 'active') as PlayerStatus,
  })) as [Player, Player];
  return {
    ...state,
    streetIndex: nextStreetIndex,
    players: resetPlayers,
    currentBetAmount: 0,
    minRaise: BB,
    currentPlayerId: NPC_ID, // heads-up postflop BB acts first
    pot: computePot(resetPlayers),
  };
}

function applyTutorialAction(
  state: TutorialState,
  playerId: string,
  action: PlayerAction
): TutorialState {
  if (state.finished || state.currentPlayerId !== playerId) return state;
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return state;
  const player = state.players[idx];
  const valid = computeValidActions(player, state.currentBetAmount, state.minRaise, state.pot);
  const toCall = Math.max(0, state.currentBetAmount - player.currentBet);
  let next = { ...state };
  let players = [...state.players] as [Player, Player];

  if (action.type === 'check' && !valid.canCheck) return state;
  if (action.type === 'call' && !valid.canCall) return state;
  if (action.type === 'raise' && !valid.canRaise) return state;
  if (action.type === 'all_in' && !valid.canAllIn) return state;

  if (action.type === 'fold') {
    players[idx] = { ...player, status: 'folded' };
  } else if (action.type === 'check') {
    players[idx] = { ...player, status: 'acted' };
  } else if (action.type === 'call') {
    const callAmt = Math.min(toCall, player.chipStack);
    const isAllIn = callAmt === player.chipStack;
    players[idx] = {
      ...player,
      chipStack: player.chipStack - callAmt,
      currentBet: player.currentBet + callAmt,
      totalBetThisHand: player.totalBetThisHand + callAmt,
      status: isAllIn ? 'all_in' : 'acted',
    };
  } else if (action.type === 'raise') {
    const target = Math.max(valid.minRaise, Math.min(valid.maxRaise, action.amount ?? valid.minRaise));
    const add = Math.min(target - player.currentBet, player.chipStack);
    const isAllIn = add === player.chipStack;
    players[idx] = {
      ...player,
      chipStack: player.chipStack - add,
      currentBet: player.currentBet + add,
      totalBetThisHand: player.totalBetThisHand + add,
      status: isAllIn ? 'all_in' : 'acted',
    };
    const raiseSize = players[idx].currentBet - state.currentBetAmount;
    next.currentBetAmount = Math.max(state.currentBetAmount, players[idx].currentBet);
    next.minRaise = Math.max(BB, raiseSize);
    players = players.map((p, pIdx) =>
      pIdx !== idx && p.status === 'acted' ? { ...p, status: 'active' } : p
    ) as [Player, Player];
  } else if (action.type === 'all_in') {
    const add = player.chipStack;
    players[idx] = {
      ...player,
      chipStack: 0,
      currentBet: player.currentBet + add,
      totalBetThisHand: player.totalBetThisHand + add,
      status: 'all_in',
    };
    if (players[idx].currentBet > state.currentBetAmount) {
      const raiseSize = players[idx].currentBet - state.currentBetAmount;
      next.currentBetAmount = players[idx].currentBet;
      next.minRaise = Math.max(BB, raiseSize);
      players = players.map((p, pIdx) =>
        pIdx !== idx && p.status === 'acted' ? { ...p, status: 'active' } : p
      ) as [Player, Player];
    }
  }

  next.players = players;
  next.pot = computePot(players);

  const alive = players.filter((p) => p.status !== 'folded');
  if (alive.length <= 1) {
    return settleWinner(next);
  }
  if (isRoundComplete(players, next.currentBetAmount)) {
    return advanceStreet(next);
  }
  return { ...next, currentPlayerId: nextPlayerId(playerId) };
}

function pickNpcAction(state: TutorialState): PlayerAction {
  const npc = state.players.find((p) => p.id === NPC_ID);
  if (!npc) return { type: 'fold' };
  const valid = computeValidActions(npc, state.currentBetAmount, state.minRaise, state.pot);
  if (valid.canCheck) return { type: 'check' };
  if (valid.canCall) return { type: 'call' };
  return { type: 'fold' };
}

function formatIntroLine(language: Language, line: IntroLine): string {
  void language;
  return line.text;
}

function getStreetScripts(language: Language): Record<number, StreetScript> {
  const zh = language === 'zh';
  return {
    0: {
      npcAction: { type: 'call' },
      dialogueBefore: [zh ? '现在到你行动。' : "Now it's your turn."],
      dialogueAfter: [zh ? '我跟注。' : "I'll call.", zh ? '我们持平了。' : 'We are even.'],
      playerFoldDisabled: true,
    },
    1: {
      npcAction: { type: 'check' },
      dialogueBefore: [
        zh ? '你的目标是用两张手牌和公共牌组成最强五张牌。' : 'Your goal is to make the best 5-card hand using your two cards and the board.',
        zh ? '如果你不确定牌型，随时看右上 Rule。 [LOOK_RIGHT]' : "If you don't know the hand rankings, check the Rule button anytime. [LOOK_RIGHT]",
        zh ? '现在轮到我，我过牌。过牌就是不加注把行动让回去。' : "Now it's my turn. I'll check. Check means passing action without adding chips.",
        zh ? '如果你也过牌就进下一轮；如果你加注，我会跟注。' : "If you also check, we move on. If you raise, I'll call.",
      ],
      dialogueAfter: [],
      playerAllInDisabled: true,
    },
    2: {
      npcAction: { type: 'raise', amount: 40 },
      dialogueBefore: [zh ? '我加注 20。' : "I'll raise 20."],
      dialogueAfter: [],
      playerAllInDisabled: true,
    },
    3: {
      npcAction: { type: 'all_in' },
      dialogueBefore: [
        zh ? '这是最后一轮。五张公共牌都已发完，这轮结束就摊牌。' : 'This is the last round. All five board cards are out. After this round, we show cards.',
        zh ? '我的牌很强，我全下。' : 'My hand is strong. All in.',
        zh ? '全下就是把所有筹码一次推入。只有非常确定时才这么做。' : 'All-in means betting every chip you have. Use it only when you are very confident.',
        zh ? '如果你害怕，现在就可以弃牌。' : 'If you are scared, you better fold now.',
      ],
      dialogueAfter: [],
    },
  };
}

function formatNpcTutorialAction(language: Language, state: TutorialState, action: PlayerAction): string {
  const npc = state.players.find((p) => p.id === NPC_ID)!;
  const toCall = Math.max(0, state.currentBetAmount - npc.currentBet);
  const zh = language === 'zh';
  if (action.type === 'check') return zh ? '我过牌。' : "I'll check.";
  if (action.type === 'fold') return zh ? '我弃牌。' : "I'll fold.";
  if (action.type === 'call') {
    const amt = Math.min(toCall, npc.chipStack);
    return zh ? `我跟注 ${amt}。` : `I'll call ${amt}.`;
  }
  if (action.type === 'raise') {
    const target = action.amount ?? state.currentBetAmount + state.minRaise;
    return zh ? `我加注到 ${target}。` : `I'll raise to ${target}.`;
  }
  if (action.type === 'all_in') {
    const add = npc.chipStack;
    return zh ? `我全下（${add}）。` : `I'm all-in (${add}).`;
  }
  return zh ? '我行动了。' : 'My move.';
}

export function TutorialModal({ onClose }: Props) {
  const language = useAuthStore((s) => s.language);
  const tGame = useLang().game;
  const text = LOCALE_TEXT[language];
  const [frame, setFrame] = useState<(typeof NPC_FRAMES)[number]>('/image/default.png');
  const [lineIndex, setLineIndex] = useState(0);
  const [introStep, setIntroStep] = useState(0);
  const [dialogueQueue, setDialogueQueue] = useState<DialogueEntry[]>([]);
  const [highlightRule, setHighlightRule] = useState(false);
  const [lastHeroAction, setLastHeroAction] = useState<PlayerAction['type'] | null>(null);
  const [npcPendingAction, setNpcPendingAction] = useState<PlayerAction | null>(null);
  const [npcPendingAfterLines, setNpcPendingAfterLines] = useState<string[]>([]);
  const [state, setState] = useState<TutorialState>(createPreBlindsTutorialState);
  const lookRightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ruleHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockFrameRef = useRef(false);
  const introJustFinishedRef = useRef(false);

  const introLen = text.introDialogue.length;
  const introComplete = introStep >= introLen;
  const canAct = introComplete && state.currentPlayerId === HERO_ID && !state.finished;
  const introLine = text.introDialogue[Math.min(introStep, introLen - 1)];
  const tutorialHighlight: TutorialHighlightTarget = introComplete ? null : (introLine?.highlight ?? null);
  const currentLine = dialogueQueue[0]?.text ?? null;
  const streetScripts = useMemo(() => getStreetScripts(language), [language]);
  const currentScript = streetScripts[state.streetIndex];

  const pushDialogue = (source: DialogueSource, ...lines: string[]) => {
    if (!lines.length) return;
    const entries = lines.filter(Boolean).map((text) => ({ text, source }));
    if (!entries.length) return;
    setDialogueQueue((prev) => [...prev, ...entries]);
  };

  const playLookRightAnimation = () => {
    if (lookRightTimerRef.current) clearTimeout(lookRightTimerRef.current);
    lockFrameRef.current = true;
    setFrame('/image/look-right.png');
    lookRightTimerRef.current = setTimeout(() => {
      lockFrameRef.current = false;
      setFrame('/image/default.png');
    }, 1500);
  };

  const advanceDialogue = () => {
    setDialogueQueue((prev) => prev.slice(1));
  };

  const advanceIntro = () => {
    setIntroStep((prev) => {
      if (prev >= introLen) return prev;
      const current = text.introDialogue[prev];
      if (current?.after === 'startGame') {
        introJustFinishedRef.current = true;
        setState(createPostedBlindsState());
        setDialogueQueue([]);
        setLastHeroAction(null);
        setNpcPendingAction(null);
      }
      return prev + 1;
    });
  };

  const currentStreet: Street = STREETS[state.streetIndex];
  const boardRevealCount = getStreetBoardCount(state.streetIndex);
  const communityCards = SCRIPTED_BOARD.slice(0, boardRevealCount);
  const showNpcCards = currentStreet === 'showdown' || state.finished;
  const hero = state.players.find((p) => p.id === HERO_ID)!;
  const npc = state.players.find((p) => p.id === NPC_ID)!;
  const tableCenterPot = committedPotOnTable(state.players, state.pot);
  const disabledActions: Partial<Record<PlayerAction['type'], string>> = {};
  if (currentScript?.playerFoldDisabled) {
    disabledActions.fold = language === 'zh'
      ? '你在这不会输，不需要 fold'
      : "You can't lose anything here, no need to fold.";
  }
  if (currentScript?.playerAllInDisabled) {
    disabledActions.all_in = language === 'zh'
      ? '现在还不能 all-in'
      : 'All-in is not available at this stage.';
  }

  const tutorialGameState: GameState = useMemo(() => ({
    tableId: 'tutorial-room',
    config: {
      maxPlayers: 9,
      smallBlind: SB,
      bigBlind: BB,
      turnTimeoutMs: 30_000,
      minBuyIn: 500,
      maxBuyIn: 5000,
      chipDenominations: DENOMS,
      maxHands: 0,
    },
    phase: currentStreet,
    players: state.players,
    communityCards,
    pot: state.pot,
    sidePots: [],
    currentPlayerSeatIndex: state.currentPlayerId === HERO_ID ? 0 : 1,
    dealerSeatIndex: 0,
    smallBlindSeatIndex: 0,
    bigBlindSeatIndex: 1,
    currentBetAmount: state.currentBetAmount,
    minRaise: state.minRaise,
    handNumber: 1,
    actionHistory: [],
    sessionStarted: true,
    sessionHandCount: 1,
    hostPlayerId: HERO_ID,
    handHistory: [],
  }), [communityCards, currentStreet, state]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const playBlink = () => {
      const steps: Array<{ frame: (typeof NPC_FRAMES)[number]; duration: number }> = [
        { frame: '/image/mid-blink.png', duration: 90 },
        { frame: '/image/fully-blink.png', duration: 90 },
        { frame: '/image/mid-blink.png', duration: 90 },
        { frame: '/image/default.png', duration: 0 },
      ];
      let idx = 0;
      const nextStep = () => {
        if (cancelled) return;
        const step = steps[idx];
        if (!lockFrameRef.current) setFrame(step.frame);
        idx += 1;
        if (idx < steps.length) timer = setTimeout(nextStep, step.duration);
        else timer = setTimeout(playBlink, 2000 + Math.floor(Math.random() * 1200));
      };
      nextStep();
    };
    timer = setTimeout(playBlink, 1200);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (lookRightTimerRef.current) clearTimeout(lookRightTimerRef.current);
      if (ruleHighlightTimerRef.current) clearTimeout(ruleHighlightTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!introComplete || state.finished || state.currentPlayerId !== NPC_ID) return;
    if (introJustFinishedRef.current) {
      introJustFinishedRef.current = false;
      return;
    }
    if (npcPendingAction) return;
    const script = streetScripts[state.streetIndex];
    const validNpc = computeValidActions(npc, state.currentBetAmount, state.minRaise, state.pot);
    let npcAction: PlayerAction = script?.npcAction ?? pickNpcAction(state);

    if (state.streetIndex === 0) {
      npcAction = validNpc.canCall ? { type: 'call' } : { type: 'check' };
    } else if (state.streetIndex === 1) {
      npcAction = lastHeroAction === 'raise' && validNpc.canCall ? { type: 'call' } : { type: 'check' };
    } else if (npcAction.type === 'raise') {
      if (validNpc.canRaise) {
        const target = Math.max(validNpc.minRaise, Math.min(validNpc.maxRaise, npcAction.amount ?? validNpc.minRaise));
        npcAction = { type: 'raise', amount: target };
      } else if (validNpc.canCall) {
        npcAction = { type: 'call' };
      } else {
        npcAction = { type: 'check' };
      }
    } else if (npcAction.type === 'all_in' && !validNpc.canAllIn) {
      npcAction = validNpc.canCall ? { type: 'call' } : { type: 'check' };
    } else if (npcAction.type === 'call' && !validNpc.canCall) {
      npcAction = validNpc.canCheck ? { type: 'check' } : { type: 'fold' };
    }

    if (script?.dialogueBefore?.length) pushDialogue('npc', ...script.dialogueBefore);
    else pushDialogue('npc', formatNpcTutorialAction(language, state, npcAction));
    setNpcPendingAfterLines(script?.dialogueAfter ?? []);
    setNpcPendingAction(npcAction);
  }, [introComplete, language, lastHeroAction, npcPendingAction, state.currentBetAmount, state.currentPlayerId, state.finished, state.minRaise, state.pot, state.streetIndex, streetScripts, npc.currentBet, npc.chipStack, npc.status]);

  useEffect(() => {
    if (!npcPendingAction) return;
    const t = setTimeout(() => {
      setState((prev) => applyTutorialAction(prev, NPC_ID, npcPendingAction));
      if (npcPendingAfterLines.length) pushDialogue('npc', ...npcPendingAfterLines);
      setNpcPendingAction(null);
      setNpcPendingAfterLines([]);
      setLastHeroAction(null);
    }, 900);
    return () => clearTimeout(t);
  }, [npcPendingAction, npcPendingAfterLines]);

  useEffect(() => {
    if (!state.finished) return;
    if (hero.status === 'folded') {
      pushDialogue('system', text.npcWin);
      return;
    }
    if (npc.status === 'folded') {
      pushDialogue('system', text.heroWin);
      return;
    }
    const heroRank = evaluateHand(HERO_CARDS, SCRIPTED_BOARD);
    const npcRank = evaluateHand(NPC_CARDS, SCRIPTED_BOARD);
    if (heroRank.value > npcRank.value) pushDialogue('system', text.heroWin);
    else if (npcRank.value > heroRank.value) pushDialogue('system', text.npcWin);
    else pushDialogue('system', text.tie);
  }, [hero.status, npc.status, state.finished, text.heroWin, text.npcWin, text.tie]);

  useEffect(() => {
    if (!currentLine?.includes('[LOOK_RIGHT]')) return;
    playLookRightAnimation();
    setHighlightRule(true);
    if (ruleHighlightTimerRef.current) clearTimeout(ruleHighlightTimerRef.current);
    ruleHighlightTimerRef.current = setTimeout(() => setHighlightRule(false), 2000);
  }, [currentLine]);

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

        {/* Same strip style as main game table header; content is Rule only */}
        <div
          className="flex items-center justify-end px-4 py-1.5 shrink-0"
          style={{
            background: 'linear-gradient(180deg, #0c1528 0%, #080f1e 100%)',
            borderBottom: '1px solid rgba(100,116,139,0.2)',
          }}
        >
          <div className="relative shrink-0 group mr-[17%]">
            <button
              type="button"
              className="text-sm px-3 py-1 text-slate-300 rounded-md transition-colors hover:text-white"
              style={headerBtnStyle}
              data-no-intro-advance
              data-highlighted={highlightRule ? 'true' : 'false'}
            >
              {tGame.ruleBtn}
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

        <div
          className="flex-1 relative overflow-hidden"
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest('[data-no-intro-advance]')) return;
            e.stopPropagation();
            if (!introComplete) advanceIntro();
            else if (dialogueQueue.length > 0) advanceDialogue();
          }}
        >
          <div className="absolute inset-0" style={{ background: '#000000' }} />
          <style>{`
            [data-highlighted="true"]{
              outline: 3px solid rgba(245, 200, 66, 0.95);
              outline-offset: 3px;
              box-shadow: 0 0 0 6px rgba(245, 200, 66, 0.18), 0 10px 28px rgba(0,0,0,0.55);
              animation: tutorialPulse 1.1s ease-in-out infinite;
              border-radius: 12px;
            }
            @keyframes tutorialPulse {
              0%, 100% { transform: translateZ(0) scale(1); }
              50% { transform: translateZ(0) scale(1.02); }
            }
          `}</style>

          <div className="absolute top-[0%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
            <button
              type="button"
              data-no-intro-advance
              onClick={() => {
                if (!introComplete) return;
                if (dialogueQueue.length > 0) {
                  advanceDialogue();
                } else {
                  setLineIndex((prev) => (prev + 1) % text.npcLines.length);
                }
              }}
              className="p-0 bg-transparent border-0 shadow-none transition-transform hover:scale-105 active:scale-95"
            >
              <img src={frame} alt="NPC Eyes" className="w-56 max-w-[65vw] select-none" draggable={false} />
            </button>
            <div className="absolute left-[calc(100%+18px)] top-[52px] flex gap-2">
              {showNpcCards ? (
                <>
                  <PlayingCard card={NPC_CARDS[0]} />
                  <PlayingCard card={NPC_CARDS[1]} />
                </>
              ) : (
                <>
                  <PlayingCard card={NPC_CARDS[0]} faceDown />
                  <PlayingCard card={NPC_CARDS[1]} faceDown />
                </>
              )}
            </div>
            <div className="absolute left-[calc(100%+34px)] top-[142px] text-emerald-300 text-sm font-mono font-semibold">
              ◆ {npc.chipStack}
            </div>
            {npc.currentBet > 0 && (
              <div
                className="absolute left-[calc(100%+36px)] top-[182px]"
                data-highlight-target="npcBlind20"
                data-highlighted={tutorialHighlight === 'npcBlind20' ? 'true' : 'false'}
              >
                <BetDisplay amount={npc.currentBet} denominations={DENOMS} />
              </div>
            )}
            <div
              className="text-lg leading-snug text-slate-200 rounded-xl px-5 py-3 max-w-[72vw] text-center"
              style={{
                background: 'rgba(9,19,34,0.9)',
                border: '1px solid rgba(148,163,184,0.35)',
                transform: 'translate(-25vw, calc(-25vh + 8vh))',
              }}
            >
              {introComplete
                ? ((currentLine ?? text.npcLines[lineIndex]).replace(/\s*\[LOOK_RIGHT\]\s*/g, ''))
                : formatIntroLine(language, text.introDialogue[introStep]!)}
            </div>
          </div>

          <div className="absolute left-1/2 bottom-[calc(22%+12%)] -translate-x-1/2 w-[39vw] max-w-[490px] min-w-[260px]">
            <img
              src="/image/table.png"
              alt="Tutorial table"
              className="w-full h-auto select-none pointer-events-none"
              draggable={false}
              style={{ filter: 'drop-shadow(0 22px 60px rgba(0,0,0,0.75))' }}
            />
            <div className="absolute left-[-30%] top-[70%] -translate-y-1/2 flex gap-2">
              <PlayingCard card={HERO_CARDS[0]} />
              <PlayingCard card={HERO_CARDS[1]} />
            </div>
            <div className="absolute left-[-26%] top-[82%] -translate-y-1/2 text-emerald-300 text-sm font-mono font-semibold">
              ◆ {hero.chipStack}
            </div>
            {hero.currentBet > 0 && (
              <div
                className="absolute left-[-22%] top-[90%] -translate-y-1/2"
                data-highlight-target="heroBlind10"
                data-highlighted={tutorialHighlight === 'heroBlind10' ? 'true' : 'false'}
              >
                <BetDisplay amount={hero.currentBet} denominations={DENOMS} />
              </div>
            )}
            <div className="absolute left-1/2 top-[45%] -translate-x-1/2 flex gap-2">
              {Array.from({ length: 5 }).map((_, idx) => {
                const card = communityCards[idx];
                return card ? (
                  <PlayingCard key={idx} card={card} />
                ) : (
                  <div
                    key={idx}
                    className="w-12 h-[70px] rounded-lg"
                    style={{
                      background: 'rgba(0,0,0,0.32)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: 'inset 0 0 14px rgba(0,0,0,0.38)',
                    }}
                  />
                );
              })}
            </div>
            <div className="absolute left-1/2 top-[34%] -translate-x-1/2">
              <BetDisplay amount={tableCenterPot} denominations={DENOMS} />
            </div>
          </div>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-slate-500 tracking-wide">
            {introComplete ? text.hint : text.introClickHint}
          </div>

          <div
            className="absolute left-1/2 bottom-0 -translate-x-1/2 w-full max-w-[980px] px-4 pb-4"
            data-no-intro-advance
          >
            <div style={{ opacity: canAct ? 1 : 0.65, pointerEvents: canAct ? 'auto' : 'none' }}>
              <ActionPanel
                player={hero}
                gameState={tutorialGameState}
                disabledActions={disabledActions}
                highlight={
                  (tutorialHighlight === 'fold'
                    || tutorialHighlight === 'call'
                    || tutorialHighlight === 'raise'
                    || tutorialHighlight === 'raiseArea'
                    || tutorialHighlight === 'raiseInput'
                    || tutorialHighlight === 'addChips')
                    ? tutorialHighlight
                    : undefined
                }
                onSendAction={(type, amount) => {
                  if (!canAct) return;
                  setLastHeroAction(type);
                  const lines: string[] = [];
                  if (type === 'call') {
                    lines.push(language === 'zh' ? '很好，我们持平了，进入下一轮。' : 'Now we are even, we will proceed to the next step.');
                  } else if (type === 'raise') {
                    lines.push(language === 'zh' ? '好，我会跟。' : "I'll call.");
                    lines.push(language === 'zh' ? '我们持平了。' : 'We are even.');
                  } else if (type === 'check') {
                    lines.push(language === 'zh' ? '我们都过牌，看看下一张牌。' : "We are even, let's see the next card.");
                  } else if (type === 'fold') {
                    lines.push(text.npcWin);
                  }
                  pushDialogue('player', ...lines);
                  setState((prev) => applyTutorialAction(prev, HERO_ID, { type, amount }));
                }}
              />
            </div>
            {!canAct && (
              <div className="rounded-xl p-3 text-center text-slate-400"
                style={{ background: 'rgba(12,21,40,0.75)', border: '1px solid rgba(100,116,139,0.25)' }}>
                {!introComplete
                  ? text.introFooter
                  : (state.finished ? (language === 'zh' ? '本手已结束' : 'Hand complete') : (language === 'zh' ? 'NPC 回合中...' : 'NPC turn...'))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
