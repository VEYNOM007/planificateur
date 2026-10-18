/** Identifiants et horodatages générés sur l'appareil. */

/** UUID v4 généré localement (crypto.randomUUID). */
export function newId(): string {
  return crypto.randomUUID();
}

/** Horodatage technique en ISO UTC (métadonnée, jamais une heure de bloc). */
export function nowIso(): string {
  return new Date().toISOString();
}
