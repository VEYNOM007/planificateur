import { describe, expect, it } from 'vitest';
import {
  addDaysKey,
  asDateKey,
  buildDateKey,
  dayDifference,
  daysInMonthOf,
  fromDateKey,
  isDateKey,
  monthDifference,
  toDateKey,
  weekdayOf,
  yearDifference,
} from './dateKey';

describe('isDateKey', () => {
  it('accepte une date locale valide', () => {
    expect(isDateKey('2026-10-16')).toBe(true);
    expect(isDateKey('2028-02-29')).toBe(true);
  });

  it('refuse une date impossible ou mal formée', () => {
    expect(isDateKey('2026-02-31')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-1-01')).toBe(false);
    expect(isDateKey('16/10/2026')).toBe(false);
    expect(isDateKey('2026-10-16T00:00:00Z')).toBe(false);
  });
});

describe('asDateKey', () => {
  it('lève une erreur sur une date invalide', () => {
    expect(() => asDateKey('2026-02-31')).toThrow();
    expect(asDateKey('2026-10-16')).toBe('2026-10-16');
  });
});

describe('toDateKey et fromDateKey', () => {
  it('conserve la date locale, quel que soit le fuseau', () => {
    const key = toDateKey(new Date(2026, 9, 16, 6, 0));
    expect(key).toBe('2026-10-16');
    expect(fromDateKey(key).getHours()).toBe(0);
    expect(fromDateKey(key).getMinutes()).toBe(0);
  });

  it('reste stable au passage à l’heure d’hiver (France, octobre 2026)', () => {
    // Le 25 octobre 2026 à 3h00, l'heure recule : la date locale ne change pas.
    expect(toDateKey(new Date(2026, 9, 25, 6, 0))).toBe('2026-10-25');
    expect(toDateKey(new Date(2026, 9, 25, 3, 30))).toBe('2026-10-25');
  });
});

describe('arithmétique de dates', () => {
  it('ajoute des jours', () => {
    expect(addDaysKey(asDateKey('2026-10-31'), 1)).toBe('2026-11-01');
    expect(addDaysKey(asDateKey('2026-01-01'), -1)).toBe('2025-12-31');
  });

  it('mesure les écarts', () => {
    expect(dayDifference(asDateKey('2026-10-16'), asDateKey('2026-10-18'))).toBe(2);
    expect(dayDifference(asDateKey('2026-10-18'), asDateKey('2026-10-16'))).toBe(-2);
    expect(monthDifference(asDateKey('2026-01-31'), asDateKey('2026-03-01'))).toBe(2);
    expect(yearDifference(asDateKey('2026-12-31'), asDateKey('2028-01-01'))).toBe(2);
  });

  it('donne le jour de la semaine (0 = dimanche)', () => {
    expect(weekdayOf(asDateKey('2026-10-16'))).toBe(5);
    expect(weekdayOf(asDateKey('2026-10-18'))).toBe(0);
    expect(weekdayOf(asDateKey('2026-10-15'))).toBe(4);
  });

  it('construit une clé et connaît la fin du mois', () => {
    expect(buildDateKey(2026, 2, 28)).toBe('2026-02-28');
    expect(daysInMonthOf(2026, 2)).toBe(28);
    expect(daysInMonthOf(2028, 2)).toBe(29);
    expect(daysInMonthOf(2026, 4)).toBe(30);
  });
});
