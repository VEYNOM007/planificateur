import { formatCountdown, useCountdown } from './useCountdown';
import { formatTime } from '../../domain/time/minutes';
import { fromDateKey, toDateKey, type DateKey } from '../../domain/time/dateKey';
import type { DayBlock } from '../../data/repositories/dayView';
import type { Category } from '../../domain/models';

export interface NextBlockCardProps {
  blocks: DayBlock[];
  date: DateKey;
  nowMin: number;
  categories: Category[];
  onOpen: (block: DayBlock) => void;
}

export function NextBlockCard({
  blocks,
  date,
  nowMin,
  categories,
  onOpen,
}: NextBlockCardProps): React.JSX.Element | null {
  const today = toDateKey(new Date());
  const isToday = date === today;
  const candidates = blocks
    .filter(
      (b) => !b.block.allDay && b.status !== 'done' && b.status !== 'skipped' && b.endMin > nowMin,
    )
    .sort((a, b) => {
      const aDoing = a.status === 'doing' ? 0 : 1;
      const bDoing = b.status === 'doing' ? 0 : 1;
      return aDoing - bDoing || a.startMin - b.startMin;
    });
  const next = candidates[0] ?? null;
  const targetMs =
    next !== null && isToday ? fromDateKey(date).getTime() + next.startMin * 60_000 : null;
  const remaining = useCountdown(targetMs);
  if (next === null) return null;

  const category = categories.find((c) => c.id === next.block.categoryId) ?? null;

  const meta =
    targetMs === null
      ? formatTime(next.startMin)
      : next.status === 'doing'
        ? 'En cours'
        : `à ${formatTime(next.startMin)}`;

  return (
    <button type="button" className="next-card" onClick={() => onOpen(next)}>
      <span
        className="next-card-dot"
        style={{ background: category?.color ?? 'var(--color-text-muted)' }}
      />
      <span className="next-card-body">
        <span className="next-card-title">{next.title}</span>
        <span className="next-card-meta">{meta}</span>
      </span>
      {targetMs !== null && next.status !== 'doing' ? (
        <span className="next-card-countdown">{formatCountdown(remaining)}</span>
      ) : null}
    </button>
  );
}
