/**
 * Tests du store Zustand de la timeline : création, édition, suppression avec
 * annulation de 6 s et rechargement de la journée (revision).
 * Une vraie IndexedDB en mémoire sert de couche data (fake-indexeddb).
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type PlanificateurDb } from '../data/db';
import { initRepositories, type Repositories } from '../data/repositories';
import { addDaysKey, asDateKey } from '../domain/time/dateKey';
import { createTimelineStore, DELETE_UNDO_MS, type TimelineState } from './timeline';

const DATE = asDateKey('2026-10-18');

let db: PlanificateurDb;
let repos: Repositories;
let state: () => TimelineState;
let counter = 0;

beforeEach(async () => {
  counter += 1;
  db = createDb(`test-timeline-${counter}`);
  repos = await initRepositories(db);
  const useStore = createTimelineStore();
  state = () => useStore.getState();
  state().setRepos(repos);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

/** Laisse tourner Dexie (vrai setImmediate) jusqu'à ce que la condition soit vraie. */
async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !check(); i += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

describe('openCreate', () => {
  it('prépare un brouillon de 60 min sans catégorie', () => {
    state().setDate(DATE);
    state().openCreate(7 * 60);

    const draft = state().draft;
    expect(state().sheet).toBe('create');
    expect(draft).not.toBeNull();
    expect(draft?.blockId).toBeNull();
    expect(draft?.occurrenceDate).toBe(DATE);
    expect(draft?.title).toBe('');
    expect(draft?.startMin).toBe(420);
    expect(draft?.durationMin).toBe(60);
    expect(draft?.allDay).toBe(false);
    expect(draft?.categoryId).toBeNull();
  });

  it('choisit automatiquement le prochain créneau accroché', () => {
    state().setNowMin(9 * 60);
    state().setSnapMin(5);
    state().openCreate(null);
    expect(state().draft?.startMin).toBe(9 * 60 + 5);
  });
});

describe('saveDraft', () => {
  it('refuse un titre vide et conserve la feuille ouverte', async () => {
    state().setDate(DATE);
    state().openCreate(600);
    state().patchDraft({ title: '   ' });

    const ok = await state().saveDraft();

    expect(ok).toBe(false);
    expect(state().sheet).toBe('create');
    expect(state().draftError).toBe('Le titre est requis.');
  });

  it('crée le bloc, ferme la feuille et incrémente la révision', async () => {
    state().setDate(DATE);
    state().openCreate(600);
    state().patchDraft({ title: 'Sport', durationMin: 60 });

    const ok = await state().saveDraft();

    expect(ok).toBe(true);
    expect(state().sheet).toBe('closed');
    expect(state().draft).toBeNull();
    expect(state().revision).toBe(1);

    const day = await repos.dayView.getDay(DATE);
    expect(day).toHaveLength(1);
    expect(day[0]?.title).toBe('Sport');
    expect(day[0]?.startMin).toBe(600);
  });

  it('met à jour un bloc existant via openEdit', async () => {
    const created = await repos.blocks.create({
      title: 'Lecture',
      date: DATE,
      startMin: 480,
      durationMin: 30,
    });
    state().setDate(DATE);
    const dayBefore = await repos.dayView.getDay(DATE);
    const target = dayBefore.find((b) => b.block.id === created.id);
    expect(target).toBeDefined();
    state().openEdit(target!);

    expect(state().draft?.blockId).toBe(created.id);
    expect(state().draft?.durationMin).toBe(30);

    state().patchDraft({ title: 'Lecture longue', durationMin: 45 });
    const ok = await state().saveDraft();

    expect(ok).toBe(true);
    const day = await repos.dayView.getDay(DATE);
    expect(day[0]?.title).toBe('Lecture longue');
    expect(day[0]!.endMin - day[0]!.startMin).toBe(45);
  });
});

describe('deleteBlock / undoDelete', () => {
  it('annule la suppression avant l’échéance de 6 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const created = await repos.blocks.create({
      title: 'Courses',
      date: DATE,
      startMin: 600,
      durationMin: 30,
    });
    state().setDate(DATE);

    await state().deleteBlock(created.id, DATE);
    expect(state().pendingDelete?.id).toBe(created.id);

    state().undoDelete();
    expect(state().pendingDelete).toBeNull();

    await vi.advanceTimersByTimeAsync(DELETE_UNDO_MS + 1000);
    const day = await repos.dayView.getDay(DATE);
    expect(day).toHaveLength(1);
  });

  it('finalise la suppression après 6 s et recharge la journée', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const created = await repos.blocks.create({
      title: 'Courses',
      date: DATE,
      startMin: 600,
      durationMin: 30,
    });
    state().setDate(DATE);

    await state().deleteBlock(created.id, DATE);
    expect(state().revision).toBe(0);

    await vi.advanceTimersByTimeAsync(DELETE_UNDO_MS + 1000);
    await waitFor(() => state().revision === 1);

    expect(state().pendingDelete).toBeNull();
    expect(state().revision).toBe(1);
    const day = await repos.dayView.getDay(DATE);
    expect(day).toHaveLength(0);
  });

  it('finalise immédiatement la suppression précédente si une autre survient', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const first = await repos.blocks.create({
      title: 'A',
      date: DATE,
      startMin: 600,
      durationMin: 30,
    });
    const second = await repos.blocks.create({
      title: 'B',
      date: DATE,
      startMin: 700,
      durationMin: 30,
    });
    state().setDate(DATE);

    await state().deleteBlock(first.id, DATE);
    await state().deleteBlock(second.id, DATE);

    const day = await repos.dayView.getDay(DATE);
    expect(day.map((b) => b.title)).toEqual(['B']);

    await vi.advanceTimersByTimeAsync(DELETE_UNDO_MS + 1000);
    await waitFor(() => state().revision === 1);
    const after = await repos.dayView.getDay(DATE);
    expect(after).toHaveLength(0);
  });
});

describe('navigation', () => {
  it('shiftDate avance et recule d’un jour', () => {
    state().setDate(DATE);
    state().shiftDate(1);
    expect(state().date).toBe(addDaysKey(DATE, 1));
    state().shiftDate(-2);
    expect(state().date).toBe(addDaysKey(DATE, -1));
  });
});
