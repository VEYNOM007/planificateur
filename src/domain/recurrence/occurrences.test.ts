import { describe, expect, it } from 'vitest';
import { asDateKey, type DateKey } from '../time/dateKey';
import type { Recurrence, Weekday } from './types';

/**
 * Tests écrits avant l'implémentation (TDD) : le calcul des occurrences est le
 * cœur métier de l'application, il doit être juste avant tout le reste.
 */
import { computeOccurrences } from './occurrences';

function recurrence(partial: Partial<Recurrence>): Recurrence {
  return {
    freq: 'day',
    interval: 1,
    byWeekday: [],
    monthlyMode: 'dayOfMonth',
    nth: 1,
    endType: 'never',
    count: 10,
    until: null,
    ...partial,
  };
}

function dates(list: string[]): DateKey[] {
  return list.map(asDateKey);
}

function window(start: string, end: string): { start: DateKey; end: DateKey } {
  return { start: asDateKey(start), end: asDateKey(end) };
}

describe('computeOccurrences — bloc unique', () => {
  it('renvoie la date du bloc quand elle est dans la fenêtre', () => {
    const result = computeOccurrences(
      { date: asDateKey('2026-10-16'), recurrence: null },
      window('2026-10-16', '2026-10-16'),
    );
    expect(result).toEqual(dates(['2026-10-16']));
  });

  it('ne renvoie rien si le bloc est hors de la fenêtre', () => {
    const result = computeOccurrences(
      { date: asDateKey('2026-10-16'), recurrence: null },
      window('2026-10-17', '2026-10-20'),
    );
    expect(result).toEqual([]);
  });
});

describe('computeOccurrences — tous les jours', () => {
  it('génère chaque jour de la fenêtre', () => {
    const result = computeOccurrences(
      { date: asDateKey('2026-10-16'), recurrence: recurrence({ freq: 'day' }) },
      window('2026-10-16', '2026-10-18'),
    );
    expect(result).toEqual(dates(['2026-10-16', '2026-10-17', '2026-10-18']));
  });

  it('respecte un intervalle de 3 jours', () => {
    const result = computeOccurrences(
      { date: asDateKey('2026-10-16'), recurrence: recurrence({ freq: 'day', interval: 3 }) },
      window('2026-10-20', '2026-10-26'),
    );
    expect(result).toEqual(dates(['2026-10-22', '2026-10-25']));
  });

  it('traite un intervalle nul ou négatif comme 1', () => {
    const result = computeOccurrences(
      { date: asDateKey('2026-10-16'), recurrence: recurrence({ freq: 'day', interval: 0 }) },
      window('2026-10-16', '2026-10-17'),
    );
    expect(result).toEqual(dates(['2026-10-16', '2026-10-17']));
  });
});

describe('computeOccurrences — toutes les weeks', () => {
  it('génère les jours choisis de chaque semaine (lundi et jeudi)', () => {
    const result = computeOccurrences(
      {
        date: asDateKey('2026-10-15'),
        recurrence: recurrence({ freq: 'week', byWeekday: [1, 4] as Weekday[] }),
      },
      window('2026-10-15', '2026-10-26'),
    );
    expect(result).toEqual(dates(['2026-10-15', '2026-10-19', '2026-10-22', '2026-10-26']));
  });

  it('respecte un intervalle de 2 semaines', () => {
    const result = computeOccurrences(
      {
        date: asDateKey('2026-10-12'),
        recurrence: recurrence({ freq: 'week', interval: 2, byWeekday: [1] as Weekday[] }),
      },
      window('2026-10-12', '2026-11-10'),
    );
    expect(result).toEqual(dates(['2026-10-12', '2026-10-26', '2026-11-09']));
  });

  it('utilise le jour de départ quand aucun jour n’est choisi', () => {
    const result = computeOccurrences(
      { date: asDateKey('2026-10-15'), recurrence: recurrence({ freq: 'week' }) },
      window('2026-10-15', '2026-10-29'),
    );
    expect(result).toEqual(dates(['2026-10-15', '2026-10-22', '2026-10-29']));
  });

  it('ne renvoie jamais d’occurrence avant la date de départ', () => {
    const result = computeOccurrences(
      {
        date: asDateKey('2026-10-15'),
        recurrence: recurrence({ freq: 'week', byWeekday: [0, 1, 2, 3, 4, 5, 6] as Weekday[] }),
      },
      window('2026-10-01', '2026-10-20'),
    );
    expect(result[0]).toBe('2026-10-15');
    expect(result).toEqual(
      dates(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']),
    );
  });
});

describe('computeOccurrences — tous les mois', () => {
  it('ramène le 31 au dernier jour des mois plus courts', () => {
    const result = computeOccurrences(
      { date: asDateKey('2026-01-31'), recurrence: recurrence({ freq: 'month' }) },
      window('2026-01-01', '2026-05-01'),
    );
    expect(result).toEqual(dates(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']));
  });

  it('respecte un intervalle trimestriel', () => {
    const result = computeOccurrences(
      {
        date: asDateKey('2026-01-15'),
        recurrence: recurrence({ freq: 'month', interval: 3 }),
      },
      window('2026-01-01', '2026-12-31'),
    );
    expect(result).toEqual(dates(['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']));
  });

  it('gère le deuxième mardi du mois (rang dans le mois)', () => {
    const result = computeOccurrences(
      {
        date: asDateKey('2026-10-13'),
        recurrence: recurrence({
          freq: 'month',
          monthlyMode: 'nthWeekday',
          nth: 2,
          byWeekday: [2] as Weekday[],
        }),
      },
      window('2026-10-01', '2026-12-31'),
    );
    expect(result).toEqual(dates(['2026-10-13', '2026-11-10', '2026-12-08']));
  });

  it('gère le dernier vendredi du mois (rang 5 = dernier)', () => {
    const result = computeOccurrences(
      {
        date: asDateKey('2026-10-30'),
        recurrence: recurrence({
          freq: 'month',
          monthlyMode: 'nthWeekday',
          nth: 5,
          byWeekday: [5] as Weekday[],
        }),
      },
      window('2026-10-01', '2026-12-31'),
    );
    expect(result).toEqual(dates(['2026-10-30', '2026-11-27', '2026-12-25']));
  });

  it('utilise le jour de départ quand aucun jour n’est choisi pour nthWeekday', () => {
    const result = computeOccurrences(
      {
        date: asDateKey('2026-10-15'),
        recurrence: recurrence({ freq: 'month', monthlyMode: 'nthWeekday', nth: 3 }),
      },
      window('2026-10-01', '2026-11-30'),
    );
    expect(result).toEqual(dates(['2026-10-15', '2026-11-19']));
  });
});

describe('computeOccurrences — tous les ans', () => {
  it('génère la même date chaque année', () => {
    const result = computeOccurrences(
      { date: asDateKey('2026-10-16'), recurrence: recurrence({ freq: 'year' }) },
      window('2026-01-01', '2029-12-31'),
    );
    expect(result).toEqual(dates(['2026-10-16', '2027-10-16', '2028-10-16', '2029-10-16']));
  });

  it('ramène le 29 février au dernier jour des années non bissextiles', () => {
    const result = computeOccurrences(
      { date: asDateKey('2028-02-29'), recurrence: recurrence({ freq: 'year' }) },
      window('2028-01-01', '2033-12-31'),
    );
    expect(result).toEqual(
      dates(['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29', '2033-02-28']),
    );
  });
});

describe('computeOccurrences — fin de série', () => {
  it('s’arrête après N occurrences (count inclusif)', () => {
    const result = computeOccurrences(
      {
        date: asDateKey('2026-10-16'),
        recurrence: recurrence({ freq: 'day', endType: 'count', count: 3 }),
      },
      window('2026-10-16', '2026-12-31'),
    );
    expect(result).toEqual(dates(['2026-10-16', '2026-10-17', '2026-10-18']));
  });

  it('compte toutes les occurrences quand une semaine en produit plusieurs', () => {
    const result = computeOccurrences(
      {
        date: asDateKey('2026-10-12'),
        recurrence: recurrence({
          freq: 'week',
          byWeekday: [1, 4] as Weekday[],
          endType: 'count',
          count: 5,
        }),
      },
      window('2026-10-01', '2027-01-31'),
    );
    expect(result).toEqual(
      dates(['2026-10-12', '2026-10-15', '2026-10-19', '2026-10-22', '2026-10-26']),
    );
  });

  it('s’arrête à la date de fin incluse', () => {
    const result = computeOccurrences(
      {
        date: asDateKey('2026-10-16'),
        recurrence: recurrence({ freq: 'day', endType: 'until', until: asDateKey('2026-10-18') }),
      },
      window('2026-10-16', '2026-12-31'),
    );
    expect(result).toEqual(dates(['2026-10-16', '2026-10-17', '2026-10-18']));
  });
});

describe('computeOccurrences — fenêtre visible plus marge', () => {
  it('borne strictement les occurrences à la fenêtre demandée', () => {
    const result = computeOccurrences(
      { date: asDateKey('2020-01-01'), recurrence: recurrence({ freq: 'day' }) },
      window('2026-10-16', '2026-10-18'),
    );
    expect(result).toEqual(dates(['2026-10-16', '2026-10-17', '2026-10-18']));
  });

  it('calcule 5 ans de récurrence quotidienne sans ralentir', () => {
    const started = performance.now();
    const result = computeOccurrences(
      { date: asDateKey('2021-10-16'), recurrence: recurrence({ freq: 'day' }) },
      window('2026-10-01', '2026-10-31'),
    );
    const elapsed = performance.now() - started;
    expect(result).toHaveLength(31);
    expect(result[0]).toBe('2026-10-01');
    expect(result[30]).toBe('2026-10-31');
    expect(elapsed).toBeLessThan(200);
  });

  it('produit des dates locales stables au passage à l’heure d’hiver', () => {
    const result = computeOccurrences(
      { date: asDateKey('2026-10-24'), recurrence: recurrence({ freq: 'day' }) },
      window('2026-10-24', '2026-10-26'),
    );
    expect(result).toEqual(dates(['2026-10-24', '2026-10-25', '2026-10-26']));
  });

  it('déduplique et trie les jours choisis', () => {
    const result = computeOccurrences(
      {
        date: asDateKey('2026-10-12'),
        recurrence: recurrence({ freq: 'week', byWeekday: [4, 1, 4, 1] as Weekday[] }),
      },
      window('2026-10-12', '2026-10-18'),
    );
    expect(result).toEqual(dates(['2026-10-12', '2026-10-15']));
  });
});
