/** Dépôt des réglages : une seule ligne, créée au premier lancement. */
import type { Table } from 'dexie';
import type { Settings } from '../../domain/models';
import { settingsSchema, settingsPatchSchema, type SettingsPatch } from '../schema';
import { nowIso } from '../ids';
import { DEFAULT_SETTINGS_ID, buildDefaultSettings } from '../defaults';
import { SCHEMA_VERSION } from '../db';

export class SettingsRepository {
  constructor(private readonly table: Table<Settings, string>) {}

  async get(): Promise<Settings> {
    const row = await this.table.get(DEFAULT_SETTINGS_ID);
    if (row !== undefined) return row;
    const settings = buildDefaultSettings();
    await this.table.put(settings);
    return settings;
  }

  async update(patch: SettingsPatch): Promise<Settings> {
    const parsed = settingsPatchSchema.parse(patch);
    const current = await this.get();
    const updated = settingsSchema.parse({
      ...current,
      ...parsed,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: nowIso(),
    });
    await this.table.put(updated);
    return updated;
  }

  async reset(): Promise<Settings> {
    const settings = buildDefaultSettings();
    await this.table.put(settings);
    return settings;
  }
}
