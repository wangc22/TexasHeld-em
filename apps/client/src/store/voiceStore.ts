import { create } from 'zustand';

interface VoiceParticipant {
  playerId: string;
  isSpeaking: boolean;
  isMuted: boolean;
  stream?: MediaStream;
}

interface VoiceStore {
  joined: boolean;
  localMuted: boolean;
  participants: Record<string, VoiceParticipant>;

  setJoined: (joined: boolean) => void;
  setLocalMuted: (muted: boolean) => void;
  setParticipant: (playerId: string, data: Partial<VoiceParticipant>) => void;
  removeParticipant: (playerId: string) => void;
}

export const useVoiceStore = create<VoiceStore>((set) => ({
  joined: false,
  localMuted: false,
  participants: {},

  setJoined: (joined) => set({ joined }),
  setLocalMuted: (localMuted) => set({ localMuted }),
  setParticipant: (playerId, data) =>
    set((state) => {
      const existing = state.participants[playerId];
      const merged: VoiceParticipant = {
        playerId,
        isSpeaking: existing?.isSpeaking ?? false,
        isMuted: existing?.isMuted ?? false,
        stream: existing?.stream,
        ...data,
      };
      return { participants: { ...state.participants, [playerId]: merged } };
    }),
  removeParticipant: (playerId) =>
    set((state) => {
      const participants = { ...state.participants };
      delete participants[playerId];
      return { participants };
    }),
}));
