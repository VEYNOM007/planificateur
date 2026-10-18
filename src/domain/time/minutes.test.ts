import { describe, expect, it } from 'vitest';
import {
  MINUTES_PER_DAY,
  addMinutes,
  clampMinutes,
  crossesMidnight,
  endMin,
  formatTime,
  parseTime,
  snapMinutes,
  splitAcrossMidnight,
} from './minutes';

describe('formatTime', () => {
  it('formate les minutes depuis minuit', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(465)).toBe('07:45');
    expect(formatTime(1439)).toBe('23:59');
  });
});

describe('parseTime', () => {
  it('accepte « 7:05 » et « 07:05 »', () => {
    expect(parseTime('7:05')).toBe(425);
    expect(parseTime('07:05')).toBe(425);
    expect(parseTime(' 23:59 ')).toBe(1439);
  });

  it('refuse une saisie invalide', () => {
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('midi')).toBeNull();
    expect(parseTime('')).toBeNull();
  });
});

describe('clampMinutes', () => {
  it('borne dans la journée', () => {
    expect(clampMinutes(-30)).toBe(0);
    expect(clampMinutes(1500)).toBe(MINUTES_PER_DAY - 1);
    expect(clampMinutes(Number.NaN)).toBe(0);
    expect(clampMinutes(90.7)).toBe(90);
  });
});

describe('addMinutes', () => {
  it('ajoute et retire sans sortir de la journée', () => {
    expect(addMinutes(420, 15)).toBe(435);
    expect(addMinutes(5, -15)).toBe(0);
    expect(addMinutes(1430, 30)).toBe(1439);
  });
});

describe('snapMinutes', () => {
  it('accroche sur le pas demandé', () => {
    expect(snapMinutes(423, 15)).toBe(420);
    expect(snapMinutes(428, 15)).toBe(435);
    expect(snapMinutes(423, 5)).toBe(425);
    expect(snapMinutes(423, 0)).toBe(423);
  });
});

describe('endMin et crossesMidnight', () => {
  it('respecte une durée minimale de 5 minutes', () => {
    expect(endMin({ startMin: 420, durationMin: 2 })).toBe(425);
    expect(endMin({ startMin: 420, durationMin: 60 })).toBe(480);
  });

  it('détecte le passage de minuit', () => {
    // 23h00 + 60 min s'arrête exactement à minuit : le bloc ne déborde pas.
    expect(crossesMidnight({ startMin: 1380, durationMin: 60 })).toBe(false);
    expect(crossesMidnight({ startMin: 1380, durationMin: 61 })).toBe(true);
  });
});

describe('splitAcrossMidnight', () => {
  it('laisse un bloc ordinaire intact', () => {
    expect(splitAcrossMidnight({ startMin: 420, durationMin: 60 })).toEqual([
      { dayOffset: 0, startMin: 420, endMin: 480 },
    ]);
  });

  it('coupe un bloc qui passe minuit en deux tranches', () => {
    expect(splitAcrossMidnight({ startMin: 1380, durationMin: 90 })).toEqual([
      { dayOffset: 0, startMin: 1380, endMin: 1440 },
      { dayOffset: 1, startMin: 0, endMin: 30 },
    ]);
  });

  it('gère une durée minimale qui franchit minuit', () => {
    expect(splitAcrossMidnight({ startMin: 1439, durationMin: 1 })).toEqual([
      { dayOffset: 0, startMin: 1439, endMin: 1440 },
      { dayOffset: 1, startMin: 0, endMin: 4 },
    ]);
  });
});
