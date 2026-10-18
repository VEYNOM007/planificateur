import { MIN_BLOCK_VISUAL_MIN } from '../../domain/layout/columnLayout';

export interface TimelineConfig {
  pxPerMin: number;
  dayStartMin: number;
  dayEndMin: number;
  snapMin: number;
}

export const DEFAULT_PX_PER_MIN = 1.8;
export const SWIPE_THRESHOLD_PX = 48;
export const SWIPE_DOMINANCE_RATIO = 1.5;

export function minToPx(min: number, pxPerMin: number): number {
  return min * pxPerMin;
}

export function pxToMin(px: number, pxPerMin: number): number {
  return px / pxPerMin;
}

export function snapMinutes(min: number, snapMin: number): number {
  if (snapMin <= 0) return Math.round(min);
  return Math.round(min / snapMin) * snapMin;
}

export function clampMinutes(min: number, cfg: TimelineConfig): number {
  return Math.min(Math.max(min, cfg.dayStartMin), cfg.dayEndMin);
}

export function snapAndClamp(min: number, cfg: TimelineConfig): number {
  return clampMinutes(snapMinutes(min, cfg.snapMin), cfg);
}

export function deltaPxToMinutes(deltaPx: number, cfg: TimelineConfig): number {
  return snapMinutes(pxToMin(deltaPx, cfg.pxPerMin), cfg.snapMin);
}

export function visualEndMin(startMin: number, endMin: number): number {
  return Math.max(endMin, startMin + MIN_BLOCK_VISUAL_MIN);
}

export function timelineHeightPx(cfg: TimelineConfig): number {
  return minToPx(cfg.dayEndMin - cfg.dayStartMin, cfg.pxPerMin);
}

export function nowOffsetPx(nowMin: number, cfg: TimelineConfig): number {
  return minToPx(nowMin - cfg.dayStartMin, cfg.pxPerMin);
}

export function visualHeightPx(startMin: number, endMin: number, cfg: TimelineConfig): number {
  return minToPx(visualEndMin(startMin, endMin) - startMin, cfg.pxPerMin);
}

export function isHorizontalSwipe(deltaX: number, deltaY: number): boolean {
  const ax = Math.abs(deltaX);
  const ay = Math.abs(deltaY);
  if (Math.max(ax, ay) < SWIPE_THRESHOLD_PX) return false;
  return ax >= ay * SWIPE_DOMINANCE_RATIO;
}
