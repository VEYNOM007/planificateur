/** Dépôt des catégories : lecture, création, modification, archivage. */
import type { Table } from 'dexie';
import type { Category } from '../../domain/models';
import { newCategorySchema, categorySchema, type NewCategory } from '../schema';
import { newId, nowIso } from '../ids';
import { buildDefaultCategories } from '../defaults';

export class CategoryRepository {
  constructor(private readonly table: Table<Category, string>) {}

  /** Toutes les catégories actives, triées par ordre d'affichage. */
  async list(includeArchived = false): Promise<Category[]> {
    const rows = await this.table.orderBy('order').toArray();
    return rows.filter((row) => row.deletedAt === null && (includeArchived || !row.archived));
  }

  async get(id: string): Promise<Category | null> {
    const row = await this.table.get(id);
    if (row === undefined || row.deletedAt !== null) return null;
    return row;
  }

  async create(input: NewCategory): Promise<Category> {
    const parsed = newCategorySchema.parse(input);
    const stamp = nowIso();
    const highest = await this.table.orderBy('order').last();
    const category: Category = categorySchema.parse({
      id: newId(),
      name: parsed.name,
      color: parsed.color,
      icon: parsed.icon ?? 'circle',
      order: parsed.order ?? (highest === undefined ? 0 : highest.order + 1),
      archived: parsed.archived ?? false,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    });
    await this.table.add(category);
    return category;
  }

  async update(id: string, patch: Partial<NewCategory>): Promise<Category> {
    const parsed = newCategorySchema.partial().parse(patch);
    const current = await this.table.get(id);
    if (current === undefined) throw new Error(`Catégorie inconnue : ${id}`);
    const updated = categorySchema.parse({ ...current, ...parsed, updatedAt: nowIso() });
    await this.table.put(updated);
    return updated;
  }

  async archive(id: string, archived = true): Promise<void> {
    await this.update(id, { archived });
  }

  async reorder(ids: readonly string[]): Promise<void> {
    const stamp = nowIso();
    await this.table.db.transaction('rw', this.table, async () => {
      for (const [index, id] of ids.entries()) {
        const current = await this.table.get(id);
        if (current !== undefined) {
          await this.table.put({ ...current, order: index, updatedAt: stamp });
        }
      }
    });
  }

  async softDelete(id: string): Promise<void> {
    const current = await this.table.get(id);
    if (current === undefined) return;
    const stamp = nowIso();
    await this.table.put({ ...current, deletedAt: stamp, updatedAt: stamp });
  }

  /** Crée les huit catégories par défaut si la base est vide. */
  async ensureSeeded(): Promise<Category[]> {
    const count = await this.table.count();
    if (count > 0) return this.list(true);
    const defaults = buildDefaultCategories();
    await this.table.bulkAdd(defaults);
    return defaults;
  }
}
