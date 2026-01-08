const SETTINGS_KEY = "clusterbanned_settings";

export interface AppSettings {
  useFirewall: boolean;
  useBackup: boolean;
  backupCount: number;
}

const defaultSettings: AppSettings = {
  useFirewall: true,
  useBackup: false,
  backupCount: 5,
};

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      // Слияние с дефолтными значениями (на случай если добавятся новые поля)
      return {
        ...defaultSettings,
        ...parsed,
      };
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }

  return defaultSettings;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

export function saveSingleSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): void {
  const current = loadSettings();
  const updated = { ...current, [key]: value };
  saveSettings(updated);
}
