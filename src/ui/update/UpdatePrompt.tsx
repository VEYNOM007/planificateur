import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Bannière « Nouvelle version, recharger » (scénario d'acceptation 8).
 * Le rechargement reste toujours à l'initiative de l'utilisateur.
 */
export function UpdatePrompt(): React.JSX.Element | null {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<
    ((reloadPage: boolean) => Promise<void>) | null
  >(null);

  useEffect(() => {
    const applyUpdate = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => {
        // Application prête à fonctionner hors ligne : rien à afficher.
      },
    });
    setUpdateServiceWorker(() => applyUpdate);
  }, []);

  if (!needRefresh || updateServiceWorker === null) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '12px',
        right: '12px',
        bottom: 'calc(60px + env(safe-area-inset-bottom) + 12px)',
        maxWidth: '430px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: 'var(--radius)',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 16px rgb(0 0 0 / 0.25)',
      }}
    >
      <span>Nouvelle version disponible.</span>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        style={{
          background: 'var(--color-accent)',
          color: 'var(--color-on-accent)',
          padding: '8px 14px',
          fontWeight: 600,
        }}
      >
        Recharger
      </button>
    </div>
  );
}
