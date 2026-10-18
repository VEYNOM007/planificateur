import { describe, expect, it } from 'vitest';
import { assignColumns, type Interval } from './columnLayout';

function iv(id: string, start: number, end: number): Interval {
  return { id, startMin: start, endMin: end };
}

describe('assignColumns', () => {
  it('aucun chevauchement → 1 colonne', () => {
    const blocks = [iv('a', 420, 480), iv('b', 540, 600)];
    const result = assignColumns(blocks);
    expect(result).toHaveLength(2);
    expect(result[0]?.column).toBe(0);
    expect(result[0]?.columnCount).toBe(1);
    expect(result[1]?.column).toBe(0);
    expect(result[1]?.columnCount).toBe(1);
  });

  it('deux blocs se chevauchent → 2 colonnes', () => {
    const blocks = [iv('a', 420, 480), iv('b', 450, 510)];
    const result = assignColumns(blocks);
    expect(result[0]?.column).toBe(0);
    expect(result[1]?.column).toBe(1);
    expect(result[0]?.columnCount).toBe(2);
    expect(result[1]?.columnCount).toBe(2);
  });

  it('blocs courts non chevauchants restent en 1 colonne', () => {
    const blocks = [iv('a', 420, 435), iv('b', 470, 485)];
    const result = assignColumns(blocks);
    expect(result.every((x) => x.columnCount === 1 && x.column === 0)).toBe(true);
  });

  it('blocs courts qui se chevauchent → 2 colonnes', () => {
    const blocks = [iv('a', 420, 435), iv('b', 430, 445)];
    const result = assignColumns(blocks);
    expect(result[0]?.columnCount).toBe(2);
    expect(result[1]?.columnCount).toBe(2);
  });

  it('chaîne A∩B, B∩C, A∓C → 2 colonnes (A et C partagent)', () => {
    const blocks = [iv('a', 420, 540), iv('b', 480, 600), iv('c', 540, 660)];
    const result = assignColumns(blocks);
    expect(result.find((r) => r.id === 'a')?.column).toBe(0);
    expect(result.find((r) => r.id === 'b')?.column).toBe(1);
    expect(result.find((r) => r.id === 'c')?.column).toBe(0);
    const cc = result[0]?.columnCount;
    expect(result.every((r) => r.columnCount === cc)).toBe(true);
    expect(cc).toBe(2);
  });

  it('bloc inclus dans un autre → partage les colonnes', () => {
    const blocks = [iv('a', 420, 600), iv('b', 480, 540)];
    const result = assignColumns(blocks);
    expect(result.find((r) => r.id === 'a')?.column).toBe(0);
    expect(result.find((r) => r.id === 'b')?.column).toBe(1);
    expect(result[0]?.columnCount).toBe(2);
    expect(result[1]?.columnCount).toBe(2);
  });

  it('fin == début (se touchent) → même colonne', () => {
    const blocks = [iv('a', 420, 480), iv('b', 480, 540)];
    const result = assignColumns(blocks);
    expect(result[0]?.column).toBe(0);
    expect(result[1]?.column).toBe(0);
    expect(result[0]?.columnCount).toBe(1);
    expect(result[1]?.columnCount).toBe(1);
  });

  it('intervalles identiques → placés dans des colonnes différentes', () => {
    const blocks = [iv('a', 420, 480), iv('b', 420, 480)];
    const result = assignColumns(blocks);
    expect(result[0]?.column).toBe(0);
    expect(result[1]?.column).toBe(1);
    expect(result[0]?.columnCount).toBe(2);
    expect(result[1]?.columnCount).toBe(2);
  });

  it('trois qui se chevauchent tous → 3 colonnes', () => {
    const blocks = [iv('a', 420, 560), iv('b', 480, 600), iv('c', 540, 660)];
    const result = assignColumns(blocks);
    expect(result.find((r) => r.id === 'a')?.column).toBe(0);
    expect(result.find((r) => r.id === 'b')?.column).toBe(1);
    expect(result.find((r) => r.id === 'c')?.column).toBe(2);
    expect(result.every((r) => r.columnCount === 3)).toBe(true);
  });

  it('blocs courts consécutifs dont la fin visuelle déborde → 2 colonnes', () => {
    const blocks = [iv('a', 420, 435), iv('b', 435, 450)];
    const result = assignColumns(blocks);
    expect(result[0]?.column).toBe(0);
    expect(result[1]?.column).toBe(1);
    expect(result[0]?.columnCount).toBe(2);
    expect(result[1]?.columnCount).toBe(2);
  });

  it('liste vide → vide', () => {
    expect(assignColumns([])).toEqual([]);
  });
});
