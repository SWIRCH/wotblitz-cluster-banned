import { useState, useEffect } from "react";
import {
  loadSettings,
  saveSingleSetting,
  type AppSettings,
} from "../utils/settingsStorage";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    useFirewall: true,
    useBackup: false,
    backupCount: 5,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings().then((loaded) => {
      setSettings(loaded);
      setLoading(false);
    });
  }, []);

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      saveSingleSetting(key, value).catch((err) => {
        console.error("Failed to save setting:", err);
      });
      return updated;
    });
  };

  return { settings, updateSetting, loading };
}
