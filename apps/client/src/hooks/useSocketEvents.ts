import { useEffect } from 'react';
import { getSocket } from '../socket/socketClient.js';
import { useGameStore } from '../store/gameStore.js';
import type { BotThought } from '../store/gameStore.js';
import { EVENTS } from '@texas-poker/shared';
import type { GameState, HandResult, SessionResult } from '@texas-poker/shared';

export function useSocketEvents() {
  const { setGameState, setHandResult, setSessionResult, setError, setTurnStart, addBotThought } = useGameStore();

  useEffect(() => {
    const socket = getSocket();

    socket.on(EVENTS.GAME_STATE_UPDATE, (state: GameState) => {
      setGameState(state);
    });

    socket.on(EVENTS.GAME_HAND_COMPLETE, (result: HandResult) => {
      setHandResult(result);
    });

    socket.on(EVENTS.GAME_SESSION_COMPLETE, (result: SessionResult) => {
      setSessionResult(result);
    });

    socket.on(EVENTS.GAME_TURN_START, (data: { playerId: string; deadlineMs: number }) => {
      setTurnStart(data.deadlineMs);
    });

    socket.on(EVENTS.GAME_ERROR, (err: { code: string; message: string }) => {
      setError(`${err.code}: ${err.message}`);
    });

    socket.on(EVENTS.GAME_BOT_THOUGHT, (thought: BotThought) => {
      addBotThought(thought);
    });

    return () => {
      socket.off(EVENTS.GAME_STATE_UPDATE);
      socket.off(EVENTS.GAME_HAND_COMPLETE);
      socket.off(EVENTS.GAME_SESSION_COMPLETE);
      socket.off(EVENTS.GAME_TURN_START);
      socket.off(EVENTS.GAME_ERROR);
      socket.off(EVENTS.GAME_BOT_THOUGHT);
    };
  }, [setGameState, setHandResult, setSessionResult, setError, setTurnStart, addBotThought]);
}
