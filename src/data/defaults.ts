/** Données par défaut créées au premier lancement. */
import type { Category, Settings } from '../domain/models';
import { SCHEMA_VERSION } from './db';
import { newId, nowIso } from './ids';

interface DefaultCategory {
  name: string;
  color: string;
  icon: string;
}

/** Huit catégories par défaut, modifiables (questions ouvertes du cahier). */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: 'Travail', color: '#2563eb', icon: 'briefcase' },
  { name: 'Sport et santé', color: '#16a34a', icon: 'heart-pulse' },
  { name: 'Famille', color: '#db2777', icon: 'users' },
  { name: 'Admin', color: '#7c3aed', icon: 'file-text' },
  { name: 'Repas', color: '#ea580c', icon: 'utensils' },
  { name: 'Repos', color: '#0d9488', icon: 'moon' },
  { name: 'Déplacement', color: '#4b5563', icon: 'car' },
  { name: 'Loisirs', color: '#ca8a04', icon: 'gamepad-2' },
];

export const DEFAULT_SETTINGS_ID = 'settings';

export function buildDefaultCategories(): Category[] {
  const stamp = nowIso();
  return DEFAULT_CATEGORIES.map((category, index) => ({
    id: newId(),
    name: category.name,
    color: category.color,
    icon: category.icon,
    order: index,
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }));
}

export function buildDefaultSettings(): Settings {
  return {
    id: DEFAULT_SETTINGS_ID,
    theme: 'auto',
    // Plage de la timeline : 5h à 23h, réglable.
    dayStartMin: 5 * 60,
    dayEndMin: 23 * 60,
    snapMin: 5,
    defaultReminderMin: 10,
    firstWeekday: 1,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso(),
  };
}
