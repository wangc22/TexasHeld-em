import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { config } from './config.js';
import { TableManager } from './table/TableManager.js';
import { authMiddleware } from './websocket/middleware.js';
import { registerGameHandlers } from './websocket/gameHandlers.js';
import { authRoutes } from './http/auth.js';
import { tableRoutes } from './http/tables.js';
import { decideBotAction, setBotDifficulty } from './bot/BotPlayer.js';
import { EVENTS } from '@texas-poker/shared';
import type { GameEvent } from './game/GameEngine.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: config.corsOrigin,
  credentials: true,
});

// ─── Bot thought log (in-memory, last 100 entries) ────────────────────────────

interface BotThoughtEntry {
  ts: number;
  tableId: string;
  handNumber: number;
  botName: string;
  action: string;
  amount?: number;
  reasoning: string;
}

const botThoughtLog: BotThoughtEntry[] = [];

// ─── Table manager ────────────────────────────────────────────────────────────

const tables = new TableManager(async (tableId: string, event: GameEvent) => {
  // Broadcast engine events to the Socket.io room
  broadcastEvent(tableId, event);

  // Trigger bot action if it's a bot's turn
  if (event.type === 'turn_start') {
    const engine = tables.getEngine(tableId);
    if (!engine) return;
    const state = engine.getState();
    const currentPlayer = state.players.find(
      (p) => p.seatIndex === state.currentPlayerSeatIndex
    );
    if (currentPlayer?.isBot) {
      void tables.withLock(tableId, async () => {
        const result = await decideBotAction(state, currentPlayer.id);
        engine.applyAction(currentPlayer.id, result);

        // Always broadcast bot thought (with or without API reasoning)
        const newState = engine.getState();
        const entry: BotThoughtEntry = {
          ts: Date.now(),
          tableId,
          handNumber: newState.handNumber,
          botName: currentPlayer.name,
          action: result.type,
          amount: result.amount,
          reasoning: result.reasoning ?? '(No analysis)',
        };
        botThoughtLog.push(entry);
        if (botThoughtLog.length > 100) botThoughtLog.shift();

        io.to(tableId).emit(EVENTS.GAME_BOT_THOUGHT, entry);
        console.log(`[Bot Thought] #${entry.handNumber} ${entry.botName}: ${entry.reasoning} → ${entry.action}${entry.amount ? ` ${entry.amount}` : ''}`);
      });
    }
  }
});

// ─── HTTP routes ──────────────────────────────────────────────────────────────

// Health check / root route
fastify.get('/', async () => ({
  status: 'ok',
  service: 'Texas Hold\'em Poker API',
  frontend: config.corsOrigin,
}));

await fastify.register(authRoutes);
await fastify.register(tableRoutes(tables));

// Bot thought log endpoint
fastify.get('/bot-log', async (request) => {
  const { tableId } = request.query as { tableId?: string };
  const entries = tableId
    ? botThoughtLog.filter((e) => e.tableId === tableId)
    : botThoughtLog;
  return { entries };
});

// ─── Socket.io setup ──────────────────────────────────────────────────────────

const io = new Server(fastify.server, {
  cors: {
    origin: config.corsOrigin,
    credentials: true,
  },
});

// Auth middleware
io.use((socket, next) => authMiddleware(socket as unknown as Parameters<typeof authMiddleware>[0], next));

io.on('connection', (socket) => {
  const playerId = socket.data['playerId'] as string;
  fastify.log.info(`Player ${playerId} connected (socket ${socket.id})`);

  registerGameHandlers(io, socket, tables, playerId, (tableId, botPlayerId) => {
    setBotDifficulty(botPlayerId, 'expert');
  });
});

// ─── Broadcast helper ─────────────────────────────────────────────────────────

function broadcastEvent(tableId: string, event: GameEvent): void {
  const formatActionBubble = (
    actionType: 'fold' | 'check' | 'call' | 'raise' | 'all_in',
    amount?: number
  ): string => {
    switch (actionType) {
      case 'fold':
        return 'Fold';
      case 'check':
        return 'Check';
      case 'call':
        return amount != null ? `Call ${amount}` : 'Call';
      case 'raise':
        return amount != null ? `Raise +${amount}` : 'Raise';
      case 'all_in':
        return amount != null ? `All-in +${amount}` : 'All-in';
      default:
        return 'Action';
    }
  };

  if (event.type === 'state_updated') {
    // Send personalized state to each socket in the room
    const socketsInRoom = io.sockets.adapter.rooms.get(tableId);
    if (!socketsInRoom) return;

    for (const socketId of socketsInRoom) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      const pid = socket.data['playerId'] as string;
      const engine = tables.getEngine(tableId);
      if (engine) {
        socket.emit(EVENTS.GAME_STATE_UPDATE, engine.getStateForPlayer(pid));
      }
    }
  } else if (event.type === 'turn_start') {
    io.to(tableId).emit(EVENTS.GAME_TURN_START, {
      playerId: event.playerId,
      seatIndex: event.seatIndex,
      deadlineMs: event.deadlineMs,
    });
  } else if (event.type === 'action_taken') {
    io.to(tableId).emit(EVENTS.GAME_CHAT_BROADCAST, {
      playerId: event.playerId,
      content: formatActionBubble(event.actionType, event.amount),
      contentType: 'message',
      ts: Date.now(),
    });
  } else if (event.type === 'hand_complete') {
    io.to(tableId).emit(EVENTS.GAME_HAND_COMPLETE, event.result);
  } else if (event.type === 'session_complete') {
    io.to(tableId).emit(EVENTS.GAME_SESSION_COMPLETE, event.result);
  } else if (event.type === 'error') {
    io.to(tableId).emit(EVENTS.GAME_ERROR, {
      code: event.code,
      message: event.message,
    });
  }
}

// ─── Start server ─────────────────────────────────────────────────────────────

try {
  await fastify.listen({ port: config.port, host: config.host });
  console.log(`Server running on http://localhost:${config.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
