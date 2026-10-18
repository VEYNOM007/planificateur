import { useEffect } from 'react';
import { toDateKey } from '../../domain/time/dateKey';
import { timelineStore, useTimelineStore } from '../../state/timeline';

export function nowMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Aligne `nowMin` sur la minute (vérification toutes les 20 s) et fait
 * défiler à J+1 seulement si l'utilisateur regardait le jour d'avant.
 */
export function useNowClock(): void {
  useEffect(() => {
    let today = toDateKey(new Date());

    const tick = (): void => {
      const now = new Date();
      const nextToday = toDateKey(now);
      timelineStore.setNowMin(nowMinutes(now));
      if (nextToday !== today) {
        const state = useTimelineStore.getState();
        if (state.date === today) {
          state.setDate(nextToday);
        }
        today = nextToday;
      }
    };

    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, []);
}
