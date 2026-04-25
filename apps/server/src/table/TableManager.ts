/**
 * TableManager: manages all active poker tables in memory.
 *
 * Each table owns a GameEngine instance.
 * State is kept in-memory for now (can be extended to Redis for multi-instance).
 *
 * Locking: each table has an async mutex to prevent concurrent action processing.
 */
import { GameEngine } from '../game/GameEngine.js';
import type { GameEvent } from '../game/GameEngine.js';
import type { GameState, TableConfig } from '@texas-poker/shared';
import { DEFAULT_TABLE_CONFIG } from '@texas-poker/shared';
import { v4 as uuidv4 } from 'uuid';

export interface TableInfo {
  tableId: string;
  name: string;
  config: TableConfig;
  playerCount: number;
  maxPlayers: number;
  phase: string;
  createdAt: number;
}

interface TableEntry {
  engine: GameEngine;
  name: string;
  lock: Promise<void>;
  resolveLock: () => void;
  turnTimer: ReturnType<typeof setTimeout> | null;
  /** Timer that auto-confirms all players 30s after hand_complete */
  confirmTimer: ReturnType<typeof setTimeout> | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  socketIdToPlayerId: Map<string, string>;
  playerIdToSocketId: Map<string, string>;
  emptyTimer: ReturnType<typeof setTimeout> | null;
  /** Player ID of the current host/room-owner */
  hostPlayerId: string | null;
  /** Player IDs that are currently bot takeovers (to be cleaned up after hand_complete) */
  botTakeoverSet: Set<string>;
}

export class TableManager {
  private tables = new Map<string, TableEntry>();
  private onEvent: (tableId: string, event: GameEvent) => void;

  constructor(onEvent: (tableId: string, event: GameEvent) => void) {
    this.onEvent = onEvent;
  }

  isNameTaken(name: string): boolean {
    const normalized = name.trim().toLowerCase();
    for (const entry of this.tables.values()) {
      if (entry.name.trim().toLowerCase() === normalized) return true;
    }
    return false;
  }

  createTable(name: string, config?: Partial<TableConfig>): string {
    const tableId = uuidv4();
    const tableConfig: TableConfig = { ...DEFAULT_TABLE_CONFIG, ...config };
    const entry: TableEntry = {
      engine: new GameEngine(tableId, tableConfig, (event) => {
        this.handleEngineEvent(tableId, event);
      }),
      name,
      lock: Promise.resolve(),
      resolveLock: () => {},
      turnTimer: null,
      confirmTimer: null,
      disconnectTimers: new Map(),
      socketIdToPlayerId: new Map(),
      playerIdToSocketId: new Map(),
      emptyTimer: null,
      hostPlayerId: null,
      botTakeoverSet: new Set(),
    };
    this.tables.set(tableId, entry);
    return tableId;
  }

  listTables(): TableInfo[] {
    return Array.from(this.tables.entries())
      .map(([tableId, entry]) => {
        const state = entry.engine.getState();
        return {
          tableId,
          name: entry.name,
          config: state.config,
          // Only count real (non-bot) active players
          playerCount: state.players.filter((p) => !p.isBot && p.status !== 'sitting_out').length,
          maxPlayers: state.config.maxPlayers,
          phase: state.phase,
          createdAt: 0,
        };
      })
      .filter((t) => t.playerCount > 0); // hide rooms with no human players
  }

  getEngine(tableId: string): GameEngine | null {
    return this.tables.get(tableId)?.engine ?? null;
  }

  /**
   * Execute an action with per-table locking to prevent concurrent state mutations.
   * Lock is released after fn completes or after 30 seconds (timeout guard).
   */
  async withLock<T>(tableId: string, fn: (engine: GameEngine) => T): Promise<T | null> {
    const entry = this.tables.get(tableId);
    if (!entry) return null;

    // Chain onto existing lock
    let release!: () => void;
    const prevLock = entry.lock;
    entry.lock = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Wait for previous lock with timeout guard
    await Promise.race([
      prevLock,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`Lock timeout on table ${tableId}`)), 30000)
      ),
    ]);

    try {
      return await Promise.resolve(fn(entry.engine));
    } finally {
      release();
    }
  }

  /**
   * Destroy a table and clean up all associated resources.
   */
  destroyTable(tableId: string): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;

    if (entry.turnTimer) clearTimeout(entry.turnTimer);
    if (entry.confirmTimer) clearTimeout(entry.confirmTimer);
    if (entry.emptyTimer) clearTimeout(entry.emptyTimer);
    for (const timer of entry.disconnectTimers.values()) clearTimeout(timer);

    this.tables.delete(tableId);
  }

  /**
   * Schedule table destruction after gracePeriodMs if still empty.
   * Called when the last player leaves.
   */
  scheduleTableCleanup(tableId: string, gracePeriodMs = 30_000): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;

    if (entry.emptyTimer) clearTimeout(entry.emptyTimer);
    entry.emptyTimer = setTimeout(() => {
      const e = this.tables.get(tableId);
      if (!e) return;
      const playerCount = e.engine.getState().players.length;
      if (playerCount === 0) {
        this.destroyTable(tableId);
      }
    }, gracePeriodMs);
  }

  cancelTableCleanup(tableId: string): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;
    if (entry.emptyTimer) {
      clearTimeout(entry.emptyTimer);
      entry.emptyTimer = null;
    }
  }

  // ─── Host management ──────────────────────────────────────────────────────────

  /**
   * Set host only if no host is currently assigned.
   * Call inside withLock to avoid race conditions.
   */
  setHostIfUnset(tableId: string, playerId: string): void {
    const entry = this.tables.get(tableId);
    if (!entry || entry.hostPlayerId !== null) return;
    entry.hostPlayerId = playerId;
    entry.engine.setHost(playerId);
  }

  getHostPlayerId(tableId: string): string | null {
    return this.tables.get(tableId)?.hostPlayerId ?? null;
  }

  isHost(tableId: string, playerId: string): boolean {
    return this.tables.get(tableId)?.hostPlayerId === playerId;
  }

  // ─── Player / socket tracking ────────────────────────────────────────────────

  registerSocket(tableId: string, socketId: string, playerId: string): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;

    // Kick old socket if same player reconnects
    const oldSocketId = entry.playerIdToSocketId.get(playerId);
    if (oldSocketId && oldSocketId !== socketId) {
      entry.socketIdToPlayerId.delete(oldSocketId);
    }

    entry.socketIdToPlayerId.set(socketId, playerId);
    entry.playerIdToSocketId.set(playerId, socketId);
  }

  unregisterSocket(tableId: string, socketId: string): string | null {
    const entry = this.tables.get(tableId);
    if (!entry) return null;

    const playerId = entry.socketIdToPlayerId.get(socketId);
    if (!playerId) return null;

    entry.socketIdToPlayerId.delete(socketId);
    entry.playerIdToSocketId.delete(playerId);
    return playerId;
  }

  getPlayerIdForSocket(tableId: string, socketId: string): string | null {
    return this.tables.get(tableId)?.socketIdToPlayerId.get(socketId) ?? null;
  }

  // ─── Turn timer management ────────────────────────────────────────────────────

  resetTurnTimer(tableId: string, deadlineMs: number, playerId: string): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;

    // Don't schedule timer while paused
    if (entry.engine.getState().isPaused) return;

    if (entry.turnTimer) clearTimeout(entry.turnTimer);

    const delay = deadlineMs - Date.now();
    if (delay <= 0) {
      void this.handleTurnTimeout(tableId);
      return;
    }

    entry.turnTimer = setTimeout(() => {
      void this.handleTurnTimeout(tableId);
    }, delay);
  }

  clearTurnTimer(tableId: string): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;
    if (entry.turnTimer) {
      clearTimeout(entry.turnTimer);
      entry.turnTimer = null;
    }
  }

  // ─── Confirm timer management ─────────────────────────────────────────────────

  startConfirmTimer(tableId: string, delayMs: number): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;
    if (entry.confirmTimer) clearTimeout(entry.confirmTimer);
    entry.confirmTimer = setTimeout(() => {
      entry.confirmTimer = null;
      void this.withLock(tableId, (engine) => {
        engine.autoConfirmAll();
      });
    }, delayMs);
  }

  clearConfirmTimer(tableId: string): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;
    if (entry.confirmTimer) {
      clearTimeout(entry.confirmTimer);
      entry.confirmTimer = null;
    }
  }

  // ─── Pause / Resume ───────────────────────────────────────────────────────────

  pauseTable(tableId: string): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;
    entry.engine.pause();
    // Freeze the turn timer
    if (entry.turnTimer) {
      clearTimeout(entry.turnTimer);
      entry.turnTimer = null;
    }
  }

  resumeTable(tableId: string): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;
    entry.engine.resume();
    // The resume() call updates turnDeadlineMs; re-schedule the timer
    const state = entry.engine.getState();
    if (state.turnDeadlineMs && state.currentPlayerSeatIndex >= 0) {
      const currentPlayer = state.players.find(p => p.seatIndex === state.currentPlayerSeatIndex);
      if (currentPlayer) {
        this.resetTurnTimer(tableId, state.turnDeadlineMs, currentPlayer.id);
      }
    }
  }

  // ─── Disconnect timer management ─────────────────────────────────────────────

  startDisconnectTimer(
    tableId: string,
    playerId: string,
    gracePeriodMs: number,
    onExpire: (playerId: string) => void
  ): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;

    const existing = entry.disconnectTimers.get(playerId);
    if (existing) clearTimeout(existing);

    entry.disconnectTimers.set(
      playerId,
      setTimeout(() => {
        entry.disconnectTimers.delete(playerId);
        onExpire(playerId);
      }, gracePeriodMs)
    );
  }

  clearDisconnectTimer(tableId: string, playerId: string): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;
    const timer = entry.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      entry.disconnectTimers.delete(playerId);
    }
  }

  /**
   * Handle disconnect timer expiry for a player.
   * - Mid-hand: convert player to bot takeover (preserves seat/chips)
   * - Otherwise: remove player from table
   * Also transfers host if needed and checks if all real players are gone.
   */
  async handleDisconnectExpiry(tableId: string, playerId: string, socketId: string): Promise<void> {
    await this.withLock(tableId, (engine) => {
      const state = engine.getState();
      const activeMidHand = ['pre_flop', 'flop', 'turn', 'river', 'showdown'].includes(state.phase);

      // Clean up socket mapping
      const entry = this.tables.get(tableId);
      if (entry && socketId) {
        entry.socketIdToPlayerId.delete(socketId);
        entry.playerIdToSocketId.delete(playerId);
      }

      if (activeMidHand) {
        // Convert to bot takeover so the hand can continue
        engine.convertToBot(playerId);
        if (entry) entry.botTakeoverSet.add(playerId);
      } else {
        engine.removePlayer(playerId);
        // Transfer host if this was the host
        this.transferHostInsideLock(tableId, playerId, engine);
      }

      // After any real player departure, check if all real players are gone
      this.checkAllRealPlayersGoneInsideLock(tableId, engine);
    });

    // After the hand is settled, destroy table if no real players remain
    setImmediate(() => {
      this.destroyIfNoRealPlayers(tableId);
    });
  }

  /**
   * Handle immediate player leave (GAME_LEAVE_TABLE or forced removal).
   * Transfers host if needed, then destroys table if only bots remain.
   */
  async handlePlayerLeave(tableId: string, playerId: string, socketId: string): Promise<void> {
    await this.withLock(tableId, (engine) => {
      engine.removePlayer(playerId);
      const entry = this.tables.get(tableId);
      if (entry && socketId) {
        entry.socketIdToPlayerId.delete(socketId);
        entry.playerIdToSocketId.delete(playerId);
      }
      this.transferHostInsideLock(tableId, playerId, engine);
      this.checkAllRealPlayersGoneInsideLock(tableId, engine);
    });

    // After the hand is settled, destroy table if no real players remain
    setImmediate(() => {
      this.destroyIfNoRealPlayers(tableId);
    });
  }

  /**
   * Handle socket disconnect: mark player as disconnected and transfer host if needed.
   * Should be called inside a withLock callback from the disconnect handler.
   */
  onPlayerSocketDisconnect(tableId: string, playerId: string, engine: GameEngine): void {
    engine.setPlayerConnected(playerId, false);
    this.transferHostInsideLock(tableId, playerId, engine);
  }

  /**
   * Destroy the table if no real (non-bot, connected, active) players remain.
   * Called after any player removal to ensure bot-only tables are cleaned up.
   */
  destroyIfNoRealPlayers(tableId: string): void {
    const entry = this.tables.get(tableId);
    if (!entry) return;

    const state = entry.engine.getState();
    const realPlayers = state.players.filter(
      (p) => !p.isBot && p.status !== 'sitting_out'
    );

    if (realPlayers.length === 0) {
      this.destroyTable(tableId);
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async handleTurnTimeout(tableId: string): Promise<void> {
    await this.withLock(tableId, (engine) => {
      engine.autoFoldCurrentPlayer();
    });
  }

  /**
   * Transfer host to next non-bot connected player.
   * Must be called inside withLock (directly operates on engine).
   */
  private transferHostInsideLock(tableId: string, leavingPlayerId: string, engine: GameEngine): void {
    const entry = this.tables.get(tableId);
    if (!entry || entry.hostPlayerId !== leavingPlayerId) return;

    const state = engine.getState();
    const nextHost = state.players.find(
      (p) => p.id !== leavingPlayerId && !p.isBot && p.isConnected && p.status !== 'sitting_out'
    );

    entry.hostPlayerId = nextHost?.id ?? null;
    engine.setHost(entry.hostPlayerId);
  }

  /**
   * If no real (non-bot, connected) players remain, end the hand immediately.
   * Must be called inside withLock.
   */
  private checkAllRealPlayersGoneInsideLock(tableId: string, engine: GameEngine): void {
    const state = engine.getState();
    const activeMidHand = ['pre_flop', 'flop', 'turn', 'river', 'showdown'].includes(state.phase);
    if (!activeMidHand) return;

    const realPlayers = state.players.filter(
      (p) => !p.isBot && p.isConnected && p.status !== 'sitting_out'
    );
    if (realPlayers.length === 0) {
      engine.endHandImmediately();
    }
  }

  private handleEngineEvent(tableId: string, event: GameEvent): void {
    if (event.type === 'turn_start') {
      this.clearConfirmTimer(tableId);
      this.resetTurnTimer(tableId, event.deadlineMs, event.playerId);
    } else if (event.type === 'hand_complete') {
      this.clearTurnTimer(tableId);
      // Start 30s auto-confirm timer
      this.startConfirmTimer(tableId, 30_000);
      // Schedule takeover bot cleanup after the current lock is released
      const entry = this.tables.get(tableId);
      if (entry && entry.botTakeoverSet.size > 0) {
        const playerIds = [...entry.botTakeoverSet];
        entry.botTakeoverSet.clear();
        setImmediate(() => {
          for (const pid of playerIds) {
            void this.withLock(tableId, (eng) => {
              // Also transfer host if a takeover bot was the host
              this.transferHostInsideLock(tableId, pid, eng);
              eng.removePlayer(pid);
            });
          }
        });
      }
    }
    this.onEvent(tableId, event);
  }
}
