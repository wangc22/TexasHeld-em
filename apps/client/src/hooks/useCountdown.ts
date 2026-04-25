import { useState, useEffect } from 'react';

export function useCountdown(deadlineMs: number | null): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!deadlineMs) {
      setRemaining(0);
      return;
    }

    const update = () => {
      const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setRemaining(left);
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [deadlineMs]);

  return remaining;
}
