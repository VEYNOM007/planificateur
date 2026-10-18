/**
 * Dates locales « flottantes » : une date est une chaîne AAAA-MM-JJ et des
 * minutes depuis minuit. On ne stocke jamais d'horodatage UTC — un bloc à 6h00
 * reste à 6h00 après un changement d'heure ou un voyage.
 */
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  format,
  getDaysInMonth,
  getDay,
  parseISO,
} from 'date-fns';

export type DateKey = string & { readonly __brand: 'DateKey' };

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0');
}

/** Construit une clé de date à partir d'année, mois (1 à 12) et jour. */
export function buildDateKey(year: number, month: number, day: number): DateKey {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}` as DateKey;
}

/**
 * Vrai si la chaîne est une date locale valide, en toutes lettres
 * (le 31 février est refusé, pas corrigé).
 */
export function isDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > getDaysInMonth(new Date(year, month - 1, 1))) return false;
  return true;
}

/** Convertit une chaîne validée en clé de date ; lève une erreur sinon. */
export function asDateKey(value: string): DateKey {
  if (!isDateKey(value)) throw new Error(`Date locale invalide : « ${value} »`);
  // La validation ci-dessus garantit le format AAAA-MM-JJ.
  return value as DateKey;
}

/** Date locale d'un objet Date (le fuseau du téléphone fait foi). */
export function toDateKey(date: Date): DateKey {
  return format(date, 'yyyy-MM-dd') as DateKey;
}

/** Minuit local de la clé de date. */
export function fromDateKey(key: DateKey): Date {
  return parseISO(key);
}

export function addDaysKey(key: DateKey, days: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** Nombre de jours entiers de `a` vers `b` (b - a). */
export function dayDifference(a: DateKey, b: DateKey): number {
  return differenceInCalendarDays(fromDateKey(b), fromDateKey(a));
}

/** Nombre de mois calendaires entiers de `a` vers `b`. */
export function monthDifference(a: DateKey, b: DateKey): number {
  return differenceInCalendarMonths(fromDateKey(b), fromDateKey(a));
}

/** Nombre d'années calendaires entières de `a` vers `b`. */
export function yearDifference(a: DateKey, b: DateKey): number {
  return differenceInCalendarYears(fromDateKey(b), fromDateKey(a));
}

/** 0 = dimanche … 6 = samedi, comme Date.getDay(). */
export function weekdayOf(key: DateKey): number {
  return getDay(fromDateKey(key));
}

export function addMonthsKey(key: DateKey, months: number): DateKey {
  return toDateKey(addMonths(fromDateKey(key), months));
}

export function addYearsKey(key: DateKey, years: number): DateKey {
  return toDateKey(addYears(fromDateKey(key), years));
}

export function daysInMonthOf(year: number, month: number): number {
  return getDaysInMonth(new Date(year, month - 1, 1));
}
