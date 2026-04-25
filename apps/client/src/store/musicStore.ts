import { create } from 'zustand';

interface MusicStore {
  isMuted: boolean;
  volume: number;
  toggleMute: () => void;
  setVolume: (v: number) => void;
}

export const useMusicStore = create<MusicStore>((set) => ({
  isMuted: localStorage.getItem('poker_music_muted') === 'true',
  volume: 0.3,

  toggleMute: () =>
    set((state) => {
      const next = !state.isMuted;
      localStorage.setItem('poker_music_muted', String(next));
      return { isMuted: next };
    }),

  setVolume: (volume) => set({ volume }),
}));
