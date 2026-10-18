/**
 * État global de l'écran Timeline : date affichée, feuille de création et
 * d'édition, suppression avec annulation de 6 s, heure courante.
 * Les données sont lues/écrites via `Repositories` (couche data, jamais Dexie
 * en direct).
 */
import { create } from 'zustand';
import type { UseBoundStore, StoreApi } from 'zustand';
import type { Repositories } from '../data/repositories';
import type { DayBlock } from '../data/repositories/dayView';
import { addDaysKey, toDateKey, type DateKey } from '../domain/time/dateKey';
import { snapMinutes } from '../domain/time/minutes';

export const DELETE_UNDO_MS = 6000;

export interface BlockDraft {
  /** null = création. */
  blockId: string | null;
  /** Date de l'occurrence affichée (séries récurrentes). */
  occurrenceDate: DateKey;
  title: string;
  notes: string;
  categoryId: string | null;
  startMin: number;
  durationMin: number;
  allDay: boolean;
  /** Vrai si le bloc appartient à une série récurrente. */
  isRecurring: boolean;
}

export type SheetMode = 'closed' | 'create' | 'edit';

interface PendingDelete {
  id: string;
  occurrenceDate: DateKey;
  timer: ReturnType<typeof setTimeout>;
}

export interface TimelineState {
  repos: Repositories | null;
  date: DateKey;
  nowMin: number;
  snapMin: number;
  sheet: SheetMode;
  draft: BlockDraft | null;
  draftError: string | null;
  pendingDelete: { id: string; occurrenceDate: DateKey } | null;
  /** Incrémenté à chaque écriture pour recharger la journée affichée. */
  revision: number;

  setRepos: (repos: Repositories) => void;
  setDate: (date: DateKey) => void;
  shiftDate: (deltaDays: number) => void;
  setNowMin: (nowMin: number) => void;
  setSnapMin: (snapMin: number) => void;
  /** startMin null = choisir automatiquement (prochain créneau). */
  openCreate: (startMin: number | null) => void;
  openEdit: (dayBlock: DayBlock) => void;
  closeSheet: () => void;
  patchDraft: (patch: Partial<BlockDraft>) => void;
  setDraftError: (message: string | null) => void;
  saveDraft: () => Promise<boolean>;
  deleteBlock: (id: string, occurrenceDate: DateKey) => Promise<void>;
  undoDelete: () => void;
}

async function finalizeDelete(
  repos: Repositories,
  id: string,
  occurrenceDate: DateKey,
): Promise<void> {
  const block = await repos.blocks.get(id);
  if (block === null) return;
  if (block.recurrence === null) {
    await repos.blocks.softDelete(id);
  } else {
    await repos.blocks.setOverride(id, occurrenceDate, 'deleted');
  }
}

export function createTimelineStore(): UseBoundStore<StoreApi<TimelineState>> {
  let pending: PendingDelete | null = null;

  return create<TimelineState>()((set, get) => ({
    repos: null,
    date: toDateKey(new Date()),
    nowMin: 0,
    snapMin: 5,
    sheet: 'closed',
    draft: null,
    draftError: null,
    pendingDelete: null,
    revision: 0,

    setRepos(repos) {
      set({ repos });
    },

    setDate(date) {
      if (get().date === date) return;
      set({ date });
    },

    shiftDate(deltaDays) {
      get().setDate(addDaysKey(get().date, deltaDays));
    },

    setNowMin(nowMin) {
      set({ nowMin });
    },

    setSnapMin(snapMin) {
      set({ snapMin });
    },

    openCreate(startMin) {
      const { date, nowMin, snapMin } = get();
      const auto = startMin ?? snapMinutes(nowMin + 5, snapMin);
      set({
        sheet: 'create',
        draftError: null,
        draft: {
          blockId: null,
          occurrenceDate: date,
          title: '',
          notes: '',
          categoryId: null,
          startMin: auto,
          durationMin: 60,
          allDay: false,
          isRecurring: false,
        },
      });
    },

    openEdit(dayBlock) {
      set({
        sheet: 'edit',
        draftError: null,
        draft: {
          blockId: dayBlock.block.id,
          occurrenceDate: dayBlock.date,
          title: dayBlock.title,
          notes: dayBlock.notes,
          categoryId: dayBlock.block.categoryId,
          startMin: dayBlock.startMin,
          durationMin: Math.max(5, dayBlock.endMin - dayBlock.startMin),
          allDay: dayBlock.block.allDay,
          isRecurring: dayBlock.block.recurrence !== null,
        },
      });
    },

    closeSheet() {
      set({ sheet: 'closed', draft: null, draftError: null });
    },

    patchDraft(patch) {
      const draft = get().draft;
      if (draft === null) return;
      set({ draft: { ...draft, ...patch }, draftError: null });
    },

    setDraftError(message) {
      set({ draftError: message });
    },

    async saveDraft() {
      const { repos, draft, date } = get();
      if (repos === null || draft === null) return false;
      const title = draft.title.trim();
      if (title === '') {
        set({ draftError: 'Le titre est requis.' });
        return false;
      }

      try {
        const patch = {
          title,
          notes: draft.notes.trim(),
          categoryId: draft.categoryId,
          startMin: draft.startMin,
          durationMin: draft.durationMin,
          allDay: draft.allDay,
        };
        if (draft.blockId === null) {
          await repos.blocks.create({ ...patch, date });
        } else {
          const existing = await repos.blocks.get(draft.blockId);
          if (existing === null) throw new Error('Bloc introuvable');
          if (existing.recurrence === null) {
            await repos.blocks.update(existing.id, patch);
          } else {
            await repos.blocks.splitSeries(existing.id, draft.occurrenceDate, patch);
          }
        }
        set((state) => ({
          sheet: 'closed',
          draft: null,
          draftError: null,
          revision: state.revision + 1,
        }));
        return true;
      } catch (error) {
        set({
          draftError: error instanceof Error ? error.message : 'Enregistrement impossible.',
        });
        return false;
      }
    },

    async deleteBlock(id, occurrenceDate) {
      const { repos } = get();
      if (repos === null) return;

      if (pending !== null) {
        clearTimeout(pending.timer);
        const previous = pending;
        pending = null;
        await finalizeDelete(repos, previous.id, previous.occurrenceDate);
      }

      const timer = setTimeout(() => {
        if (pending === null) return;
        const target = pending;
        pending = null;
        set({ pendingDelete: null });
        void finalizeDelete(repos, target.id, target.occurrenceDate).then(() => {
          set((state) => ({ revision: state.revision + 1 }));
        });
      }, DELETE_UNDO_MS);
      pending = { id, occurrenceDate, timer };
      set({ pendingDelete: { id, occurrenceDate }, sheet: 'closed', draft: null });
    },

    undoDelete: () => {
      if (pending === null) return;
      clearTimeout(pending.timer);
      pending = null;
      set({ pendingDelete: null });
    },
  }));
}

export const useTimelineStore = createTimelineStore();
/** Actions seules : lecture d'état hors React via `useTimelineStore.getState()`. */
export const timelineStore: Omit<
  TimelineState,
  | 'repos'
  | 'date'
  | 'nowMin'
  | 'snapMin'
  | 'sheet'
  | 'draft'
  | 'draftError'
  | 'pendingDelete'
  | 'revision'
> = useTimelineStore.getState();
