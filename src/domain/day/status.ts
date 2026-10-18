/**
 * Statut affiché d'un bloc pour une date donnée, en tenant compte de
 * l'exception d'occurrence et de l'heure courante.
 * Pur : « en cours » n'est jamais stocké, il est recalculé.
 */
import type { BlockDisplayStatus, Override } from '../models';
import { MINUTES_PER_DAY, clampMinutes } from '../time/minutes';

export interface StatusInput {
  /** Statut enregistré du bloc (utilisé si aucune exception). */
  status: 'todo' | 'done' | 'skipped';
  /** Exception de l'occurrence, ou null. */
  override: Override | null;
  /** Début effectif du bloc, en minutes depuis minuit. */
  startMin: number;
  /** Durée effective, en minutes. */
  durationMin: number;
  /** Heure courante en minutes depuis minuit, ou null si inconnue. */
  nowMin: number | null;
  /** Vrai si la date affichée est aujourd'hui. */
  isToday: boolean;
}

export function displayStatus(input: StatusInput): BlockDisplayStatus {
  if (input.override !== null) {
    if (input.override.action === 'deleted') return 'skipped';
    if (input.override.action === 'done') return 'done';
    if (input.override.action === 'skipped') return 'skipped';
  }
  if (input.status !== 'todo') return input.status;
  if (!input.isToday || input.nowMin === null) return 'todo';

  const start = clampMinutes(input.startMin);
  const end = start + Math.max(0, input.durationMin);
  const now = clampMinutes(input.nowMin);
  if (now >= start && now < Math.min(end, MINUTES_PER_DAY)) return 'doing';
  return 'todo';
}
