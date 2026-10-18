import { useEffect, useState } from 'react';
import { asDateKey, isDateKey, toDateKey, type DateKey } from '../../domain/time/dateKey';

export const ROUTES = ['jour', 'taches', 'modeles', 'reglages'] as const;
export type Route = (typeof ROUTES)[number];

export interface HashTarget {
  route: Route;
  /** Date explicite dans l'URL (uniquement pour `jour`), sinon null. */
  date: DateKey | null;
}

function parseHash(): HashTarget {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [head = '', param] = raw.split('/');
  const route = ROUTES.find((r) => r === head) ?? 'jour';
  if (route === 'jour' && param !== undefined && isDateKey(param)) {
    return { route, date: asDateKey(param) };
  }
  return { route, date: null };
}

export function useHashRoute(): HashTarget {
  const [target, setTarget] = useState<HashTarget>(parseHash);

  useEffect(() => {
    const onChange = (): void => setTarget(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return target;
}

export function hrefFor(route: Route, date?: DateKey | null): string {
  if (route === 'jour') {
    return `#/jour/${date ?? toDateKey(new Date())}`;
  }
  return `#/${route}`;
}
