/**
 * Entités métier, pures. Elles ne dépendent ni de React, ni de Dexie, ni de Zod.
 * La couche données (src/data) fournit le stockage et la validation qui
 * respectent ces types.
 */
import type { DateKey } from '../time/dateKey';
import type { Recurrence } from '../recurrence/types';

/** Statut enregistré d'un bloc. « en cours » est calculé, jamais stocké. */
export type BlockStatus = 'todo' | 'done' | 'skipped';

/** Statut affiché, incluant l'état calculé « en cours ». */
export type BlockDisplayStatus = BlockStatus | 'doing';

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
  /** Suppression logique : null tant que l'enregistrement est actif. */
  deletedAt: string | null;
}

export interface Category extends Timestamps {
  id: string;
  name: string;
  /** Couleur CSS (hexadécimal). */
  color: string;
  /** Nom d'icône du jeu embarqué. */
  icon: string;
  order: number;
  archived: boolean;
}

export interface Block extends Timestamps {
  id: string;
  title: string;
  notes: string;
  categoryId: string | null;
  /** Date de départ de la série (ou date unique). */
  date: DateKey;
  /** Minutes depuis minuit, 0 à 1439. */
  startMin: number;
  /** Durée en minutes, au moins 5. */
  durationMin: number;
  /** Bloc « Toute la journée » : sans heure, en bandeau haut. */
  allDay: boolean;
  /** N'a de sens que pour un bloc sans récurrence ; sinon, voir Override. */
  status: BlockStatus;
  /** Délai du rappel avant le bloc, en minutes ; null = aucun rappel. */
  reminderMin: number | null;
  /** Règle de récurrence, ou null pour un bloc unique. */
  recurrence: Recurrence | null;
}

export type OverrideAction = 'done' | 'skipped' | 'modified' | 'deleted';

export interface OverrideChanges {
  title?: string;
  startMin?: number;
  durationMin?: number;
  notes?: string;
}

/** État propre à une occurrence de série. Clé fonctionnelle : blockId + date. */
export interface Override extends Timestamps {
  id: string;
  blockId: string;
  date: DateKey;
  action: OverrideAction;
  changes: OverrideChanges | null;
  doneAt: string | null;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task extends Timestamps {
  id: string;
  title: string;
  priority: 0 | 1 | 2 | 3;
  done: boolean;
  doneAt: string | null;
  dueDate: DateKey | null;
  /** Renseigné quand la tâche est placée sur la timeline. */
  blockId: string | null;
  subtasks: Subtask[];
}

export interface TemplateItem {
  title: string;
  categoryId: string | null;
  startMin: number;
  durationMin: number;
}

export interface Template extends Timestamps {
  id: string;
  name: string;
  items: TemplateItem[];
}

export type ThemePreference = 'light' | 'dark' | 'auto';

export interface Settings {
  id: string;
  theme: ThemePreference;
  dayStartMin: number;
  dayEndMin: number;
  snapMin: number;
  defaultReminderMin: number | null;
  /** 0 = dimanche … 6 = samedi. */
  firstWeekday: number;
  schemaVersion: number;
  updatedAt: string;
}
