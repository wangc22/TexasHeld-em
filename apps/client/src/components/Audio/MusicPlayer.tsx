/**
 * MusicPlayer: invisible component that manages background music.
 * - Loops /music/background.mp3
 * - Respects isMuted from musicStore
 * - Silently does nothing if the audio file doesn't exist
 * - Handles browser autoplay policy: starts muted, unmutes on first user interaction
 */
import { useEffect, useRef } from 'react';
import { useMusicStore } from '../../store/musicStore.js';

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMuted = useMusicStore((s) => s.isMuted);
  const volume = useMusicStore((s) => s.volume);

  useEffect(() => {
    const audio = new Audio('/music/background.mp4');
    audio.loop = true;
    audio.volume = volume;
    // Start muted to satisfy autoplay policy; unmute on first interaction if user hasn't muted
    audio.muted = true;
    audioRef.current = audio;

    audio.play().catch(() => {
      // Autoplay blocked or file missing — both are acceptable, stay silent
    });

    const handleFirstInteraction = () => {
      if (!useMusicStore.getState().isMuted) {
        audio.muted = false;
      }
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);

    return () => {
      audio.pause();
      audio.src = '';
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync mute state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Sync volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return null;
}
