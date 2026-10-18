/**
 * Calcul des occurrences d'un bloc sur une fenêtre de dates.
 * Module pur : aucune occurrence n'est stockée, tout est calculé à l'affichage.
 *
 * Le calcul avance de période en période, en rejoignant directement la fenêtre
 * visible : l'ouverture d'un jour reste instantanée même avec 5 ans d'historique.
 */
import { addDays, compareAsc, differenceInCalendarDays, getDay } from 'date-fns';
import {
  buildDateKey,
  daysInMonthOf,
  fromDateKey,
  isDateKey,
  monthDifference,
  toDateKey,
  weekdayOf,
  yearDifference,
  type DateKey,
} from '../time/dateKey';
import { LAST_NTH, type Recurrence, type Weekday } from './types';

export interface RecurrenceSource {
  /** Date de départ de la série (ou date unique d'un bloc sans récurrence). */
  date: DateKey;
  recurrence: Recurrence | null;
}

export interface OccurrenceWindow {
  /** Borne incluse. */
  start: DateKey;
  /** Borne incluse. */
  end: DateKey;
}

/** Garde-fou : évite toute boucle sans fin sur une règle incohérente. */
const MAX_PERIODS = 50_000;

function normalizedInterval(interval: number): number {
  return Number.isFinite(interval) && interval >= 1 ? Math.trunc(interval) : 1;
}

function normalizedWeekdays(recurrence: Recurrence, start: DateKey): Weekday[] {
  const unique = Array.from(new Set(recurrence.byWeekday)).sort((a, b) => a - b);
  if (unique.length > 0) return unique;
  return [weekdayOf(start) as Weekday];
}

function nthWeekdayTarget(recurrence: Recurrence, start: DateKey): number {
  const first = recurrence.byWeekday[0];
  return first === undefined ? weekdayOf(start) : first;
}

/** Date du rang `nth` (1 à 5, 5 = dernier) du jour de semaine visé. */
function nthWeekdayDate(year: number, month: number, weekday: number, nth: number): DateKey | null {
  const total = daysInMonthOf(year, month);
  let last = 0;
  for (let day = 1; day <= total; day += 1) {
    if (getDay(new Date(year, month - 1, day)) === weekday) last = day;
  }
  if (last === 0) return null;
  const requested = Math.trunc(nth);
  const rank = requested >= LAST_NTH ? Math.floor((last - 1) / 7) + 1 : Math.max(1, requested);
  const firstOfMonth = new Date(year, month - 1, 1);
  const offset = (weekday - getDay(firstOfMonth) + 7) % 7;
  const day = 1 + offset + (rank - 1) * 7;
  if (day > total) return null;
  return buildDateKey(year, month, day);
}

/** Convertit un index de mois absolu (peut dépasser 11) en année + mois (1-12). */
function monthParts(source: DateKey, monthOffset: number): { year: number; month: number } {
  const date = fromDateKey(source);
  const absolute = date.getMonth() + monthOffset;
  return {
    year: date.getFullYear() + Math.floor(absolute / 12),
    month: (((absolute % 12) + 12) % 12) + 1,
  };
}

/** Occurrences produites par une période de la règle, triées. */
function candidatesForPeriod(
  source: RecurrenceSource,
  recurrence: Recurrence,
  interval: number,
  period: number,
): DateKey[] {
  const start = fromDateKey(source.date);

  if (recurrence.freq === 'day') {
    return [toDateKey(addDays(start, period * interval))];
  }

  if (recurrence.freq === 'week') {
    const base = period * interval * 7;
    const startWeekday = weekdayOf(source.date);
    return normalizedWeekdays(recurrence, source.date)
      .map((weekday) => addDays(start, base + ((weekday - startWeekday + 7) % 7)))
      .sort((a, b) => compareAsc(a, b))
      .map(toDateKey);
  }

  if (recurrence.freq === 'month') {
    const { year, month } = monthParts(source.date, period * interval);
    if (recurrence.monthlyMode === 'nthWeekday') {
      const date = nthWeekdayDate(
        year,
        month,
        nthWeekdayTarget(recurrence, source.date),
        recurrence.nth,
      );
      return date === null ? [] : [date];
    }
    return [buildDateKey(year, month, Math.min(start.getDate(), daysInMonthOf(year, month)))];
  }

  const year = start.getFullYear() + period * interval;
  const month = start.getMonth() + 1;
  return [buildDateKey(year, month, Math.min(start.getDate(), daysInMonthOf(year, month)))];
}

function occurrencesPerPeriod(source: RecurrenceSource, recurrence: Recurrence): number {
  return recurrence.freq === 'week' ? normalizedWeekdays(recurrence, source.date).length : 1;
}

/** Première période susceptible de contenir une occurrence de la fenêtre. */
function firstPeriod(
  source: RecurrenceSource,
  recurrence: Recurrence,
  interval: number,
  window: OccurrenceWindow,
): number {
  // Distance en jours de la date de départ vers le début de la fenêtre.
  const distance = differenceInCalendarDays(fromDateKey(window.start), fromDateKey(source.date));
  if (distance <= 0) return 0;
  if (recurrence.freq === 'day') return Math.max(0, Math.ceil(distance / interval));
  if (recurrence.freq === 'week') {
    return Math.max(0, Math.floor((distance - 6) / (interval * 7)));
  }
  if (recurrence.freq === 'month') {
    return Math.max(0, monthDifference(source.date, window.start));
  }
  return Math.max(0, yearDifference(source.date, window.start));
}

/**
 * Renvoie les occurrences de la série comprises dans la fenêtre (bornes
 * incluses), triées et sans doublon.
 */
export function computeOccurrences(source: RecurrenceSource, window: OccurrenceWindow): DateKey[] {
  if (!isDateKey(source.date) || !isDateKey(window.start) || !isDateKey(window.end)) {
    return [];
  }
  const startDate = fromDateKey(source.date);
  const windowStart = fromDateKey(window.start);
  const windowEnd = fromDateKey(window.end);

  if (compareAsc(windowStart, windowEnd) > 0) return [];
  if (compareAsc(windowEnd, startDate) < 0) return [];

  const recurrence = source.recurrence;
  if (recurrence === null) {
    if (compareAsc(startDate, windowStart) >= 0 && compareAsc(startDate, windowEnd) <= 0) {
      return [source.date];
    }
    return [];
  }

  const interval = normalizedInterval(recurrence.interval);
  const maxCount =
    recurrence.endType === 'count'
      ? Math.max(1, Math.trunc(recurrence.count))
      : Number.POSITIVE_INFINITY;
  const until =
    recurrence.endType === 'until' && recurrence.until !== null && isDateKey(recurrence.until)
      ? fromDateKey(recurrence.until)
      : null;

  const perPeriod = occurrencesPerPeriod(source, recurrence);
  const first = firstPeriod(source, recurrence, interval, window);
  const results: DateKey[] = [];
  let index = first * perPeriod;

  for (let period = first; period < first + MAX_PERIODS; period += 1) {
    for (const date of candidatesForPeriod(source, recurrence, interval, period)) {
      if (index >= maxCount) return results;
      index += 1;
      const asDate = fromDateKey(date);
      if (until !== null && compareAsc(asDate, until) > 0) return results;
      if (compareAsc(asDate, windowEnd) > 0) return results;
      if (compareAsc(asDate, windowStart) >= 0) results.push(date);
    }
  }

  return results;
}
