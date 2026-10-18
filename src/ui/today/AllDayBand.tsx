import type { DayBlock } from '../../data/repositories/dayView';
import type { Category } from '../../domain/models';

export interface AllDayBandProps {
  blocks: DayBlock[];
  categories: Category[];
  onOpen: (block: DayBlock) => void;
}

export function AllDayBand({
  blocks,
  categories,
  onOpen,
}: AllDayBandProps): React.JSX.Element | null {
  const allDay = blocks.filter((b) => b.block.allDay);
  if (allDay.length === 0) return null;

  return (
    <div className="allday-band">
      {allDay.map((block) => {
        const category = categories.find((c) => c.id === block.block.categoryId) ?? null;
        return (
          <button
            key={`${block.block.id}|${block.date}`}
            type="button"
            className="allday-chip"
            onClick={() => onOpen(block)}
          >
            <span
              className="category-dot"
              style={{ '--chip-color': category?.color } as React.CSSProperties}
            />
            {block.title}
          </button>
        );
      })}
    </div>
  );
}
