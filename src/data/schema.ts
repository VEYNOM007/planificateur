/**
 * Validation stricte (Zod) de tout ce qui entre dans l'application :
 * écritures des dépôts et import de fichier. Un fichier corrompu ou une donnée
 * inattendue est rejeté avant toute écriture.
 *
 * Les schémas sont contraints de correspondre aux types métier du domaine :
 * une divergence devient une erreur de compilation (voir les contrôles en bas).
 */
import { z } from 'zod';
import type {
  Block,
  Category,
  Override,
  OverrideChanges,
  Settings,
  Subtask,
  Task,
  Template,
  TemplateItem,
} from '../domain/models';
import type { Recurrence, Weekday } from '../domain/recurrence/types';
import { isWeekday } from '../domain/recurrence/types';
import { isDateKey, type DateKey } from '../domain/time/dateKey';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const dateKeySchema = z.custom<DateKey>((value) => typeof value === 'string' && isDateKey(value), {
  message: 'Date locale invalide (attendu AAAA-MM-JJ)',
});

const weekdaySchema = z.custom<Weekday>((value) => typeof value === 'number' && isWeekday(value), {
  message: 'Jour de semaine invalide (0 = dimanche … 6 = samedi)',
});

const isoDateTimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Horodatage invalide');

const timestampsShape = {
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
};

const idSchema = z.string().uuid();

export const recurrenceSchema = z.object({
  freq: z.enum(['day', 'week', 'month', 'year']),
  interval: z.number().int().min(1).max(365),
  byWeekday: z.array(weekdaySchema).max(7),
  monthlyMode: z.enum(['dayOfMonth', 'nthWeekday']),
  nth: z.number().int().min(1).max(5),
  endType: z.enum(['never', 'count', 'until']),
  count: z.number().int().min(1).max(10_000),
  until: dateKeySchema.nullable(),
});

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur attendue au format #rrggbb');

export const categorySchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(60),
  color: colorSchema,
  icon: z.string().min(1).max(40),
  order: z.number().int().min(0).max(1000),
  archived: z.boolean(),
  ...timestampsShape,
});

export const blockSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(120),
  notes: z.string().max(2000),
  categoryId: idSchema.nullable(),
  date: dateKeySchema,
  startMin: z.number().int().min(0).max(1439),
  durationMin: z.number().int().min(5).max(1439),
  allDay: z.boolean(),
  status: z.enum(['todo', 'done', 'skipped']),
  reminderMin: z.number().int().min(0).max(100_000).nullable(),
  recurrence: recurrenceSchema.nullable(),
  ...timestampsShape,
});

export const overrideChangesSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  startMin: z.number().int().min(0).max(1439).optional(),
  durationMin: z.number().int().min(5).max(1439).optional(),
  notes: z.string().max(2000).optional(),
});

export const overrideSchema = z.object({
  id: idSchema,
  blockId: idSchema,
  date: dateKeySchema,
  action: z.enum(['done', 'skipped', 'modified', 'deleted']),
  changes: overrideChangesSchema.nullable(),
  doneAt: isoDateTimeSchema.nullable(),
  ...timestampsShape,
});

export const subtaskSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(120),
  done: z.boolean(),
});

export const taskSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(120),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  done: z.boolean(),
  doneAt: isoDateTimeSchema.nullable(),
  dueDate: dateKeySchema.nullable(),
  blockId: idSchema.nullable(),
  subtasks: z.array(subtaskSchema).max(100),
  ...timestampsShape,
});

export const templateItemSchema = z.object({
  title: z.string().min(1).max(120),
  categoryId: idSchema.nullable(),
  startMin: z.number().int().min(0).max(1439),
  durationMin: z.number().int().min(5).max(1439),
});

export const templateSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(60),
  items: z.array(templateItemSchema).max(200),
  ...timestampsShape,
});

export const settingsSchema = z.object({
  // Ligne unique repérée par un identifiant fixe, pas un UUID.
  id: z.string().min(1).max(64),
  theme: z.enum(['light', 'dark', 'auto']),
  dayStartMin: z.number().int().min(0).max(1439),
  dayEndMin: z.number().int().min(0).max(1439),
  snapMin: z.number().int().min(1).max(60),
  defaultReminderMin: z.number().int().min(0).max(100_000).nullable(),
  firstWeekday: z.number().int().min(0).max(6),
  schemaVersion: z.number().int().min(1),
  updatedAt: isoDateTimeSchema,
});

/* ---------- Entrées des dépôts (avec valeurs par défaut) ---------- */

export const newCategorySchema = categorySchema
  .omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true })
  .partial({ icon: true, order: true, archived: true });

export const newBlockSchema = blockSchema
  .omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true })
  .partial({
    notes: true,
    categoryId: true,
    durationMin: true,
    allDay: true,
    status: true,
    reminderMin: true,
    recurrence: true,
  });

export const newTaskSchema = taskSchema
  .omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true })
  .partial({
    priority: true,
    done: true,
    doneAt: true,
    dueDate: true,
    blockId: true,
    subtasks: true,
  });

export const newTemplateSchema = templateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const newOverrideSchema = overrideSchema
  .omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true })
  .partial({ changes: true, doneAt: true });

export const settingsPatchSchema = settingsSchema
  .omit({ id: true, updatedAt: true, schemaVersion: true })
  .partial();

export type NewCategory = z.infer<typeof newCategorySchema>;
export type NewBlock = z.infer<typeof newBlockSchema>;
export type NewTask = z.infer<typeof newTaskSchema>;
export type NewTemplate = z.infer<typeof newTemplateSchema>;
export type NewOverride = z.infer<typeof newOverrideSchema>;
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/* ---------- Contrôles de correspondance schéma <-> domaine ---------- */

export type _CategoryMatch = Equal<z.infer<typeof categorySchema>, Category>;
export type _BlockMatch = Equal<z.infer<typeof blockSchema>, Block>;
export type _RecurrenceMatch = Equal<z.infer<typeof recurrenceSchema>, Recurrence>;
export type _OverrideMatch = Equal<z.infer<typeof overrideSchema>, Override>;
export type _OverrideChangesMatch = Equal<z.infer<typeof overrideChangesSchema>, OverrideChanges>;
export type _TaskMatch = Equal<z.infer<typeof taskSchema>, Task>;
export type _SubtaskMatch = Equal<z.infer<typeof subtaskSchema>, Subtask>;
export type _TemplateMatch = Equal<z.infer<typeof templateSchema>, Template>;
export type _TemplateItemMatch = Equal<z.infer<typeof templateItemSchema>, TemplateItem>;
export type _SettingsMatch = Equal<z.infer<typeof settingsSchema>, Settings>;
