/**
 * Socket.io event handlers for game events.
 *
 * All handlers follow 6-layer validation:
 * 1. JWT valid + playerId exists
 * 2. tableId valid + player is at this table
 * 3. Game phase allows this operation
 * 4. Is current action player
 * 5. Action type is legal
 * 6. Amount is legal
 *
 * Validation layers 1-2 are done here; 4-6 are done by GameEngine.applyAction().
 */
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import type { TableManager } from '../table/TableManager.js';
import { EVENTS } from '@texas-poker/shared';
import { config } from '../config.js';
import { setBotDifficulty } from '../bot/BotPlayer.js';

// ─── Input schemas (Zod runtime validation) ───────────────────────────────────

const JoinTableSchema = z.object({
  tableId: z.string().uuid(),
  playerName: z.string().min(1).max(30),
  buyIn: z.number().int().min(1).optional(),
});

const ActionSchema = z.object({
  tableId: z.string().uuid(),
  action: z.object({
    type: z.enum(['fold', 'check', 'call', 'raise', 'all_in']),
    amount: z.number().int().min(0).optional(),
  }),
});

const TableIdSchema = z.object({ tableId: z.string().uuid() });

const ChatSchema = z.object({
  tableId: z.string().uuid(),
  content: z.string().min(1).max(80),
  contentType: z.enum(['message', 'emoji']),
});

const AddBotSchema = z.object({
  tableId: z.string().uuid(),
  botName: z.string().min(1).max(30).optional(),
  difficulty: z.enum(['novice', 'intermediate', 'expert', 'conservative', 'aggressive', 'random']).optional(),
});

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerGameHandlers(
  io: Server,
  socket: Socket,
  tables: TableManager,
  playerId: string,
  startBotAction: (tableId: string, botPlayerId: string) => void
): void {
  // ── Join table ─────────────────────────────────────────────────────────────
  socket.on(EVENTS.GAME_JOIN_TABLE, async (data: unknown) => {
    const parsed = JoinTableSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'INVALID_INPUT', message: parsed.error.message });
      return;
    }
    const { tableId, playerName, buyIn } = parsed.data;

    const result = await tables.withLock(tableId, (engine) => {
      const chipStack = buyIn ?? engine.getState().config.minBuyIn;
      const addResult = engine.addPlayer(playerId, playerName, chipStack);
      if (addResult.ok) {
        // First player to join becomes the host
        tables.setHostIfUnset(tableId, playerId);
      }
      return addResult;
    });

    if (!result) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'TABLE_NOT_FOUND', message: 'Table not found' });
      return;
    }
    if (!result.ok) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'JOIN_FAILED', message: result.error });
      return;
    }

    tables.cancelTableCleanup(tableId);
    tables.registerSocket(tableId, socket.id, playerId);
    await socket.join(tableId);

    // Send full state to joining player
    const engine = tables.getEngine(tableId);
    if (engine) {
      socket.emit(EVENTS.GAME_STATE_UPDATE, engine.getStateForPlayer(playerId));
    }
  });

  // ── Leave table ────────────────────────────────────────────────────────────
  socket.on(EVENTS.GAME_LEAVE_TABLE, async (data: unknown) => {
    const parsed = TableIdSchema.safeParse(data);
    if (!parsed.success) return;
    const { tableId } = parsed.data;

    tables.clearDisconnectTimer(tableId, playerId);
    await tables.handlePlayerLeave(tableId, playerId, socket.id);
    await socket.leave(tableId);
  });

  // ── Start hand (legacy — kept for backward compat) ─────────────────────────
  socket.on(EVENTS.GAME_START, async (data: unknown) => {
    const parsed = TableIdSchema.safeParse(data);
    if (!parsed.success) return;
    const { tableId } = parsed.data;

    const result = await tables.withLock(tableId, (engine) => engine.startHand());
    if (result && !result.ok) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'START_FAILED', message: result.error });
    }
  });

  // ── Session start (host only) ──────────────────────────────────────────────
  socket.on(EVENTS.GAME_SESSION_START, async (data: unknown) => {
    const parsed = TableIdSchema.safeParse(data);
    if (!parsed.success) return;
    const { tableId } = parsed.data;

    if (!tables.isHost(tableId, playerId)) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'NOT_HOST', message: 'Only the host can start the session' });
      return;
    }

    const result = await tables.withLock(tableId, (engine) => engine.startSession(playerId));
    if (result && !result.ok) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'SESSION_START_FAILED', message: result.error });
    }
  });

  // ── Player ready ───────────────────────────────────────────────────────────
  socket.on(EVENTS.GAME_PLAYER_READY, async (data: unknown) => {
    const parsed = TableIdSchema.safeParse(data);
    if (!parsed.success) return;
    const { tableId } = parsed.data;

    const result = await tables.withLock(tableId, (engine) => engine.markPlayerReady(playerId));
    if (result && !result.ok) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'READY_FAILED', message: result.error });
    }
  });

  // ── Player action ──────────────────────────────────────────────────────────
  socket.on(EVENTS.GAME_ACTION, async (data: unknown) => {
    const parsed = ActionSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'INVALID_INPUT', message: parsed.error.message });
      return;
    }
    const { tableId, action } = parsed.data;

    // Verify this socket is registered at this table
    const registeredPlayer = tables.getPlayerIdForSocket(tableId, socket.id);
    if (registeredPlayer !== playerId) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'NOT_AT_TABLE', message: 'You are not at this table' });
      return;
    }

    const result = await tables.withLock(tableId, (engine) =>
      engine.applyAction(playerId, action)
    );

    if (result && !result.ok) {
      socket.emit(EVENTS.GAME_ERROR, { code: result.error ?? 'ACTION_FAILED', message: result.error });
    }
  });

  // ── Add bot ────────────────────────────────────────────────────────────────
  socket.on(EVENTS.GAME_ADD_BOT, async (data: unknown) => {
    const parsed = AddBotSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'INVALID_INPUT', message: parsed.error.message });
      return;
    }
    const { tableId, botName, difficulty } = parsed.data;

    const botId = `bot_${Math.random().toString(36).slice(2, 8)}`;
    const resolvedDifficulty = difficulty ?? 'aggressive';

    const result = await tables.withLock(tableId, (engine) => {
      const state = engine.getState();
      const currentBots = state.players.filter((p) => p.isBot);
      if (currentBots.length >= 3) {
        return { ok: false as const, error: 'Max 3 AI bots allowed' };
      }
      // Auto-name: AI1, AI2, AI3 based on current bot count
      const resolvedName = botName ?? `AI${currentBots.length + 1}`;
      setBotDifficulty(botId, resolvedDifficulty);
      const chipStack = state.config.minBuyIn;
      return engine.addPlayer(botId, resolvedName, chipStack, true);
    });

    if (result && !result.ok) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'ADD_BOT_FAILED', message: result.error });
    }
  });

  // ── Confirm result ─────────────────────────────────────────────────────────
  socket.on(EVENTS.GAME_CONFIRM_RESULT, async (data: unknown) => {
    const parsed = TableIdSchema.safeParse(data);
    if (!parsed.success) return;
    const { tableId } = parsed.data;

    await tables.withLock(tableId, (engine) => engine.confirmResult(playerId));
  });

  // ── Pause (host only) ──────────────────────────────────────────────────────
  socket.on(EVENTS.GAME_PAUSE, async (data: unknown) => {
    const parsed = TableIdSchema.safeParse(data);
    if (!parsed.success) return;
    const { tableId } = parsed.data;

    if (!tables.isHost(tableId, playerId)) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'NOT_HOST', message: 'Only the host can pause the game' });
      return;
    }
    await tables.withLock(tableId, () => tables.pauseTable(tableId));
  });

  // ── Resume (host only) ─────────────────────────────────────────────────────
  socket.on(EVENTS.GAME_RESUME, async (data: unknown) => {
    const parsed = TableIdSchema.safeParse(data);
    if (!parsed.success) return;
    const { tableId } = parsed.data;

    if (!tables.isHost(tableId, playerId)) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'NOT_HOST', message: 'Only the host can resume the game' });
      return;
    }
    await tables.withLock(tableId, () => tables.resumeTable(tableId));
  });

  // ── Quick chat ─────────────────────────────────────────────────────────────
  const lastChatTime = new Map<string, number>(); // tableId -> ms
  socket.on(EVENTS.GAME_CHAT, (data: unknown) => {
    const parsed = ChatSchema.safeParse(data);
    if (!parsed.success) return;
    const { tableId, content, contentType } = parsed.data;

    // Verify player is at this table
    if (tables.getPlayerIdForSocket(tableId, socket.id) !== playerId) return;

    // Rate limit: 5 s per table
    const now = Date.now();
    if (now - (lastChatTime.get(tableId) ?? 0) < 5000) {
      socket.emit(EVENTS.GAME_ERROR, { code: 'RATE_LIMITED', message: '发送太频繁，请稍等 5 秒' });
      return;
    }
    lastChatTime.set(tableId, now);

    io.to(tableId).emit(EVENTS.GAME_CHAT_BROADCAST, { playerId, content, contentType, ts: now });
  });

  // ── Disconnect handling ────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    for (const tableId of Array.from(socket.rooms)) {
      if (tableId === socket.id) continue; // skip personal room

      // Mark disconnected + transfer host immediately (before grace period expires)
      void tables.withLock(tableId, (engine) => {
        tables.onPlayerSocketDisconnect(tableId, playerId, engine);
      });

      // If this is the last real player, destroy immediately (no grace period)
      const engine = tables.getEngine(tableId);
      if (engine) {
        const state = engine.getState();
        const otherRealPlayers = state.players.filter(
          (p) => p.id !== playerId && !p.isBot && p.status !== 'sitting_out'
        );
        if (otherRealPlayers.length === 0) {
          void tables.handlePlayerLeave(tableId, playerId, socket.id);
          continue;
        }
      }

      tables.startDisconnectTimer(
        tableId,
        playerId,
        config.disconnectGracePeriodMs,
        async (pid) => {
          await tables.handleDisconnectExpiry(tableId, pid, socket.id);
        }
      );
    }
  });
}
