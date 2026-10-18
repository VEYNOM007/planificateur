import { useEffect } from 'react';
import { toDateKey } from '../../domain/time/dateKey';
import { useTimelineStore } from '../../state/timeline';
import { TodayScreen } from '../today/TodayScreen';
import { hrefFor, useHashRoute, type Route } from './useHashRoute';

const TABS: readonly { route: Route; label: string }[] = [
  { route: 'jour', label: 'Aujourd’hui' },
  { route: 'taches', label: 'Tâches' },
  { route: 'modeles', label: 'Modèles' },
  { route: 'reglages', label: 'Réglages' },
];

const PLACEHOLDERS: Record<Exclude<Route, 'jour'>, string> = {
  taches: 'La boîte « À planifier » arrive au jalon J4.',
  modeles: 'Les journées types arrivent au jalon J4.',
  reglages: 'Les réglages détaillés arrivent au jalon J7.',
};

export function AppShell(): React.JSX.Element {
  const target = useHashRoute();
  const date = target.date ?? toDateKey(new Date());
  const setDate = useTimelineStore((s) => s.setDate);

  useEffect(() => {
    setDate(date);
  }, [date, setDate]);

  return (
    <>
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: target.route === 'jour' ? 'flex-start' : 'center',
          minHeight: 0,
          textAlign: target.route === 'jour' ? 'start' : 'center',
        }}
      >
        {target.route === 'jour' ? (
          <TodayScreen />
        ) : (
          <div style={{ padding: '24px', margin: '0 auto', maxWidth: '430px' }}>
            <img src="icons/icon-192.png" alt="" width={64} height={64} />
            <h1 style={{ margin: '12px 0 8px', fontSize: '1.3rem' }}>Planificateur</h1>
            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
              {PLACEHOLDERS[target.route]}
            </p>
          </div>
        )}
      </main>
      <nav
        aria-label="Navigation principale"
        style={{
          display: 'flex',
          position: 'sticky',
          bottom: 0,
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 8,
        }}
      >
        {TABS.map(({ route: tab, label }) => (
          <a
            key={tab}
            href={tab === 'jour' ? hrefFor('jour', toDateKey(new Date())) : hrefFor(tab)}
            aria-current={tab === target.route ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 'var(--tap-min)',
              textDecoration: 'none',
              color: tab === target.route ? 'var(--color-accent)' : 'var(--color-text-muted)',
              fontWeight: tab === target.route ? 600 : 400,
              fontSize: '0.8rem',
            }}
          >
            {label}
          </a>
        ))}
      </nav>
    </>
  );
}
