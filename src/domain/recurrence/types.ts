/**
 * Types de récurrence, purs et partagés. Une règle est stockée une seule fois :
 * aucune occurrence n'est créée à l'avance, elles sont calculées à l'affichage.
 */
import type { DateKey } from '../time/dateKey';

/** 0 = dimanche … 6 = samedi, comme Date.getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RecurrenceFreq = 'day' | 'week' | 'month' | 'year';
export type MonthlyMode = 'dayOfMonth' | 'nthWeekday';
export type EndType = 'never' | 'count' | 'until';

/** Rang dans le mois : 5 signifie « le dernier ». */
export const LAST_NTH = 5;

export interface Recurrence {
  freq: RecurrenceFreq;
  /** Intervalle >= 1 (tous les N jours, semaines, mois ou années). */
  interval: number;
  /** Jours choisis pour la fréquence hebdomadaire. */
  byWeekday: Weekday[];
  monthlyMode: MonthlyMode;
  /** Rang dans le mois pour monthlyMode = nthWeekday (1 à 5, 5 = dernier). */
  nth: number;
  endType: EndType;
  /** Nombre total d'occurrences (dont la première) si endType = count. */
  count: number;
  /** Dernière date incluse si endType = until. */
  until: DateKey | null;
}

export const WEEKDAY_LABELS: readonly string[] = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
];

export function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}
