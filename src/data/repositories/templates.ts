/**
 * Dépôt des journées types (Template). Appliquer un modèle crée de vrais blocs
 * à la date choisie, dans une seule transaction.
 */
import type { Block, Template } from '../../domain/models';
import type { DateKey } from '../../domain/time/dateKey';
import { newTemplateSchema, templateSchema, newBlockSchema, blockSchema } from '../schema';
import { newId, nowIso } from '../ids';
import type { NewTemplate } from '../schema';
import type { BlockRepository } from './blocks';
import type { Table } from 'dexie';

export class TemplateRepository {
  constructor(
    private readonly templates: Table<Template, string>,
    private readonly blocks: BlockRepository,
  ) {}

  async list(): Promise<Template[]> {
    const rows = await this.templates.orderBy('name').toArray();
    return rows.filter((row) => row.deletedAt === null);
  }

  async get(id: string): Promise<Template | null> {
    const row = await this.templates.get(id);
    if (row === undefined || row.deletedAt !== null) return null;
    return row;
  }

  async create(input: NewTemplate): Promise<Template> {
    const parsed = newTemplateSchema.parse(input);
    const stamp = nowIso();
    const template = templateSchema.parse({
      id: newId(),
      name: parsed.name,
      items: parsed.items,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    });
    await this.templates.add(template);
    return template;
  }

  async update(id: string, patch: Partial<NewTemplate>): Promise<Template> {
    const parsed = newTemplateSchema.partial().parse(patch);
    const current = await this.templates.get(id);
    if (current === undefined) throw new Error(`Modèle inconnu : ${id}`);
    const updated = templateSchema.parse({ ...current, ...parsed, updatedAt: nowIso() });
    await this.templates.put(updated);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const current = await this.templates.get(id);
    if (current === undefined) return;
    const stamp = nowIso();
    await this.templates.put({ ...current, deletedAt: stamp, updatedAt: stamp });
  }

  /** Crée un bloc par élément du modèle, à la date demandée, en une transaction. */
  async apply(id: string, date: DateKey): Promise<Block[]> {
    const template = await this.get(id);
    if (template === null) throw new Error(`Modèle inconnu : ${id}`);
    const stamp = nowIso();
    const blocks: Block[] = template.items.map((item) =>
      blockSchema.parse({
        ...newBlockSchema.parse({
          title: item.title,
          categoryId: item.categoryId,
          date,
          startMin: item.startMin,
          durationMin: item.durationMin,
        }),
        id: newId(),
        notes: '',
        allDay: false,
        status: 'todo',
        reminderMin: null,
        recurrence: null,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      }),
    );
    const table = this.blocksTable();
    await table.db.transaction('rw', table, async () => {
      await table.bulkAdd(blocks);
    });
    return blocks;
  }

  private blocksTable(): Table<Block, string> {
    // Accès contrôlé au dépôt des blocs pour rester dans une seule transaction.
    return this.blocks.table;
  }
}
