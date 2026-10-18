import { describe, expect, it } from 'vitest';
import {
  clampMinutes,
  deltaPxToMinutes,
  isHorizontalSwipe,
  minToPx,
  pxToMin,
  snapMinutes,
  visualEndMin,
  type TimelineConfig,
} from './pointerMath';

const cfg: TimelineConfig = {
  pxPerMin: 1.8,
  dayStartMin: 300,
  dayEndMin: 1380,
  snapMin: 5,
};

describe('pointerMath', () => {
  it('minToPx / pxToMin sont inverse', () => {
    expect(minToPx(60, 1.8)).toBeCloseTo(108);
    expect(pxToMin(108, 1.8)).toBe(60);
  });

  it('snapMinutes arrondit au pas', () => {
    expect(snapMinutes(421, 5)).toBe(420);
    expect(snapMinutes(423, 5)).toBe(425);
    expect(snapMinutes(420, 5)).toBe(420);
    expect(snapMinutes(430, 15)).toBe(435);
  });

  it('clampMinutes borne entre dayStart et dayEnd', () => {
    expect(clampMinutes(100, cfg)).toBe(300);
    expect(clampMinutes(1500, cfg)).toBe(1380);
    expect(clampMinutes(720, cfg)).toBe(720);
  });

  it('deltaPxToMinutes convertit puis accroche', () => {
    expect(deltaPxToMinutes(9, cfg)).toBe(5);
    expect(deltaPxToMinutes(18, cfg)).toBe(10);
    expect(deltaPxToMinutes(-27, cfg)).toBe(-15);
  });

  it('visualEndMin applique la hauteur minimale de 28 min', () => {
    expect(visualEndMin(420, 435)).toBe(448);
    expect(visualEndMin(420, 600)).toBe(600);
  });

  it('isHorizontalSwipe : seuil 48px et delta X dominant', () => {
    expect(isHorizontalSwipe(60, 10)).toBe(true);
    expect(isHorizontalSwipe(10, 60)).toBe(false);
    expect(isHorizontalSwipe(30, 5)).toBe(false);
    expect(isHorizontalSwipe(-60, 8)).toBe(true);
    expect(isHorizontalSwipe(50, 49)).toBe(false);
    expect(isHorizontalSwipe(60, 40)).toBe(true);
  });
});
