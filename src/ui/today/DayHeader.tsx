import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { addDaysKey, fromDateKey, toDateKey, type DateKey } from '../../domain/time/dateKey';

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export interface DayHeaderProps {
  date: DateKey;
  nowMin: number;
  dayStartMin: number;
  dayEndMin: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function titleFor(date: DateKey, today: DateKey): string {
  if (date === today) return 'Aujourd’hui';
  if (date === addDaysKey(today, 1)) return 'Demain';
  if (date === addDaysKey(today, -1)) return 'Hier';
  return format(fromDateKey(date), 'EEE d MMM', { locale: fr });
}

export function DayHeader({
  date,
  nowMin,
  dayStartMin,
  dayEndMin,
  onPrev,
  onNext,
  onToday,
}: DayHeaderProps): React.JSX.Element {
  const today = toDateKey(new Date());
  const isToday = date === today;
  const span = Math.max(1, dayEndMin - dayStartMin);
  const rawProgress = (nowMin - dayStartMin) / span;
  const progress = isToday ? Math.min(1, Math.max(0, rawProgress)) : date < today ? 1 : 0;
  const offset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <header className="today-header">
      <div className="today-nav">
        <button type="button" onClick={onPrev} aria-label="Jour précédent">
          ‹
        </button>
        <h1 className="today-nav-title">{titleFor(date, today)}</h1>
        {date !== today ? (
          <button type="button" onClick={onToday}>
            Aujourd’hui
          </button>
        ) : null}
        <button type="button" onClick={onNext} aria-label="Jour suivant">
          ›
        </button>
        <svg
          className="today-ring"
          width="40"
          height="40"
          viewBox="0 0 40 40"
          role="img"
          aria-label={`Progression de la journée : ${Math.round(progress * 100)} %`}
        >
          <circle
            className="today-ring-track"
            cx="20"
            cy="20"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="4"
          />
          <circle
            className="today-ring-progress"
            cx="20"
            cy="20"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="4"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
          <text className="today-ring-label" x="20" y="23">
            {Math.round(progress * 100)}
          </text>
        </svg>
      </div>
    </header>
  );
}
