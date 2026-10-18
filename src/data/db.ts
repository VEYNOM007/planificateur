/**
 * Base IndexedDB versionnée (Dexie). Le schéma est déclaré dans un registre
 * ordonné pour que chaque future version se teste sur des données de la
 * version précédente.
 */
import { Dexie, type Table } from 'dexie';
import type { Block, Category, Override, Settings, Task, Template } from '../domain/models';

export const DB_NAME = 'planificateur';

/** Version courante du schéma. À incrémenter à chaque évolution. */
export const SCHEMA_VERSION = 1;

export interface SchemaVersion {
  version: number;
  /** Index Dexie par table : Block par date et par categoryId, Override par
   *  blockId + date, Task par done et par priority. */
  stores: Record<string, string>;
}

export const SCHEMA_VERSIONS: readonly SchemaVersion[] = [
  {
    version: 1,
    stores: {
      categories: 'id, order, archived, name',
      blocks: 'id, date, categoryId, [date+startMin]',
      overrides: 'id, blockId, [blockId+date], date',
      tasks: 'id, done, priority, blockId, dueDate',
      templates: 'id, name',
      settings: 'id',
    },
  },
];

export class PlanificateurDb extends Dexie {
  categories!: Table<Category, string>;
  blocks!: Table<Block, string>;
  overrides!: Table<Override, string>;
  tasks!: Table<Task, string>;
  templates!: Table<Template, string>;
  settings!: Table<Settings, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    for (const entry of SCHEMA_VERSIONS) {
      this.version(entry.version).stores(entry.stores);
    }
  }
}

export function createDb(name?: string): PlanificateurDb {
  return new PlanificateurDb(name);
}
