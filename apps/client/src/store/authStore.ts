import { create } from 'zustand';
import type { Language } from '../i18n/strings.js';

interface AuthState {
  playerId: string | null;
  playerName: string | null;
  token: string | null;
  language: Language;
  setAuth: (playerId: string, name: string, token: string) => void;
  clearAuth: () => void;
  setLanguage: (lang: Language) => void;
}

function loadValidSession(): { playerId: string | null; playerName: string | null; token: string | null } {
  const token = localStorage.getItem('poker_token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()) {
        return {
          playerId: localStorage.getItem('poker_player_id'),
          playerName: localStorage.getItem('poker_player_name'),
          token,
        };
      }
    } catch {
      // malformed token
    }
    // Token expired or invalid — clear stale data
    localStorage.removeItem('poker_player_id');
    localStorage.removeItem('poker_player_name');
    localStorage.removeItem('poker_token');
  }
  return { playerId: null, playerName: null, token: null };
}

const initialSession = loadValidSession();

const storedLanguage = localStorage.getItem('poker_language') as Language | null;

export const useAuthStore = create<AuthState>((set) => ({
  playerId: initialSession.playerId,
  playerName: initialSession.playerName,
  token: initialSession.token,
  language: storedLanguage ?? 'en',

  setAuth: (playerId, playerName, token) => {
    localStorage.setItem('poker_player_id', playerId);
    localStorage.setItem('poker_player_name', playerName);
    localStorage.setItem('poker_token', token);
    set({ playerId, playerName, token });
  },

  clearAuth: () => {
    localStorage.removeItem('poker_player_id');
    localStorage.removeItem('poker_player_name');
    localStorage.removeItem('poker_token');
    set({ playerId: null, playerName: null, token: null });
  },

  setLanguage: (lang) => {
    localStorage.setItem('poker_language', lang);
    set({ language: lang });
  },
}));
