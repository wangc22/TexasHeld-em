import { create } from 'zustand';
import type { GameState, HandResult, SessionResult } from '@texas-poker/shared';

export interface BotThought {
  ts: number;
  tableId: string;
  handNumber: number;
  botName: string;
  action: string;
  amount?: number;
  reasoning: string;
}

interface GameStore {
  tableId: string | null;
  gameState: GameState | null;
  lastHandResult: HandResult | null;
  sessionResult: SessionResult | null;
  botThoughts: BotThought[];
  error: string | null;
  isTurnStart: boolean;
  turnDeadlineMs: number | null;

  setTableId: (id: string | null) => void;
  setGameState: (state: GameState) => void;
  setHandResult: (result: HandResult) => void;
  setSessionResult: (result: SessionResult | null) => void;
  addBotThought: (thought: BotThought) => void;
  setError: (msg: string | null) => void;
  setTurnStart: (deadlineMs: number) => void;
  clearTurnStart: () => void;
  clearGameState: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  tableId: null,
  gameState: null,
  lastHandResult: null,
  sessionResult: null,
  botThoughts: [],
  error: null,
  isTurnStart: false,
  turnDeadlineMs: null,

  setTableId: (id) => set({ tableId: id }),
  setGameState: (state) => set((s) => {
    // Different table or fresh after clearGameState — wipe stale results
    if (!s.gameState || s.gameState.tableId !== state.tableId) {
      return { gameState: state, lastHandResult: null, sessionResult: null, botThoughts: [] };
    }
    const newHand = state.handNumber > s.gameState.handNumber;
    return newHand ? { gameState: state, botThoughts: [] } : { gameState: state };
  }),
  setHandResult: (result) => set({ lastHandResult: result }),
  setSessionResult: (result) => set({ sessionResult: result }),
  addBotThought: (thought) =>
    set((s) => ({ botThoughts: [...s.botThoughts.slice(-99), thought] })),
  setError: (error) => set({ error }),
  setTurnStart: (deadlineMs) => set({ isTurnStart: true, turnDeadlineMs: deadlineMs }),
  clearTurnStart: () => set({ isTurnStart: false, turnDeadlineMs: null }),
  clearGameState: () => set({
    gameState: null,
    lastHandResult: null,
    sessionResult: null,
    error: null,
    botThoughts: [],
    isTurnStart: false,
    turnDeadlineMs: null,
  }),
}));
