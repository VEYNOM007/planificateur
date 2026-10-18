import type { DayBlock } from '../../data/repositories/dayView';
import type { Category, BlockDisplayStatus } from '../../domain/models';
import { formatTime, MINUTES_PER_DAY } from '../../domain/time/minutes';
import { minToPx, visualEndMin, type TimelineConfig } from '../gestures/pointerMath';

export interface TimelineBlockProps {
  block: DayBlock;
  category: Category | null;
  column: number;
  columnCount: number;
  cfg: TimelineConfig;
  onOpen: (block: DayBlock) => void;
}

const STATUS_CLASS: Record<BlockDisplayStatus, string> = {
  todo: '',
  doing: ' tblock-doing',
  done: ' tblock-done',
  skipped: ' tblock-skipped',
};

export function TimelineBlock({
  block,
  category,
  column,
  columnCount,
  cfg,
  onOpen,
}: TimelineBlockProps): React.JSX.Element {
  const start = Math.max(block.startMin, cfg.dayStartMin);
  const end = Math.min(block.endMin, cfg.dayEndMin);
  const top = minToPx(start - cfg.dayStartMin, cfg.pxPerMin);
  const wantedHeight = minToPx(visualEndMin(start, end) - start, cfg.pxPerMin);
  const maxHeight = minToPx(cfg.dayEndMin - start, cfg.pxPerMin);
  const height = Math.max(28, Math.min(wantedHeight, maxHeight));
  const width = 100 / columnCount;

  const endLabel = formatTime(block.endMin % MINUTES_PER_DAY);
  const crosses = block.continuesNextDay || block.endMin > MINUTES_PER_DAY;

  return (
    <button
      type="button"
      className={`tblock${STATUS_CLASS[block.status]}${columnCount > 1 ? ' tblock-overlap' : ''}`}
      style={
        {
          top,
          height,
          left: `calc(${(column / columnCount) * 100}% + 3px)`,
          width: `calc(${width}% - 6px)`,
          '--block-color': category?.color,
        } as React.CSSProperties
      }
      onClick={() => onOpen(block)}
      title={block.title}
    >
      <span className="tblock-title">{block.title}</span>
      <span className="tblock-time">
        {formatTime(block.startMin)} – {endLabel}
        {crosses ? ' (+1 j)' : ''}
      </span>
    </button>
  );
}
