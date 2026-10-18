import { useEffect, useState } from 'react';

/**
 * Compte à rebours : mise à jour par minute, une fois par seconde seulement
 * quand il reste moins d'une minute (économie de batterie).
 */
export function useCountdown(targetMs: number | null): number {
  const [remaining, setRemaining] = useState(() =>
    targetMs === null ? 0 : Math.max(0, targetMs - Date.now()),
  );

  useEffect(() => {
    if (targetMs === null) {
      setRemaining(0);
      return;
    }
    let timer = 0;
    const tick = (): void => {
      const left = Math.max(0, targetMs - Date.now());
      setRemaining(left);
      timer = window.setTimeout(tick, left >= 60_000 ? 60_000 : 1_000);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [targetMs]);

  return remaining;
}

/** 3 h 05 → « 3 h 05 », 12 min → « 12 min », 42 s → « 42 s ». */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')}`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds} s`;
}
