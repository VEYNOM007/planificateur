import { useEffect, useState } from 'react';
import type { Category, Settings } from '../../domain/models';
import type { DayBlock } from '../../data/repositories/dayView';
import { toDateKey } from '../../domain/time/dateKey';
import { DEFAULT_PX_PER_MIN, type TimelineConfig } from '../gestures/pointerMath';
import { useTimelineStore } from '../../state/timeline';
import { AllDayBand } from './AllDayBand';
import { DayHeader } from './DayHeader';
import { NextBlockCard } from './NextBlockCard';
import { Timeline } from './Timeline';
import { UndoBar } from './UndoBar';
import { useNowClock } from './useNowClock';
import { BlockSheet } from '../block-sheet/BlockSheet';
import '../../styles/today.css';

const FALLBACK: TimelineConfig = {
  pxPerMin: DEFAULT_PX_PER_MIN,
  dayStartMin: 300,
  dayEndMin: 1380,
  snapMin: 5,
};

export function TodayScreen(): React.JSX.Element {
  useNowClock();

  const repos = useTimelineStore((s) => s.repos);
  const date = useTimelineStore((s) => s.date);
  const nowMin = useTimelineStore((s) => s.nowMin);
  const revision = useTimelineStore((s) => s.revision);
  const pendingDelete = useTimelineStore((s) => s.pendingDelete);
  const shiftDate = useTimelineStore((s) => s.shiftDate);
  const setDate = useTimelineStore((s) => s.setDate);
  const setSnapMin = useTimelineStore((s) => s.setSnapMin);
  const openCreate = useTimelineStore((s) => s.openCreate);
  const openEdit = useTimelineStore((s) => s.openEdit);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [blocks, setBlocks] = useState<DayBlock[]>([]);

  useEffect(() => {
    if (repos === null) return;
    let cancelled = false;
    void (async () => {
      const [loadedSettings, loadedCategories, loadedBlocks] = await Promise.all([
        repos.settings.get(),
        repos.categories.list(),
        repos.dayView.getDay(date, { nowMin, today: toDateKey(new Date()) }),
      ]);
      if (cancelled) return;
      setSettings(loadedSettings);
      setSnapMin(loadedSettings.snapMin);
      setCategories(loadedCategories);
      setBlocks(loadedBlocks);
    })();
    return () => {
      cancelled = true;
    };
  }, [repos, date, nowMin, revision, setSnapMin]);

  const cfg: TimelineConfig =
    settings === null
      ? FALLBACK
      : {
          pxPerMin: DEFAULT_PX_PER_MIN,
          dayStartMin: settings.dayStartMin,
          dayEndMin: settings.dayEndMin,
          snapMin: settings.snapMin,
        };

  const visibleBlocks =
    pendingDelete === null ? blocks : blocks.filter((b) => b.block.id !== pendingDelete.id);

  return (
    <div className="today">
      <DayHeader
        date={date}
        nowMin={nowMin}
        dayStartMin={cfg.dayStartMin}
        dayEndMin={cfg.dayEndMin}
        onPrev={() => shiftDate(-1)}
        onNext={() => shiftDate(1)}
        onToday={() => setDate(toDateKey(new Date()))}
      />
      <NextBlockCard
        blocks={visibleBlocks}
        date={date}
        nowMin={nowMin}
        categories={categories}
        onOpen={openEdit}
      />
      <AllDayBand blocks={visibleBlocks} categories={categories} onOpen={openEdit} />
      <Timeline
        blocks={visibleBlocks}
        categories={categories}
        nowMin={nowMin}
        isToday={date === toDateKey(new Date())}
        cfg={cfg}
        date={date}
        onOpen={openEdit}
        onEmptyTap={(minutes) => openCreate(minutes)}
      />
      <button
        type="button"
        className="fab"
        aria-label="Nouveau bloc"
        onClick={() => openCreate(null)}
      >
        +
      </button>
      <UndoBar />
      <BlockSheet categories={categories} />
    </div>
  );
}
