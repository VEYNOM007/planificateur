const TOKEN_KEY = 'planificateur:installation-token';
const TOKEN_BYTES = 32;

/** Jeton secret unique par installation, envoyé au service de rappels. */
export function generateInstallationToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Retourne le jeton d'installation existant, ou en crée un au premier lancement. */
export function getOrCreateInstallationToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing !== null && existing.length === TOKEN_BYTES * 2) {
    return existing;
  }
  const token = generateInstallationToken();
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}
