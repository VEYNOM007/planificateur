/**
 * Tests des dépôts sur une vraie IndexedDB en mémoire (fake-indexeddb) :
 * schéma, données par défaut, suppression logique, transactions et migration.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { createDb, SCHEMA_VERSION, SCHEMA_VERSIONS, type PlanificateurDb } from './db';
import { initRepositories, type Repositories } from './repositories';
import { asDateKey } from '../domain/time/dateKey';
import type { Recurrence } from '../domain/recurrence/types';

let db: PlanificateurDb;
let repos: Repositories;
let counter = 0;

beforeEach(async () => {
  counter += 1;
  db = createDb(`test-planificateur-${counter}`);
  repos = await initRepositories(db);
});

afterEach(async () => {
  await db.delete();
});

function rule(partial: Partial<Recurrence>): Recurrence {
  return {
    freq: 'day',
    interval: 1,
    byWeekday: [],
    monthlyMode: 'dayOfMonth',
    nth: 1,
    endType: 'never',
    count: 10,
    until: null,
    ...partial,
  };
}

describe('schéma Dexie', () => {
  it('applique la version courante et crée les six tables', () => {
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSIONS.map((entry) => entry.version)).toEqual([1]);
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      'blocks',
      'categories',
      'overrides',
      'settings',
      'tasks',
      'templates',
    ]);
  });

  it('indexe les blocs par date et par catégorie', () => {
    const stores = SCHEMA_VERSIONS[0]?.stores ?? {};
    expect(stores['blocks']).toContain('date');
    expect(stores['blocks']).toContain('categoryId');
    expect(stores['overrides']).toContain('[blockId+date]');
    expect(stores['tasks']).toContain('done');
    expect(stores['tasks']).toContain('priority');
  });

  it('conserve les données lors d’une migration de version', async () => {
    await repos.categories.create({ name: 'Travail maison', color: '#123456' });
    const before = await db.categories.count();
    db.close();

    // Simulation d'une future version du schéma ajoutant une table.
    const upgraded = new Dexie(db.name);
    upgraded.version(1).stores(SCHEMA_VERSIONS[0]?.stores ?? {});
    upgraded.version(2).stores({
      ...(SCHEMA_VERSIONS[0]?.stores ?? {}),
      notes: 'id, updatedAt',
    });
    await upgraded.open();
    expect(upgraded.verno).toBe(2);
    expect(await upgraded.table('categories').count()).toBe(before);
    upgraded.close();
  });
});

describe('données par défaut', () => {
  it('crée les huit catégories du cahier des charges', async () => {
    const categories = await repos.categories.list();
    expect(categories).toHaveLength(8);
    expect(categories.map((category) => category.name)).toEqual([
      'Travail',
      'Sport et santé',
      'Famille',
      'Admin',
      'Repas',
      'Repos',
      'Déplacement',
      'Loisirs',
    ]);
    expect(categories.map((category) => category.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('ne recrée pas les catégories au deuxième lancement', async () => {
    const first = await repos.categories.list();
    expect(await repos.categories.ensureSeeded()).toHaveLength(8);
    expect((await repos.categories.list()).map((c) => c.id)).toEqual(first.map((c) => c.id));
  });

  it('crée des réglages par défaut : plage 5h–23h, accrochage 5 min, thème auto', async () => {
    const settings = await repos.settings.get();
    expect(settings.dayStartMin).toBe(300);
    expect(settings.dayEndMin).toBe(1380);
    expect(settings.snapMin).toBe(5);
    expect(settings.theme).toBe('auto');
    expect(settings.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('met à jour les réglages en conservant une seule ligne', async () => {
    await repos.settings.update({ theme: 'dark', snapMin: 15 });
    const settings = await repos.settings.get();
    expect(settings.theme).toBe('dark');
    expect(settings.snapMin).toBe(15);
    expect(await db.settings.count()).toBe(1);
  });
});

describe('catégories', () => {
  it('refuse une couleur invalide', async () => {
    await expect(repos.categories.create({ name: 'Invalide', color: 'rouge' })).rejects.toThrow();
  });

  it('archive sans supprimer', async () => {
    const created = await repos.categories.create({ name: 'Temporaire', color: '#abcdef' });
    await repos.categories.archive(created.id);
    expect(await repos.categories.list()).toHaveLength(8);
    expect(await repos.categories.list(true)).toHaveLength(9);
    expect((await repos.categories.get(created.id))?.archived).toBe(true);
  });

  it('réordonne dans une seule transaction', async () => {
    const categories = await repos.categories.list();
    const reversed = [...categories].reverse().map((category) => category.id);
    await repos.categories.reorder(reversed);
    expect((await repos.categories.list()).map((c) => c.id)).toEqual(reversed);
  });

  it('supprime logiquement', async () => {
    const created = await repos.categories.create({ name: 'À jeter', color: '#0000ff' });
    await repos.categories.softDelete(created.id);
    expect(await repos.categories.get(created.id)).toBeNull();
    expect((await db.categories.get(created.id))?.deletedAt).not.toBeNull();
  });
});

describe('blocs', () => {
  it('crée un bloc horodaté et validé', async () => {
    const block = await repos.blocks.create({
      title: 'Sport',
      date: asDateKey('2026-10-16'),
      startMin: 420,
      durationMin: 60,
    });
    expect(block.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(block.status).toBe('todo');
    expect(block.recurrence).toBeNull();
    expect(block.createdAt).toBe(block.updatedAt);
    expect(await repos.blocks.get(block.id)).toEqual(block);
  });

  it('refuse une durée inférieure à 5 minutes ou une heure impossible', async () => {
    await expect(
      repos.blocks.create({
        title: 'Trop court',
        date: asDateKey('2026-10-16'),
        startMin: 420,
        durationMin: 2,
      }),
    ).rejects.toThrow();
    await expect(
      repos.blocks.create({
        title: 'Heure invalide',
        date: asDateKey('2026-10-16'),
        startMin: 1500,
      }),
    ).rejects.toThrow();
    await expect(
      repos.blocks.create({
        title: 'Date invalide',
        date: '2026-02-31' as never,
        startMin: 420,
      }),
    ).rejects.toThrow();
  });

  it('liste les blocs par date et par catégorie', async () => {
    const category = (await repos.categories.list())[0];
    if (category === undefined) throw new Error('catégorie manquante');
    await repos.blocks.create({
      title: 'Réunion',
      categoryId: category.id,
      date: asDateKey('2026-10-16'),
      startMin: 600,
    });
    await repos.blocks.create({
      title: 'Autre jour',
      date: asDateKey('2026-10-17'),
      startMin: 600,
    });
    expect(await repos.blocks.listForDate(asDateKey('2026-10-16'))).toHaveLength(1);
    expect(await repos.blocks.listByCategory(category.id)).toHaveLength(1);
  });

  it('coupe une série en deux, en conservant les deux moitiés', async () => {
    const block = await repos.blocks.create({
      title: 'Méditation',
      date: asDateKey('2026-10-05'),
      startMin: 420,
      recurrence: rule({ freq: 'week', byWeekday: [1] }),
    });
    const created = await repos.blocks.splitSeries(block.id, asDateKey('2026-10-26'), {
      title: 'Méditation longue',
    });
    const original = await repos.blocks.get(block.id);
    expect(original?.recurrence?.endType).toBe('until');
    expect(original?.recurrence?.until).toBe('2026-10-25');
    expect(created.date).toBe('2026-10-26');
    expect(created.title).toBe('Méditation longue');
    expect(created.recurrence?.freq).toBe('week');
    expect(created.recurrence?.endType).toBe('never');
    expect(await db.blocks.count()).toBe(2);
  });

  it('supprime logiquement un bloc', async () => {
    const block = await repos.blocks.create({
      title: 'À supprimer',
      date: asDateKey('2026-10-16'),
      startMin: 420,
    });
    await repos.blocks.softDelete(block.id);
    expect(await repos.blocks.get(block.id)).toBeNull();
    expect(await repos.blocks.listForDate(asDateKey('2026-10-16'))).toHaveLength(0);
  });
});

describe('exceptions d’occurrence', () => {
  it('conserve une seule exception par bloc et par date', async () => {
    const block = await repos.blocks.create({
      title: 'Marche',
      date: asDateKey('2026-10-16'),
      startMin: 420,
      recurrence: rule({ freq: 'day' }),
    });
    await repos.blocks.setOverride(block.id, asDateKey('2026-10-17'), 'skipped');
    const updated = await repos.blocks.setOverride(block.id, asDateKey('2026-10-17'), 'modified', {
      startMin: 480,
      durationMin: 30,
    });
    const overrides = await repos.blocks.listOverridesForBlock(block.id);
    expect(overrides).toHaveLength(1);
    expect(updated.action).toBe('modified');
    expect(updated.changes?.startMin).toBe(480);
  });

  it('marque une occurrence faite avec la date de réalisation', async () => {
    const block = await repos.blocks.create({
      title: 'Lecture',
      date: asDateKey('2026-10-16'),
      startMin: 1200,
      recurrence: rule({ freq: 'day' }),
    });
    const override = await repos.blocks.setOverride(block.id, asDateKey('2026-10-16'), 'done');
    expect(override.doneAt).not.toBeNull();
  });

  it('supprime logiquement une exception', async () => {
    const block = await repos.blocks.create({
      title: 'Eau',
      date: asDateKey('2026-10-16'),
      startMin: 600,
      recurrence: rule({ freq: 'day' }),
    });
    await repos.blocks.setOverride(block.id, asDateKey('2026-10-18'), 'done');
    await repos.blocks.clearOverride(block.id, asDateKey('2026-10-18'));
    expect(await repos.blocks.listOverridesForBlock(block.id)).toHaveLength(0);
  });
});

describe('tâches', () => {
  it('trie par priorité puis par ancienneté', async () => {
    await repos.tasks.create({ title: 'Basse', priority: 0 });
    await repos.tasks.create({ title: 'Haute', priority: 3 });
    await repos.tasks.create({ title: 'Moyenne', priority: 1 });
    expect((await repos.tasks.list()).map((task) => task.title)).toEqual([
      'Haute',
      'Moyenne',
      'Basse',
    ]);
  });

  it('coche une tâche avec horodatage', async () => {
    const task = await repos.tasks.create({ title: 'Appeler', priority: 2 });
    const done = await repos.tasks.setDone(task.id, true);
    expect(done.done).toBe(true);
    expect(done.doneAt).not.toBeNull();
    expect(await repos.tasks.listOpen()).toHaveLength(0);
  });

  it('gère les sous-tâches', async () => {
    const task = await repos.tasks.create({ title: 'Déménagement', priority: 1 });
    const withSub = await repos.tasks.addSubtask(task.id, 'Réserver le camion');
    const subtask = withSub.subtasks[0];
    if (subtask === undefined) throw new Error('sous-tâche manquante');
    const toggled = await repos.tasks.toggleSubtask(task.id, subtask.id);
    expect(toggled.subtasks[0]?.done).toBe(true);
  });

  it('place une tâche sur la timeline', async () => {
    const task = await repos.tasks.create({ title: 'Courses', priority: 1 });
    const block = await repos.blocks.create({
      title: 'Courses',
      date: asDateKey('2026-10-16'),
      startMin: 840,
      durationMin: 45,
    });
    const placed = await repos.tasks.placeOnTimeline(task.id, block.id, asDateKey('2026-10-16'));
    expect(placed.blockId).toBe(block.id);
    expect(placed.dueDate).toBe('2026-10-16');
  });

  it('reporte les tâches non terminées d’une veille à aujourd’hui', async () => {
    await repos.tasks.create({ title: 'Hier', priority: 1, dueDate: asDateKey('2026-10-15') });
    await repos.tasks.create({
      title: 'Hier terminée',
      priority: 1,
      dueDate: asDateKey('2026-10-15'),
      done: true,
    });
    const moved = await repos.tasks.rescheduleOpenTasks(
      asDateKey('2026-10-15'),
      asDateKey('2026-10-16'),
    );
    expect(moved).toHaveLength(1);
    expect(moved[0]?.title).toBe('Hier');
  });

  it('refuse une priorité hors bornes', async () => {
    await expect(
      repos.tasks.create({ title: 'Priorité ?', priority: 7 as never }),
    ).rejects.toThrow();
  });
});

describe('modèles de journée', () => {
  it('applique un modèle en créant de vrais blocs à la date choisie', async () => {
    const template = await repos.templates.create({
      name: 'Matin',
      items: [
        { title: 'Réveil', categoryId: null, startMin: 360, durationMin: 15 },
        { title: 'Sport', categoryId: null, startMin: 420, durationMin: 60 },
      ],
    });
    const created = await repos.templates.apply(template.id, asDateKey('2026-10-16'));
    expect(created).toHaveLength(2);
    expect(await repos.blocks.listForDate(asDateKey('2026-10-16'))).toHaveLength(2);
    expect(created.map((block) => block.title)).toEqual(['Réveil', 'Sport']);
  });

  it('n’applique pas un modèle inconnu', async () => {
    await expect(repos.templates.apply('inconnu', asDateKey('2026-10-16'))).rejects.toThrow();
  });
});

describe('vue de la journée', () => {
  it('assemble les occurrences d’une série avec son exception', async () => {
    const block = await repos.blocks.create({
      title: 'Étirements',
      date: asDateKey('2026-10-10'),
      startMin: 400,
      durationMin: 30,
      recurrence: rule({ freq: 'day' }),
    });
    await repos.blocks.setOverride(block.id, asDateKey('2026-10-16'), 'done');

    const day = await repos.dayView.getDay(asDateKey('2026-10-16'));
    expect(day).toHaveLength(1);
    expect(day[0]?.date).toBe('2026-10-16');
    expect(day[0]?.status).toBe('done');
  });

  it('applique les changements d’une occurrence modifiée', async () => {
    const block = await repos.blocks.create({
      title: 'Yoga',
      date: asDateKey('2026-10-10'),
      startMin: 400,
      durationMin: 30,
      recurrence: rule({ freq: 'day' }),
    });
    await repos.blocks.setOverride(block.id, asDateKey('2026-10-16'), 'modified', {
      title: 'Yoga doux',
      startMin: 600,
      durationMin: 45,
    });
    const day = await repos.dayView.getDay(asDateKey('2026-10-16'));
    expect(day[0]?.title).toBe('Yoga doux');
    expect(day[0]?.startMin).toBe(600);
    expect(day[0]?.endMin).toBe(645);
  });

  it('masque une occurrence supprimée', async () => {
    const block = await repos.blocks.create({
      title: 'Pause',
      date: asDateKey('2026-10-10'),
      startMin: 400,
      recurrence: rule({ freq: 'day' }),
    });
    await repos.blocks.setOverride(block.id, asDateKey('2026-10-16'), 'deleted');
    expect(await repos.dayView.getDay(asDateKey('2026-10-16'))).toHaveLength(0);
  });

  it('découpe un bloc qui franchit minuit en deux jours', async () => {
    await repos.blocks.create({
      title: 'Garde de nuit',
      date: asDateKey('2026-10-16'),
      startMin: 1380,
      durationMin: 90,
    });
    const onStart = await repos.dayView.getDay(asDateKey('2026-10-16'));
    const onNext = await repos.dayView.getDay(asDateKey('2026-10-17'));
    expect(onStart).toHaveLength(1);
    expect(onStart[0]?.startMin).toBe(1380);
    expect(onStart[0]?.endMin).toBe(1440);
    expect(onStart[0]?.continuesNextDay).toBe(true);
    expect(onNext).toHaveLength(1);
    expect(onNext[0]?.startMin).toBe(0);
    expect(onNext[0]?.endMin).toBe(30);
    expect(onNext[0]?.continuesFromPreviousDay).toBe(true);
  });

  it('ne montre pas la journée entière du lendemain dans la journée du jour', async () => {
    await repos.blocks.create({
      title: 'Toute la journée',
      date: asDateKey('2026-10-16'),
      startMin: 0,
      allDay: true,
    });
    expect(await repos.dayView.getDay(asDateKey('2026-10-17'))).toHaveLength(0);
  });

  it('marque « en cours » un bloc de la journée en cours', async () => {
    await repos.blocks.create({
      title: 'Atelier',
      date: asDateKey('2026-10-16'),
      startMin: 420,
      durationMin: 60,
    });
    const day = await repos.dayView.getDay(asDateKey('2026-10-16'), {
      nowMin: 450,
      today: asDateKey('2026-10-16'),
    });
    expect(day[0]?.status).toBe('doing');
  });

  it('trie la bande « Toute la journée » avant les blocs horaires', async () => {
    await repos.blocks.create({
      title: 'Anniversaire',
      date: asDateKey('2026-10-16'),
      startMin: 0,
      allDay: true,
    });
    await repos.blocks.create({
      title: 'Réunion',
      date: asDateKey('2026-10-16'),
      startMin: 420,
    });
    const day = await repos.dayView.getDay(asDateKey('2026-10-16'));
    expect(day.map((entry) => entry.title)).toEqual(['Anniversaire', 'Réunion']);
  });

  it('rassemble plusieurs jours sur une plage', async () => {
    const block = await repos.blocks.create({
      title: 'Course',
      date: asDateKey('2026-10-01'),
      startMin: 420,
      recurrence: rule({ freq: 'week', byWeekday: [1, 4] }),
    });
    expect(block.recurrence?.freq).toBe('week');
    const range = await repos.dayView.getRange(asDateKey('2026-10-16'), asDateKey('2026-10-22'));
    expect(range.map((entry) => entry.date)).toEqual(['2026-10-19', '2026-10-22']);
  });
});
