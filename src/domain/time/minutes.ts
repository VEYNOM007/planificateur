/**
 * Module de temps pur : minutes depuis minuit, durées et découpage à minuit.
 * Aucune dépendance à React, Dexie ou au navigateur.
 */

export const MINUTES_PER_DAY = 1440;
export const MIN_DURATION = 5;

/** Ramène une valeur dans l'intervalle [0, 1439]. */
export function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.trunc(minutes)));
}

/** « 465 » → « 07:45 ». Les minutes sont des minutes depuis minuit. */
export function formatTime(minutes: number): string {
  const safe = clampMinutes(minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** Accepte « 7:05 » ou « 07:05 ». Renvoie null si la saisie est invalide. */
export function parseTime(input: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Ajoute (ou retire) des minutes, sans franchir les bornes de la journée. */
export function addMinutes(minutes: number, delta: number): number {
  return clampMinutes(minutes + delta);
}

/** Accroche une valeur sur le pas demandé (5 ou 15 minutes par exemple). */
export function snapMinutes(minutes: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return clampMinutes(minutes);
  return clampMinutes(Math.round(minutes / step) * step);
}

export interface TimeSpan {
  startMin: number;
  durationMin: number;
}

export function endMin(span: TimeSpan): number {
  return span.startMin + Math.max(MIN_DURATION, span.durationMin);
}

export function crossesMidnight(span: TimeSpan): boolean {
  return endMin(span) > MINUTES_PER_DAY;
}

export interface TimeSlice {
  /** 0 pour la partie qui commence aujourd'hui, 1 pour la partie du lendemain. */
  dayOffset: number;
  startMin: number;
  endMin: number;
}

/**
 * Découpe un bloc qui franchit minuit en deux tranches visuelles.
 * Un bloc ordinaire renvoie une seule tranche.
 */
export function splitAcrossMidnight(span: TimeSpan): TimeSlice[] {
  const start = clampMinutes(span.startMin);
  const end = endMin({ startMin: start, durationMin: span.durationMin });
  if (end <= MINUTES_PER_DAY) {
    return [{ dayOffset: 0, startMin: start, endMin: end }];
  }
  return [
    { dayOffset: 0, startMin: start, endMin: MINUTES_PER_DAY },
    { dayOffset: 1, startMin: 0, endMin: end - MINUTES_PER_DAY },
  ];
}
