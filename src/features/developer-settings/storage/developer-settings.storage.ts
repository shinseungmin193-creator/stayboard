import { DEVELOPER_SETTINGS_STORAGE_KEY, DEFAULT_DEVELOPER_SETTINGS, normalizeDeveloperSettings, type DeveloperSettings } from "../domain/developer-settings";

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readDeveloperSettings(storage: SettingsStorage | null | undefined): DeveloperSettings {
  if (!storage) return structuredClone(DEFAULT_DEVELOPER_SETTINGS);
  try {
    const raw = storage.getItem(DEVELOPER_SETTINGS_STORAGE_KEY);
    return raw ? normalizeDeveloperSettings(JSON.parse(raw)) : structuredClone(DEFAULT_DEVELOPER_SETTINGS);
  } catch {
    return structuredClone(DEFAULT_DEVELOPER_SETTINGS);
  }
}

export function writeDeveloperSettings(storage: SettingsStorage, settings: DeveloperSettings) {
  const normalized = normalizeDeveloperSettings(settings);
  storage.setItem(DEVELOPER_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearDeveloperSettings(storage: SettingsStorage) {
  storage.removeItem(DEVELOPER_SETTINGS_STORAGE_KEY);
}
