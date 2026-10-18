import { useMemo, useRef } from 'react';
import type { DayBlock } from '../../data/repositories/dayView';
import type { Category } from '../../domain/models';
import type { DateKey } from '../../domain/time/dateKey';
import { assignColumns } from '../../domain/layout/columnLayout';
import { formatTime, snapMinutes } from '../../domain/time/minutes';
import {
  minToPx,
  nowOffsetPx,
  timelineHeightPx,
  type TimelineConfig,
} from '../gestures/pointerMath';
import { TimelineBlock } from './TimelineBlock';

export interface TimelineProps {
  blocks: DayBlock[];
  categories: Category[];
  nowMin: number;
  isToday: boolean;
  cfg: TimelineConfig;
  date: DateKey;
  onOpen: (block: DayBlock) => void;
  onEmptyTap: (minutes: number) => void;
}

export function Timeline({
  blocks,
  categories,
  nowMin,
  isToday,
  cfg,
  date,
  onOpen,
  onEmptyTap,
}: TimelineProps): React.JSX.Element {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scrolledFor = useRef<string | null>(null);

  // Défilement automatique à l'ouverture de la journée, une fois par date.
  const attachNow = (node: HTMLDivElement | null): void => {
    if (node === null || scrolledFor.current === date) return;
    scrolledFor.current = date;
    node.scrollIntoView({ block: 'center', behavior: 'auto' });
  };

  const timed = useMemo(() => blocks.filter((b) => !b.block.allDay), [blocks]);

  const columns = useMemo(
    () =>
      assignColumns(
        timed.map((b) => ({
          id: b.block.id,
          startMin: Math.max(b.startMin, cfg.dayStartMin),
          endMin: Math.min(Math.max(b.endMin, b.startMin + 5), cfg.dayEndMin),
        })),
      ),
    [timed, cfg.dayStartMin, cfg.dayEndMin],
  );

  const hours: number[] = [];
  for (
    let minutes = Math.ceil(cfg.dayStartMin / 60) * 60;
    minutes <= cfg.dayEndMin;
    minutes += 60
  ) {
    hours.push(minutes);
  }

  const showNow = isToday && nowMin >= cfg.dayStartMin && nowMin <= cfg.dayEndMin;

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.target !== canvasRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = snapMinutes(
      cfg.dayStartMin + (event.clientY - rect.top) / cfg.pxPerMin,
      cfg.snapMin,
    );
    onEmptyTap(minutes);
  };

  return (
    <div className="timeline-scroll">
      <div
        ref={canvasRef}
        className="timeline-canvas"
        style={{ height: timelineHeightPx(cfg) }}
        onClick={handleCanvasClick}
      >
        {hours.map((minutes) => (
          <div
            key={minutes}
            className="timeline-hour"
            style={{ top: minToPx(minutes - cfg.dayStartMin, cfg.pxPerMin) }}
          >
            <span className="timeline-hour-label">{formatTime(minutes)}</span>
          </div>
        ))}

        {timed.map((block) => {
          const assignment = columns.find((c) => c.id === block.block.id);
          const category = categories.find((c) => c.id === block.block.categoryId) ?? null;
          return (
            <TimelineBlock
              key={`${block.block.id}|${block.date}|${block.startMin}`}
              block={block}
              category={category}
              column={assignment?.column ?? 0}
              columnCount={assignment?.columnCount ?? 1}
              cfg={cfg}
              onOpen={onOpen}
            />
          );
        })}

        {showNow ? (
          <div
            key={date}
            ref={attachNow}
            className="nowline"
            style={{ top: nowOffsetPx(nowMin, cfg) }}
            aria-hidden="true"
          >
            <span className="nowline-label">{formatTime(nowMin)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
