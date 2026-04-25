import { useState, useEffect } from 'react';
import { useAuthStore } from './store/authStore.js';
import { useSocketEvents } from './hooks/useSocketEvents.js';
import { useGameStore } from './store/gameStore.js';
import { LoginPage } from './pages/LoginPage.js';
import { LobbyPage } from './pages/LobbyPage.js';
import { GamePage } from './pages/GamePage.js';
import { getSocket } from './socket/socketClient.js';
import { EVENTS } from '@texas-poker/shared';

type Screen = 'login' | 'lobby' | 'game';

function App() {
  const token = useAuthStore((s) => s.token);
  const playerName = useAuthStore((s) => s.playerName);
  const setTableId = useGameStore((s) => s.setTableId);
  const tableId = useGameStore((s) => s.tableId);
  const clearGameState = useGameStore((s) => s.clearGameState);

  const [screen, setScreen] = useState<Screen>(token ? 'lobby' : 'login');
  const [pendingTableId, setPendingTableId] = useState<string | null>(null);

  // Register global socket event handlers
  useSocketEvents();

  // Read hash on mount — auto-join if already logged in
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('room/')) {
      const id = hash.replace('room/', '').trim();
      if (id) setPendingTableId(id);
    }
  }, []);

  // When we have a pendingTableId and are logged in (lobby screen), auto-join
  useEffect(() => {
    if (!pendingTableId || screen !== 'lobby' || !token) return;
    const id = pendingTableId;
    setPendingTableId(null);
    const socket = getSocket();
    const doJoin = () => {
      socket.emit(EVENTS.GAME_JOIN_TABLE, {
        tableId: id,
        playerName: playerName ?? 'Player',
        buyIn: 1000,
      });
      handleJoinTable(id);
    };
    if (socket.connected) {
      doJoin();
    } else {
      socket.once('connect', doJoin);
      socket.connect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTableId, screen, token]);

  const handleLogin = () => setScreen('lobby');

  const handleJoinTable = (id: string) => {
    setTableId(id);
    setScreen('game');
    window.location.hash = `room/${id}`;
  };

  const handleLeave = () => {
    clearGameState();
    setTableId(null);
    setScreen('lobby');
    window.location.hash = '';
  };

  if (screen === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (screen === 'lobby') {
    return <LobbyPage onJoinTable={handleJoinTable} />;
  }

  if (screen === 'game' && tableId) {
    return <GamePage tableId={tableId} onLeave={handleLeave} />;
  }

  return <LobbyPage onJoinTable={handleJoinTable} />;
}

export default App;
