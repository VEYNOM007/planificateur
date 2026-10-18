import { describe, expect, it } from 'vitest';
import type { Override } from '../models';
import { displayStatus } from './status';

function override(action: Override['action']): Override {
  return {
    id: 'o1',
    blockId: 'b1',
    date: '2026-10-16' as Override['date'],
    action,
    changes: null,
    doneAt: null,
    createdAt: '2026-10-16T08:00:00.000Z',
    updatedAt: '2026-10-16T08:00:00.000Z',
    deletedAt: null,
  };
}

describe('displayStatus', () => {
  it('affiche « à faire » pour un bloc futur', () => {
    expect(
      displayStatus({
        status: 'todo',
        override: null,
        startMin: 420,
        durationMin: 60,
        nowMin: 300,
        isToday: true,
      }),
    ).toBe('todo');
  });

  it('affiche « en cours » pendant la plage du bloc aujourd’hui', () => {
    expect(
      displayStatus({
        status: 'todo',
        override: null,
        startMin: 420,
        durationMin: 60,
        nowMin: 450,
        isToday: true,
      }),
    ).toBe('doing');
  });

  it('n’affiche jamais « en cours » un autre jour', () => {
    expect(
      displayStatus({
        status: 'todo',
        override: null,
        startMin: 420,
        durationMin: 60,
        nowMin: 450,
        isToday: false,
      }),
    ).toBe('todo');
  });

  it('affiche la fin de plage comme « à faire » (borne exclue)', () => {
    expect(
      displayStatus({
        status: 'todo',
        override: null,
        startMin: 420,
        durationMin: 60,
        nowMin: 480,
        isToday: true,
      }),
    ).toBe('todo');
  });

  it('respecte le statut enregistré « fait » ou « ignoré »', () => {
    const base = { override: null, startMin: 420, durationMin: 60, nowMin: 450, isToday: true };
    expect(displayStatus({ ...base, status: 'done' })).toBe('done');
    expect(displayStatus({ ...base, status: 'skipped' })).toBe('skipped');
  });

  it('donne la priorité à l’exception de l’occurrence', () => {
    const base = {
      status: 'todo' as const,
      startMin: 420,
      durationMin: 60,
      nowMin: 450,
      isToday: true,
    };
    expect(displayStatus({ ...base, override: override('done') })).toBe('done');
    expect(displayStatus({ ...base, override: override('skipped') })).toBe('skipped');
    expect(displayStatus({ ...base, override: override('deleted') })).toBe('skipped');
    expect(displayStatus({ ...base, override: override('modified') })).toBe('doing');
  });
});
