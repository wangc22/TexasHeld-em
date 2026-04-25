/**
 * GameEngine — the single source of truth for game state mutation.
 *
 * Rules enforced here:
 * - Only the current player can act.
 * - Actions must be from the valid action set.
 * - All state mutations happen through applyAction().
 * - The engine emits events via a callback instead of doing I/O itself.
 */
import type {
  GameState,
  Player,
  PlayerAction,
  ActionRecord,
  HandResult,
  SidePot,
  TableConfig,
  GamePhase,
  Card,
  HandSummary,
  SessionResult,
} from '@texas-poker/shared';
import {
  evaluateHand,
  findWinners,
} from '@texas-poker/shared';
import { Deck } from './Deck.js';
import { calculateSidePots } from './PotManager.js';
import {
  isBettingRoundComplete,
  computeValidActions,
  getPlayersInOrder,
} from './BettingRound.js';
import { v4 as uuidv4 } from 'uuid';

export type GameEvent =
  | { type: 'state_updated'; state: GameState }
  | { type: 'turn_start'; playerId: string; seatIndex: number; deadlineMs: number }
  | { type: 'action_taken'; playerId: string; actionType: PlayerAction['type']; amount?: number }
  | { type: 'hand_complete'; result: HandResult; state: GameState }
  | { type: 'session_complete'; result: SessionResult; state: GameState }
  | { type: 'error'; code: string; message: string; playerId?: string };

export type EventHandler = (event: GameEvent) => void;

/** Errors returned as result, not thrown, to keep the engine pure */
export interface ActionResult {
  ok: boolean;
  error?: string;
}

export class GameEngine {
  private state: GameState;
  private deck: Deck = new Deck();
  private sequenceNumber = 0;
  private emit: EventHandler;

  constructor(tableId: string, config: TableConfig, emit: EventHandler) {
    this.emit = emit;
    this.state = {
      tableId,
      config,
      phase: 'waiting',
      players: [],
      communityCards: [],
      pot: 0,
      sidePots: [],
      currentPlayerSeatIndex: -1,
      dealerSeatIndex: -1,
      smallBlindSeatIndex: -1,
      bigBlindSeatIndex: -1,
      currentBetAmount: 0,
      minRaise: config.bigBlind,
      handNumber: 0,
      actionHistory: [],
      sessionStarted: false,
      sessionHandCount: 0,
      hostPlayerId: null,
      handHistory: [],
    };
  }

  // ─── Player management ──────────────────────────────────────────────────────

  addPlayer(id: string, name: string, chipStack: number, isBot = false): ActionResult {
    if (this.state.players.length >= this.state.config.maxPlayers) {
      return { ok: false, error: 'Table is full' };
    }
    if (this.state.players.find((p) => p.id === id)) {
      return { ok: false, error: 'Player already seated' };
    }
    if (this.state.phase !== 'waiting' && this.state.phase !== 'hand_complete') {
      return { ok: false, error: 'Hand in progress, cannot join mid-hand' };
    }
    if (this.state.sessionStarted) {
      return { ok: false, error: 'Session already in progress, cannot join' };
    }
    if (isBot && this.state.players.filter((p) => p.isBot).length >= 3) {
      return { ok: false, error: 'Max 3 AI bots allowed' };
    }

    const usedSeats = new Set(this.state.players.map((p) => p.seatIndex));
    let seatIndex = 0;
    while (usedSeats.has(seatIndex)) seatIndex++;

    const player: Player = {
      id,
      name,
      isBot,
      seatIndex,
      chipStack,
      holeCards: null,
      status: 'waiting',
      currentBet: 0,
      totalBetThisHand: 0,
      isConnected: true,
      isReady: isBot, // bots are always ready
      startingChipStack: chipStack,
    };

    this.state = { ...this.state, players: [...this.state.players, player] };
    this.emitStateUpdate();
    return { ok: true };
  }

  removePlayer(playerId: string): ActionResult {
    if (this.state.phase !== 'waiting' && this.state.phase !== 'hand_complete') {
      // Mark as sitting out instead of removing mid-hand
      this.state = {
        ...this.state,
        players: this.state.players.map((p) =>
          p.id === playerId ? { ...p, status: 'sitting_out', isConnected: false } : p
        ),
      };
      this.emitStateUpdate();
      return { ok: true };
    }
    const wasHandComplete = this.state.phase === 'hand_complete';
    this.state = {
      ...this.state,
      players: this.state.players.filter((p) => p.id !== playerId),
    };
    this.emitStateUpdate();
    // If a player leaves during hand_complete, re-check whether remaining players
    // have all confirmed so the game can proceed instead of getting stuck.
    if (wasHandComplete) {
      this.checkAllConfirmed();
    }
    return { ok: true };
  }

  setPlayerConnected(playerId: string, connected: boolean): void {
    this.state = {
      ...this.state,
      players: this.state.players.map((p) =>
        p.id === playerId
          ? { ...p, isConnected: connected, disconnectedAt: connected ? undefined : Date.now() }
          : p
      ),
    };
    this.emitStateUpdate();
  }

  /**
   * In-place convert a real player to a bot (when they disconnect mid-hand).
   * Preserves seat, chipStack, hand state.
   * Re-emits turn_start if it's this player's current turn, to trigger bot action.
   */
  convertToBot(playerId: string): ActionResult {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return { ok: false, error: 'Player not found' };
    this.state = {
      ...this.state,
      players: this.state.players.map((p) =>
        p.id === playerId
          ? { ...p, isBot: true, isConnected: true, name: `${p.name}(Bot)` }
          : p
      ),
    };
    this.emitStateUpdate();
    // If it's this player's turn, re-emit turn_start to trigger bot action
    const currentPlayer = this.state.players.find(
      (p) => p.seatIndex === this.state.currentPlayerSeatIndex
    );
    if (currentPlayer?.id === playerId && this.state.turnDeadlineMs) {
      this.emitTurnStart();
    }
    return { ok: true };
  }

  /** Update the host player ID in state (called by TableManager on host transfer). */
  setHost(hostPlayerId: string | null): void {
    this.state = { ...this.state, hostPlayerId };
    this.emitStateUpdate();
  }

  // ─── Session management ─────────────────────────────────────────────────────

  /**
   * Host starts the session: locks new players from joining, starts first hand.
   */
  startSession(hostPlayerId: string): ActionResult {
    if (this.state.sessionStarted) {
      return { ok: false, error: 'Session already started' };
    }
    const eligible = this.state.players.filter((p) => p.chipStack > 0);
    if (eligible.length < 2) {
      return { ok: false, error: 'Need at least 2 players with chips' };
    }

    // Snapshot starting chip stacks for net gain calculation
    this.state = {
      ...this.state,
      sessionStarted: true,
      sessionHandCount: 0,
      hostPlayerId,
      players: this.state.players.map((p) => ({
        ...p,
        startingChipStack: p.chipStack,
        isReady: p.isBot,
      })),
    };

    return this.startHand();
  }

  /**
   * Mark a player as ready between hands.
   * Auto-starts next hand when all human players are ready.
   */
  markPlayerReady(playerId: string): ActionResult {
    if (this.state.phase !== 'hand_complete') {
      return { ok: false, error: 'Not in hand_complete phase' };
    }
    if (!this.state.players.find((p) => p.id === playerId)) {
      return { ok: false, error: 'Player not found' };
    }

    this.state = {
      ...this.state,
      players: this.state.players.map((p) =>
        p.id === playerId ? { ...p, isReady: true } : p
      ),
    };
    this.emitStateUpdate();
    this.checkAllConfirmed();
    return { ok: true };
  }

  /**
   * Player explicitly confirms the hand result.
   * Same as markPlayerReady — both map to the same isReady flag.
   */
  confirmResult(playerId: string): ActionResult {
    return this.markPlayerReady(playerId);
  }

  /**
   * Auto-confirm all human players who haven't confirmed yet (timer expiry).
   */
  autoConfirmAll(): void {
    if (this.state.phase !== 'hand_complete') return;
    this.state = {
      ...this.state,
      players: this.state.players.map((p) =>
        !p.isBot ? { ...p, isReady: true } : p
      ),
      confirmDeadlineMs: null,
    };
    this.emitStateUpdate();
    this.checkAllConfirmed();
  }

  private checkAllConfirmed(): void {
    const humanPlayers = this.state.players.filter(
      (p) => !p.isBot && p.status !== 'sitting_out'
    );
    // All humans eliminated — end session immediately
    if (humanPlayers.every((p) => p.chipStack === 0)) {
      this.endSession();
      return;
    }
    // Only consider humans with chips for the "all confirmed" check
    const activePlayers = humanPlayers.filter((p) => p.chipStack > 0);
    if (activePlayers.length === 0) {
      this.endSession();
      return;
    }
    if (activePlayers.every((p) => p.isReady)) {
      if (this.state.sessionPendingComplete) {
        this.endSession();
      } else {
        const playersWithChips = this.state.players.filter(
          (p) => p.chipStack > 0 && p.status !== 'sitting_out'
        );
        if (playersWithChips.length < 2) {
          this.endSession();
        } else {
          this.startHand();
        }
      }
    }
  }

  private endSession(): void {
    const result = this.buildSessionResult(this.state.players, this.state.sessionHandCount);
    this.state = {
      ...this.state,
      sessionStarted: false,
      sessionPendingComplete: false,
      confirmDeadlineMs: null,
    };
    this.emitStateUpdate();
    this.emit({ type: 'session_complete', result, state: this.state });
  }

  /**
   * Pause the game (host only). Freezes the current turn timer.
   */
  pause(): void {
    if (this.state.isPaused) return;
    const remaining = this.state.turnDeadlineMs
      ? Math.max(0, this.state.turnDeadlineMs - Date.now())
      : null;
    this.state = { ...this.state, isPaused: true, pauseRemainingMs: remaining, turnDeadlineMs: undefined };
    this.emitStateUpdate();
  }

  /**
   * Resume the game (host only). Restores the frozen turn timer.
   */
  resume(): void {
    if (!this.state.isPaused) return;
    const newDeadline = this.state.pauseRemainingMs != null
      ? Date.now() + this.state.pauseRemainingMs
      : undefined;
    this.state = {
      ...this.state,
      isPaused: false,
      turnDeadlineMs: newDeadline,
      pauseRemainingMs: null,
    };
    this.emitStateUpdate();
    if (newDeadline) {
      this.emitTurnStart();
    }
  }

  /**
   * Force end the current hand immediately (e.g., all real players left).
   * Runs showdown with whatever cards are currently dealt.
   */
  endHandImmediately(): void {
    const activePhases: GamePhase[] = ['pre_flop', 'flop', 'turn', 'river', 'showdown'];
    if (!activePhases.includes(this.state.phase)) return;
    this.doShowdown(this.state.players);
  }

  // ─── Hand lifecycle ─────────────────────────────────────────────────────────

  startHand(): ActionResult {
    const eligible = this.state.players.filter(
      (p) => p.chipStack > 0 && p.status !== 'sitting_out'
    );
    if (eligible.length < 2) {
      return { ok: false, error: 'Need at least 2 players with chips' };
    }

    this.deck = new Deck();
    this.deck.shuffle();

    // Rotate dealer button
    const dealerIndex = this.nextDealerSeat();

    // Reset players for new hand (preserve isReady=false for humans, bots stay true)
    const players: Player[] = this.state.players.map((p) => ({
      ...p,
      holeCards: null,
      currentBet: 0,
      totalBetThisHand: 0,
      status: p.chipStack > 0 && p.status !== 'sitting_out' ? 'active' : 'sitting_out',
      isReady: p.isBot,
    }));

    // Determine blind positions.
    const activePlayers = this.getActiveSeatOrder(players, dealerIndex);
    const isHeadsUp = activePlayers.length === 2;
    const sbPlayer = isHeadsUp ? activePlayers[1] : activePlayers[0];
    const bbPlayer = isHeadsUp ? activePlayers[0] : activePlayers[1];

    // Post blinds
    const { smallBlind, bigBlind } = this.state.config;
    const updatedPlayers = players.map((p) => {
      if (p.id === sbPlayer.id) {
        const sbAmount = Math.min(smallBlind, p.chipStack);
        return { ...p, chipStack: p.chipStack - sbAmount, currentBet: sbAmount, totalBetThisHand: sbAmount };
      }
      if (p.id === bbPlayer.id) {
        const bbAmount = Math.min(bigBlind, p.chipStack);
        return {
          ...p,
          chipStack: p.chipStack - bbAmount,
          currentBet: bbAmount,
          totalBetThisHand: bbAmount,
          status: bbAmount < bbPlayer.chipStack + bbAmount ? 'active' : ('all_in' as Player['status']),
        };
      }
      return p;
    });

    // Deal hole cards
    const dealtPlayers = updatedPlayers.map((p) => {
      if (p.status === 'active' || p.status === 'all_in') {
        return { ...p, holeCards: [this.deck.deal(), this.deck.deal()] as [Card, Card] };
      }
      return p;
    }) as Player[];

    const pot = dealtPlayers.reduce((sum, p) => sum + p.currentBet, 0);

    // UTG acts first pre-flop
    const utgPlayer = isHeadsUp
      ? activePlayers[1]
      : (activePlayers[2] ?? activePlayers[0]);

    this.state = {
      ...this.state,
      phase: 'pre_flop',
      players: dealtPlayers,
      communityCards: [],
      pot,
      sidePots: [],
      dealerSeatIndex: dealerIndex,
      smallBlindSeatIndex: sbPlayer.seatIndex,
      bigBlindSeatIndex: bbPlayer.seatIndex,
      currentBetAmount: bigBlind,
      minRaise: bigBlind,
      handNumber: this.state.handNumber + 1,
      actionHistory: [],
      lastAction: undefined,
      lastHandResult: undefined,
      currentPlayerSeatIndex: utgPlayer.seatIndex,
      turnDeadlineMs: Date.now() + this.state.config.turnTimeoutMs,
    };

    this.emitStateUpdate();
    this.emitTurnStart();
    return { ok: true };
  }

  // ─── Action processing ──────────────────────────────────────────────────────

  applyAction(playerId: string, action: PlayerAction): ActionResult {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return { ok: false, error: 'Player not found' };

    const currentPlayer = this.state.players.find(
      (p) => p.seatIndex === this.state.currentPlayerSeatIndex
    );
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { ok: false, error: 'NOT_YOUR_TURN' };
    }
    if (player.status === 'folded' || player.status === 'sitting_out') {
      return { ok: false, error: 'INVALID_STATUS' };
    }

    const valid = computeValidActions(
      player,
      this.state.currentBetAmount,
      this.state.minRaise,
      this.state.pot
    );

    const validationError = this.validateAction(action, valid, player);
    if (validationError) {
      return { ok: false, error: validationError };
    }

    const updatedPlayer = this.applyPlayerAction(player, action);
    const committedThisAction = updatedPlayer.totalBetThisHand - player.totalBetThisHand;

    let players = this.state.players.map((p) =>
      p.id === playerId ? updatedPlayer : p
    );

    const pot = players.reduce((sum, p) => sum + p.totalBetThisHand, 0);

    let minRaise = this.state.minRaise;
    if (action.type === 'raise' && action.amount != null) {
      const raiseSize = action.amount - this.state.currentBetAmount;
      minRaise = raiseSize;
    }

    const newCurrentBetAmount =
      action.type === 'raise' || action.type === 'all_in'
        ? Math.max(this.state.currentBetAmount, updatedPlayer.currentBet)
        : this.state.currentBetAmount;

    if (action.type === 'raise' || (action.type === 'all_in' && updatedPlayer.currentBet > this.state.currentBetAmount)) {
      players = players.map((p) =>
        p.id !== playerId && p.status === 'acted' ? { ...p, status: 'active' } : p
      );
    }

    const record: ActionRecord = {
      ...action,
      playerId,
      phase: this.state.phase,
      timestamp: Date.now(),
      sequenceNumber: this.sequenceNumber++,
    };

    this.state = {
      ...this.state,
      players,
      pot,
      currentBetAmount: newCurrentBetAmount,
      minRaise,
      actionHistory: [...this.state.actionHistory, record],
      lastAction: record,
    };
    this.emit({
      type: 'action_taken',
      playerId,
      actionType: action.type,
      amount: committedThisAction > 0 ? committedThisAction : undefined,
    });

    const activePlayers = this.state.players.filter(
      (p) => p.status !== 'folded' && p.status !== 'sitting_out'
    );
    if (activePlayers.length === 1) {
      this.awardPotToLastPlayer(activePlayers[0]);
      return { ok: true };
    }

    if (isBettingRoundComplete(this.state.players, this.state.currentBetAmount)) {
      this.advancePhase();
    } else {
      this.advanceTurn();
    }

    return { ok: true };
  }

  autoFoldCurrentPlayer(): ActionResult {
    const player = this.state.players.find(
      (p) => p.seatIndex === this.state.currentPlayerSeatIndex
    );
    if (!player) return { ok: false, error: 'No current player' };
    return this.applyAction(player.id, { type: 'fold' });
  }

  // ─── State access ────────────────────────────────────────────────────────────

  getState(): GameState {
    return this.state;
  }

  getStateForPlayer(playerId: string): GameState {
    return {
      ...this.state,
      players: this.state.players.map((p) => {
        if (p.id === playerId) return p;
        // Reveal cards during showdown and hand_complete for non-folded players
        if (this.state.phase === 'showdown' && p.status !== 'folded') return p;
        if (this.state.phase === 'hand_complete' && p.holeCards !== null) return p;
        return { ...p, holeCards: null };
      }),
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private validateAction(
    action: PlayerAction,
    valid: ReturnType<typeof computeValidActions>,
    player: Player
  ): string | null {
    switch (action.type) {
      case 'fold': return null;
      case 'check': return valid.canCheck ? null : 'CANNOT_CHECK: there is a bet to call';
      case 'call': return valid.canCall || valid.canAllIn ? null : 'CANNOT_CALL';
      case 'raise': {
        if (!valid.canRaise) return 'CANNOT_RAISE: insufficient chips or invalid amount';
        if (action.amount == null) return 'RAISE_REQUIRES_AMOUNT';
        if (action.amount < valid.minRaise) return `RAISE_TOO_SMALL: min is ${valid.minRaise}`;
        if (action.amount > valid.maxRaise) return `RAISE_TOO_LARGE: max is ${valid.maxRaise}`;
        return null;
      }
      case 'all_in': return valid.canAllIn ? null : 'CANNOT_ALL_IN: no chips';
      default: return 'UNKNOWN_ACTION';
    }
  }

  private applyPlayerAction(player: Player, action: PlayerAction): Player {
    switch (action.type) {
      case 'fold': return { ...player, status: 'folded' };
      case 'check': return { ...player, status: 'acted' };
      case 'call': {
        const callAmount = Math.min(this.state.currentBetAmount - player.currentBet, player.chipStack);
        const isAllIn = callAmount === player.chipStack;
        return {
          ...player,
          chipStack: player.chipStack - callAmount,
          currentBet: player.currentBet + callAmount,
          totalBetThisHand: player.totalBetThisHand + callAmount,
          status: isAllIn ? 'all_in' : 'acted',
        };
      }
      case 'raise': {
        const targetBet = action.amount!;
        const additional = targetBet - player.currentBet;
        const isAllIn = additional >= player.chipStack;
        const actualAdditional = Math.min(additional, player.chipStack);
        return {
          ...player,
          chipStack: player.chipStack - actualAdditional,
          currentBet: player.currentBet + actualAdditional,
          totalBetThisHand: player.totalBetThisHand + actualAdditional,
          status: isAllIn ? 'all_in' : 'acted',
        };
      }
      case 'all_in': {
        return {
          ...player,
          currentBet: player.currentBet + player.chipStack,
          totalBetThisHand: player.totalBetThisHand + player.chipStack,
          chipStack: 0,
          status: 'all_in',
        };
      }
    }
  }

  private advanceTurn(): void {
    const inOrder = this.getActiveSeatOrder(this.state.players, this.state.currentPlayerSeatIndex - 1);
    const next = inOrder.find((p) => p.status === 'active');
    if (!next) {
      this.advancePhase();
      return;
    }
    this.state = {
      ...this.state,
      currentPlayerSeatIndex: next.seatIndex,
      turnDeadlineMs: Date.now() + this.state.config.turnTimeoutMs,
    };
    this.emitStateUpdate();
    this.emitTurnStart();
  }

  private advancePhase(): void {
    const players: Player[] = this.state.players.map((p) => ({
      ...p,
      currentBet: 0,
      status: p.status === 'acted' ? 'active' : p.status,
    }));

    const nextPhase = this.nextPhase();
    if (nextPhase === 'showdown') {
      this.doShowdown(players);
      return;
    }

    const communityCards = [...this.state.communityCards];
    if (nextPhase === 'flop') {
      communityCards.push(this.deck.deal(), this.deck.deal(), this.deck.deal());
    } else if (nextPhase === 'turn' || nextPhase === 'river') {
      communityCards.push(this.deck.deal());
    }

    const activePlayers = this.getActiveSeatOrder(players, this.state.dealerSeatIndex);
    const firstToAct = activePlayers.find((p) => p.status === 'active');

    if (!firstToAct) {
      this.runOutBoard(players, nextPhase);
      return;
    }

    this.state = {
      ...this.state,
      phase: nextPhase,
      players,
      communityCards,
      currentBetAmount: 0,
      minRaise: this.state.config.bigBlind,
      currentPlayerSeatIndex: firstToAct.seatIndex,
      turnDeadlineMs: Date.now() + this.state.config.turnTimeoutMs,
    };
    this.emitStateUpdate();
    this.emitTurnStart();
  }

  private runOutBoard(players: Player[], fromPhase: GamePhase): void {
    const communityCards = [...this.state.communityCards];
    const phases: GamePhase[] = [fromPhase, 'turn', 'river', 'showdown'];

    for (const p of phases) {
      if (p === 'flop') communityCards.push(this.deck.deal(), this.deck.deal(), this.deck.deal());
      else if (p === 'turn' || p === 'river') communityCards.push(this.deck.deal());
      else if (p === 'showdown') break;
      if (communityCards.length >= 5) break;
    }

    this.state = { ...this.state, phase: 'showdown', players, communityCards };
    this.doShowdown(players);
  }

  private doShowdown(players: Player[]): void {
    this.state = { ...this.state, phase: 'showdown', players };

    const sidePots = calculateSidePots(
      players.map((p) => ({
        playerId: p.id,
        totalBetThisHand: p.totalBetThisHand,
        folded: p.status === 'folded',
      }))
    );

    if (sidePots.length === 0) {
      this.endHand([], []);
      return;
    }

    // Need at least 5 total cards (2 hole + 3+ community) to evaluate hands.
    // If community cards are insufficient (e.g. hand ended pre-flop), split pot equally.
    const activePlayers = players.filter((p) => p.status !== 'folded' && p.holeCards != null);
    if (this.state.communityCards.length + 2 < 5 || activePlayers.length === 0) {
      if (activePlayers.length === 0) {
        this.endHand([], []);
        return;
      }
      const splitAmount = Math.floor(this.state.pot / activePlayers.length);
      const remainder = this.state.pot - splitAmount * activePlayers.length;
      const winners: HandResult['winners'] = activePlayers.map((p, idx) => ({
        playerId: p.id,
        amount: splitAmount + (idx === 0 ? remainder : 0),
      }));
      const updatedPlayers = players.map((p) => {
        const win = winners.find((w) => w.playerId === p.id);
        return win ? { ...p, chipStack: p.chipStack + win.amount } : p;
      });
      this.endHand(winners, [], updatedPlayers);
      return;
    }

    const handRanks = activePlayers
      .map((p) => ({
        playerId: p.id,
        handRank: evaluateHand(p.holeCards!, this.state.communityCards),
        holeCards: p.holeCards!,
      }));

    const winners: HandResult['winners'] = [];
    let updatedPlayers = [...players];

    for (const pot of sidePots) {
      const eligible = handRanks.filter((h) => pot.eligiblePlayerIds.includes(h.playerId));
      if (eligible.length === 0) continue;

      const winnerIds = findWinners(eligible);
      const splitAmount = Math.floor(pot.amount / winnerIds.length);
      const remainder = pot.amount - splitAmount * winnerIds.length;

      winnerIds.forEach((id, idx) => {
        const award = splitAmount + (idx === 0 ? remainder : 0);
        winners.push({
          playerId: id,
          amount: award,
          handRank: eligible.find((h) => h.playerId === id)!.handRank,
        });
        updatedPlayers = updatedPlayers.map((p) =>
          p.id === id ? { ...p, chipStack: p.chipStack + award } : p
        );
      });
    }

    this.endHand(winners, handRanks, updatedPlayers);
  }

  private endHand(
    winners: HandResult['winners'],
    handRanks: HandResult['handRanks'],
    players?: Player[]
  ): void {
    const result: HandResult = { winners, handRanks };
    const finalPlayers = (players ?? this.state.players).map((p) => ({
      ...p,
      status: 'waiting' as Player['status'],
      // Keep hole cards for non-folded players so they remain visible during hand_complete
      holeCards: p.status !== 'folded' ? p.holeCards : null,
      currentBet: 0,
      totalBetThisHand: 0,
      isReady: p.isBot, // bots auto-ready
    }));

    // Build hand summary for history
    const summary: HandSummary = {
      handNumber: this.state.handNumber,
      winners: result.winners.map((w) => ({
        playerName: this.state.players.find((p) => p.id === w.playerId)?.name ?? w.playerId,
        amount: w.amount,
        handRankName: w.handRank?.name,
      })),
      totalPot: result.winners.reduce((sum, w) => sum + w.amount, 0),
    };
    const handHistory = [...this.state.handHistory, summary].slice(-20);

    const newSessionHandCount = this.state.sessionHandCount + 1;
    const maxHands = this.state.config.maxHands;
    const sessionEnding = maxHands > 0 && newSessionHandCount >= maxHands;

    // Check if all humans will be eliminated after this hand
    const humansWillBeEliminated = finalPlayers.every(
      (p) => p.isBot || p.chipStack === 0
    );

    this.state = {
      ...this.state,
      phase: 'hand_complete',
      players: finalPlayers,
      communityCards: this.state.communityCards,
      pot: 0,
      sidePots: [],
      currentPlayerSeatIndex: -1,
      turnDeadlineMs: undefined,
      lastHandResult: result,
      handHistory,
      sessionHandCount: newSessionHandCount,
      // Mark session as pending complete (confirmed via confirmResult or auto-confirm)
      sessionPendingComplete: sessionEnding || humansWillBeEliminated,
      confirmDeadlineMs: Date.now() + 30_000,
    };

    this.emitStateUpdate();
    this.emit({ type: 'hand_complete', result, state: this.state });
    // session_complete is now deferred until all players confirm (see endSession())
  }

  private buildSessionResult(players: Player[], totalHands: number): SessionResult {
    const sorted = [...players]
      .filter((p) => !p.isBot || p.startingChipStack != null)
      .sort((a, b) => b.chipStack - a.chipStack);

    return {
      totalHands,
      rankings: sorted.map((p, i) => ({
        rank: i + 1,
        playerId: p.id,
        playerName: p.name,
        finalChipStack: p.chipStack,
        netGain: p.chipStack - (p.startingChipStack ?? p.chipStack),
      })),
    };
  }

  private awardPotToLastPlayer(player: Player): void {
    const winAmount = this.state.pot;
    const updatedPlayers = this.state.players.map((p) =>
      p.id === player.id ? { ...p, chipStack: p.chipStack + winAmount } : p
    );
    const result: HandResult = {
      winners: [{ playerId: player.id, amount: winAmount }],
      handRanks: [],
    };
    this.endHand(result.winners, [], updatedPlayers);
  }

  private nextPhase(): GamePhase {
    switch (this.state.phase) {
      case 'pre_flop': return 'flop';
      case 'flop': return 'turn';
      case 'turn': return 'river';
      case 'river': return 'showdown';
      default: return 'showdown';
    }
  }

  private nextDealerSeat(): number {
    if (this.state.dealerSeatIndex === -1) {
      const first = this.state.players
        .filter((p) => p.chipStack > 0)
        .sort((a, b) => a.seatIndex - b.seatIndex)[0];
      return first?.seatIndex ?? 0;
    }
    const eligible = this.state.players
      .filter((p) => p.chipStack > 0 && p.status !== 'sitting_out')
      .sort((a, b) => a.seatIndex - b.seatIndex);
    const afterDealer = eligible.find((p) => p.seatIndex > this.state.dealerSeatIndex);
    return (afterDealer ?? eligible[0])?.seatIndex ?? 0;
  }

  private getActiveSeatOrder(players: Player[], afterSeatIndex: number): Player[] {
    const eligible = players.filter(
      (p) => p.status !== 'sitting_out' && p.chipStack + p.currentBet > 0
    );
    return getPlayersInOrder(eligible, afterSeatIndex);
  }

  private emitStateUpdate(): void {
    this.emit({ type: 'state_updated', state: this.state });
  }

  private emitTurnStart(): void {
    const player = this.state.players.find(
      (p) => p.seatIndex === this.state.currentPlayerSeatIndex
    );
    if (player && this.state.turnDeadlineMs) {
      this.emit({
        type: 'turn_start',
        playerId: player.id,
        seatIndex: player.seatIndex,
        deadlineMs: this.state.turnDeadlineMs,
      });
    }
  }
}
