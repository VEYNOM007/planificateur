/**
 * Assemblage de la vue d'une journée : occurrences calculées, exceptions
 * appliquées, blocs qui franchissent minuit découpés en deux tranches.
 * L'interface n'appelle jamais Dexie directement.
 */
import type { Block, BlockDisplayStatus, Override } from '../../domain/models';
import { computeOccurrences } from '../../domain/recurrence/occurrences';
import { addDaysKey, type DateKey } from '../../domain/time/dateKey';
import { splitAcrossMidnight } from '../../domain/time/minutes';
import { displayStatus } from '../../domain/day/status';
import { compareAsc } from 'date-fns';
import type { BlockRepository } from './blocks';

/** Un bloc affiché à une date donnée, prêt pour la timeline. */
export interface DayBlock {
  block: Block;
  /** Occurrence affichée (peut différer de block.date pour une récurrence). */
  date: DateKey;
  title: string;
  notes: string;
  startMin: number;
  endMin: number;
  /** Vrai pour la partie d'un bloc qui vient du jour précédent. */
  continuesFromPreviousDay: boolean;
  /** Vrai pour la partie qui se prolonge le lendemain. */
  continuesNextDay: boolean;
  status: BlockDisplayStatus;
  override: Override | null;
}

export interface RangeOptions {
  /** Heure courante (minutes depuis minuit) pour l'état « en cours ». */
  nowMin?: number | null;
  today?: DateKey;
}

export class DayViewRepository {
  constructor(private readonly blocks: BlockRepository) {}

  /** Blocs affichés pour une date, triés : journée entière, puis par heure. */
  async getDay(date: DateKey, options: RangeOptions = {}): Promise<DayBlock[]> {
    return this.getRange(date, date, options);
  }

  /** Blocs affichés pour une plage de dates incluses. */
  async getRange(start: DateKey, end: DateKey, options: RangeOptions = {}): Promise<DayBlock[]> {
    // Marge d'un jour avant : un bloc de la veille peut déborder sur la plage.
    const queryStart = addDaysKey(start, -1);
    const blocks = await this.blocks.listStartingUntil(end);
    const overrides = await this.blocks.listOverridesBetween(queryStart, end);
    const byKey = new Map<string, Override>();
    for (const override of overrides) {
      byKey.set(`${override.blockId}|${override.date}`, override);
    }

    const result: DayBlock[] = [];
    for (const block of blocks) {
      const occurrenceDates = computeOccurrences(
        { date: block.date, recurrence: block.recurrence },
        { start: queryStart, end },
      );
      for (const occurrenceDate of occurrenceDates) {
        const override = byKey.get(`${block.id}|${occurrenceDate}`) ?? null;
        if (override !== null && override.action === 'deleted') continue;

        const startMin = override?.changes?.startMin ?? block.startMin;
        const durationMin = override?.changes?.durationMin ?? block.durationMin;
        const slices = splitAcrossMidnight({ startMin, durationMin });

        for (const slice of slices) {
          const sliceDate = slice.dayOffset === 0 ? occurrenceDate : addDaysKey(occurrenceDate, 1);
          if (compareAsc(sliceDate, start) < 0 || compareAsc(sliceDate, end) > 0) continue;
          result.push({
            block,
            date: sliceDate,
            title: override?.changes?.title ?? block.title,
            notes: override?.changes?.notes ?? block.notes,
            startMin: slice.startMin,
            endMin: slice.endMin,
            continuesFromPreviousDay: slice.dayOffset > 0,
            continuesNextDay: slice.dayOffset === 0 && slices.length > 1,
            status: displayStatus({
              status: block.status,
              override,
              startMin,
              durationMin,
              nowMin: options.nowMin ?? null,
              isToday: options.today !== undefined && sliceDate === options.today,
            }),
            override,
          });
        }
      }
    }

    return result.sort(
      (a, b) =>
        Number(b.block.allDay) - Number(a.block.allDay) ||
        a.startMin - b.startMin ||
        b.endMin - a.endMin ||
        a.title.localeCompare(b.title),
    );
  }
}
