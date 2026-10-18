/**
 * Demande au navigateur de ne jamais purger les données stockées
 * (IndexedDB) faute d'espace. Sur iPhone, l'application installée
 * n'est pas concernée par la purge après 7 jours de Safari.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator.storage?.persist !== 'function') return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
