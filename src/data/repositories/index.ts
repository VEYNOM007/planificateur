/** Point d'entrée unique vers les données : l'interface n'importe que ceci. */
import type { Settings } from '../../domain/models';
import { createDb, type PlanificateurDb } from '../db';
import { CategoryRepository } from './categories';
import { BlockRepository } from './blocks';
import { TaskRepository } from './tasks';
import { TemplateRepository } from './templates';
import { SettingsRepository } from './settings';
import { DayViewRepository } from './dayView';

export interface Repositories {
  db: PlanificateurDb;
  categories: CategoryRepository;
  blocks: BlockRepository;
  tasks: TaskRepository;
  templates: TemplateRepository;
  settings: SettingsRepository;
  dayView: DayViewRepository;
}

export function createRepositories(db: PlanificateurDb = createDb()): Repositories {
  const categories = new CategoryRepository(db.categories);
  const blocks = new BlockRepository(db.blocks, db.overrides);
  const tasks = new TaskRepository(db.tasks);
  const templates = new TemplateRepository(db.templates, blocks);
  const settings = new SettingsRepository(db.settings);
  const dayView = new DayViewRepository(blocks);
  return { db, categories, blocks, tasks, templates, settings, dayView };
}

/** Ouvre la base et crée les données par défaut au premier lancement. */
export async function initRepositories(db?: PlanificateurDb): Promise<Repositories> {
  const repositories = createRepositories(db);
  await repositories.categories.ensureSeeded();
  await repositories.settings.get();
  return repositories;
}

export { CategoryRepository } from './categories';
export { BlockRepository } from './blocks';
export { TaskRepository } from './tasks';
export { TemplateRepository } from './templates';
export { SettingsRepository } from './settings';
export { DayViewRepository, type DayBlock, type RangeOptions } from './dayView';
export type { Settings };
