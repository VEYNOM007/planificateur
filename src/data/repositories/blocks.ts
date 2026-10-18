/**
 * Dépôt des blocs et des exceptions d'occurrence (Override).
 * Toute écriture est validée, horodatée et logique (deletedAt) ; les écritures
 * liées (couper une série, appliquer un modèle) passent par une transaction.
 */
import type { Table } from 'dexie';
import type { Block, Override, OverrideAction, OverrideChanges } from '../../domain/models';
import {
  blockSchema,
  newBlockSchema,
  newOverrideSchema,
  overrideSchema,
  type NewBlock,
} from '../schema';
import { newId, nowIso } from '../ids';
import type { DateKey } from '../../domain/time/dateKey';
import { addDaysKey } from '../../domain/time/dateKey';

export class BlockRepository {
  constructor(
    private readonly blocks: Table<Block, string>,
    private readonly overrides: Table<Override, string>,
  ) {}

  /** Table Dexie des blocs, exposée pour rester dans une transaction partagée. */
  get table(): Table<Block, string> {
    return this.blocks;
  }

  /** Table Dexie des exceptions, exposée pour rester dans une transaction. */
  get overrideTable(): Table<Override, string> {
    return this.overrides;
  }

  async get(id: string): Promise<Block | null> {
    const row = await this.blocks.get(id);
    if (row === undefined || row.deletedAt !== null) return null;
    return row;
  }

  /** Blocs actifs dont la date de départ est au plus tard `until`. */
  async listStartingUntil(until: DateKey): Promise<Block[]> {
    const rows = await this.blocks.where('date').belowOrEqual(until).toArray();
    return rows.filter((row) => row.deletedAt === null);
  }

  /** Blocs actifs non récurrents d'une date précise. */
  async listForDate(date: DateKey): Promise<Block[]> {
    const rows = await this.blocks.where('date').equals(date).toArray();
    return rows.filter((row) => row.deletedAt === null);
  }

  async listByCategory(categoryId: string): Promise<Block[]> {
    const rows = await this.blocks.where('categoryId').equals(categoryId).toArray();
    return rows.filter((row) => row.deletedAt === null);
  }

  async create(input: NewBlock): Promise<Block> {
    const parsed = newBlockSchema.parse(input);
    const stamp = nowIso();
    const block = blockSchema.parse({
      id: newId(),
      title: parsed.title,
      notes: parsed.notes ?? '',
      categoryId: parsed.categoryId ?? null,
      date: parsed.date,
      startMin: parsed.startMin,
      durationMin: parsed.durationMin ?? 60,
      allDay: parsed.allDay ?? false,
      status: parsed.status ?? 'todo',
      reminderMin: parsed.reminderMin ?? null,
      recurrence: parsed.recurrence ?? null,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    });
    await this.blocks.add(block);
    return block;
  }

  async update(
    id: string,
    patch: Partial<NewBlock> & { status?: Block['status'] },
  ): Promise<Block> {
    const parsed = newBlockSchema.partial().parse(patch);
    const current = await this.blocks.get(id);
    if (current === undefined) throw new Error(`Bloc inconnu : ${id}`);
    const updated = blockSchema.parse({ ...current, ...parsed, updatedAt: nowIso() });
    await this.blocks.put(updated);
    return updated;
  }

  /**
   * Modifie une série à partir d'une date : la série d'origine s'arrête la
   * veille et une nouvelle série démarre à `fromDate` (coupe en deux).
   */
  async splitSeries(id: string, fromDate: DateKey, patch: Partial<NewBlock>): Promise<Block> {
    return this.blocks.db.transaction('rw', this.blocks, async () => {
      const current = await this.blocks.get(id);
      if (current === undefined) throw new Error(`Bloc inconnu : ${id}`);
      if (current.recurrence === null) throw new Error('Ce bloc n’est pas récurrent');

      const trimmed = blockSchema.parse({
        ...current,
        recurrence: { ...current.recurrence, endType: 'until', until: addDaysKey(fromDate, -1) },
        updatedAt: nowIso(),
      });
      await this.blocks.put(trimmed);

      const parsed = newBlockSchema.partial().parse(patch);
      const stamp = nowIso();
      const created = blockSchema.parse({
        ...current,
        ...parsed,
        id: newId(),
        date: fromDate,
        recurrence: { ...current.recurrence, ...(parsed.recurrence ?? {}) },
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      });
      await this.blocks.add(created);
      return created;
    });
  }

  async softDelete(id: string): Promise<void> {
    const current = await this.blocks.get(id);
    if (current === undefined) return;
    const stamp = nowIso();
    await this.blocks.put({ ...current, deletedAt: stamp, updatedAt: stamp });
  }

  /* ---------- Exceptions d'occurrence ---------- */

  async listOverridesForBlock(blockId: string): Promise<Override[]> {
    const rows = await this.overrides.where('blockId').equals(blockId).toArray();
    return rows.filter((row) => row.deletedAt === null);
  }

  async listOverridesBetween(start: DateKey, end: DateKey): Promise<Override[]> {
    const rows = await this.overrides.where('date').between(start, end, true, true).toArray();
    return rows.filter((row) => row.deletedAt === null);
  }

  /** Une exception par (bloc, date) : mise à jour si elle existe déjà. */
  async setOverride(
    blockId: string,
    date: DateKey,
    action: OverrideAction,
    changes: OverrideChanges | null = null,
  ): Promise<Override> {
    newOverrideSchema.parse({ blockId, date, action, changes });
    return this.overrides.db.transaction('rw', this.overrides, async () => {
      const existing = await this.overrides.where('[blockId+date]').equals([blockId, date]).first();
      const stamp = nowIso();
      const override = overrideSchema.parse({
        id: existing?.id ?? newId(),
        blockId,
        date,
        action,
        changes,
        doneAt: action === 'done' ? stamp : null,
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
        deletedAt: null,
      });
      await this.overrides.put(override);
      return override;
    });
  }

  async clearOverride(blockId: string, date: DateKey): Promise<void> {
    const existing = await this.overrides.where('[blockId+date]').equals([blockId, date]).first();
    if (existing === undefined) return;
    const stamp = nowIso();
    await this.overrides.put({ ...existing, deletedAt: stamp, updatedAt: stamp });
  }
}
