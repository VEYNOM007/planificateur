/**
 * Placement en colonnes des blocs qui se chevauchent visuellement.
 * La fin visuelle (fin réelle ou début + hauteur minimale) est utilisée pour
 * les collisions afin que deux blocs courts consécutifs soient bien séparés
 * en colonnes s'ils se recouvrent à l'écran.
 */
export interface Interval {
  id: string;
  startMin: number;
  endMin: number;
}

export interface ColumnAssignment {
  id: string;
  column: number;
  columnCount: number;
}

export const MIN_BLOCK_VISUAL_MIN = 28;

function visualEnd(interval: Interval): number {
  return Math.max(interval.endMin, interval.startMin + MIN_BLOCK_VISUAL_MIN);
}

function intervalsOverlap(a: Interval, b: Interval): boolean {
  return visualEnd(a) > b.startMin && visualEnd(b) > a.startMin;
}

interface Event {
  time: number;
  type: 'start' | 'end';
  index: number;
}

export function assignColumns(intervals: readonly Interval[]): ColumnAssignment[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if (a.endMin !== b.endMin) return a.endMin - b.endMin;
    return a.id.localeCompare(b.id);
  });

  const events: Event[] = sorted.flatMap((interval, index) => [
    { time: interval.startMin, type: 'start' as const, index },
    { time: visualEnd(interval), type: 'end' as const, index },
  ]);
  events.sort((x, y) => {
    if (x.time !== y.time) return x.time - y.time;
    if (x.type !== y.type) return x.type === 'end' ? -1 : 1;
    return x.index - y.index;
  });

  const columnBySortedIndex = new Map<number, number>();
  const active = new Set<number>();

  for (const event of events) {
    if (event.type === 'end') {
      active.delete(event.index);
    } else {
      let column = 0;
      while ([...active].some((i) => columnBySortedIndex.get(i) === column)) {
        column += 1;
      }
      columnBySortedIndex.set(event.index, column);
      active.add(event.index);
    }
  }

  const parent = sorted.map((_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r]!;
    let c = x;
    while (parent[c] !== c) {
      const next = parent[c]!;
      parent[c] = r;
      c = next;
    }
    return r;
  };
  const union = (x: number, y: number): void => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent[ry] = rx;
  };
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (intervalsOverlap(sorted[i]!, sorted[j]!)) union(i, j);
    }
  }

  const columnCountByRoot = new Map<number, number>();
  for (let i = 0; i < sorted.length; i += 1) {
    const root = find(i);
    const count = (columnBySortedIndex.get(i) ?? 0) + 1;
    columnCountByRoot.set(root, Math.max(columnCountByRoot.get(root) ?? 1, count));
  }

  const result: ColumnAssignment[] = sorted.map((interval, index) => ({
    id: interval.id,
    column: columnBySortedIndex.get(index) ?? 0,
    columnCount: Math.max(1, columnCountByRoot.get(find(index)) ?? 1),
  }));

  const byId = new Map(result.map((r) => [r.id, r]));
  return intervals.map(
    (interval) => byId.get(interval.id) ?? { id: interval.id, column: 0, columnCount: 1 },
  );
}
