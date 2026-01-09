import { safeInvoke } from "./tauriInvoke";

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

export async function loadSettings(): Promise<AppSettings> {
  try {
    const settings = await safeInvoke<AppSettings>("get_settings");
    // Слияние с дефолтными значениями (на случай если добавятся новые поля)
    return {
      ...defaultSettings,
      ...settings,
    };
  } catch (error) {
    console.error("Failed to load settings:", error);
    return defaultSettings;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await safeInvoke("save_settings", { settings });
  } catch (error) {
    console.error("Failed to save settings:", error);
    throw error;
  }
}

export async function saveSingleSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  const current = await loadSettings();
  const updated = { ...current, [key]: value };
  await saveSettings(updated);
}
