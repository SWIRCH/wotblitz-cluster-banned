import { motion, AnimatePresence } from "framer-motion";
import type { AppSettings } from "../../../utils/settingsStorage";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  onDiagnose: () => void;
  diagnosticInfo: string | null;
};

export default function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSetting,
  onDiagnose,
  diagnosticInfo,
}: SettingsModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings-modal"
          className="fixed inset-0 z-1000 flex items-center justify-center"
        >
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="backdrop-blur-2xl rounded-xl bg-white/5 p-6 sm:p-4 relative w-[min(640px,90%)] "
            initial={{ opacity: 0, y: 8, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.995 }}
            transition={{ duration: 0.18 }}
          >
            <h3 className="text-lg font-semibold mb-2">
              Настройки приложения
            </h3>

            <p className="text-sm text-white/60 mb-4">
              Здесь вы можете настроить параметры приложения.
            </p>

            <div className="mt-3 p-3 rounded bg-white/5">
              <div className="text-sm font-medium mb-2">
                Методы блокировки:
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.useFirewall}
                  onChange={(e) =>
                    onUpdateSetting("useFirewall", e.target.checked)
                  }
                  className="rounded"
                />
                <span>Использовать брандмауэр Windows</span>
                <span className="text-green-400 text-xs">
                  (рекомендуется)
                </span>
              </label>

              <div className="text-xs text-white/60 mt-1 pl-6">
                Блокирует подключения на уровне сети. Работает даже если игра
                использует IP напрямую. Требует прав администратора.
              </div>
            </div>

            <div className="mt-3 p-3 rounded bg-white/5">
              <div className="text-sm font-medium mb-2">
                Бекапы (резеврные копии)
              </div>

              <div className="">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.useBackup}
                    onChange={(e) =>
                      onUpdateSetting("useBackup", e.target.checked)
                    }
                    className="rounded"
                  />
                  <span>Создавать бекапы hosts</span>
                  <span className="text-green-400 text-xs">
                    (рекомендуется)
                  </span>
                </label>

                <div className="text-xs text-white/60 mt-1 pl-6">
                  После очистки создаёт файл .bak в папке с hosts.
                </div>
              </div>

              <div className="">
                <div className="relative flex flex-col mt-2">
                  <div className="text-sm mb-1.5">
                    <span>Максимальное колличество бекапов</span>
                  </div>
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      className="flex items-center justify-center text-body bg-neutral-secondary-medium box-border border border-default-medium hover:bg-neutral-tertiary-medium hover:text-heading focus:ring-4 focus:ring-neutral-tertiary rounded-full text-sm focus:outline-none h-6 w-6"
                      onClick={() =>
                        onUpdateSetting(
                          "backupCount",
                          Math.max(1, settings.backupCount) - 1
                        )
                      }
                    >
                      <svg
                        className="w-3 h-3 text-heading"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 12h14"
                        />
                      </svg>
                    </button>
                    <input
                      type="text"
                      className="shrink-0 text-heading border-0 bg-transparent text-sm font-normal focus:outline-none focus:ring-0 max-w-[2.5rem] text-center"
                      placeholder=""
                      value={settings.backupCount}
                      required
                      readOnly
                    />
                    <button
                      type="button"
                      className="flex items-center justify-center text-body bg-neutral-secondary-medium box-border border border-default-medium hover:bg-neutral-tertiary-medium hover:text-heading focus:ring-4 focus:ring-neutral-tertiary rounded-full text-sm focus:outline-none h-6 w-6"
                      onClick={() =>
                        onUpdateSetting(
                          "backupCount",
                          Math.min(29, settings.backupCount) + 1
                        )
                      }
                    >
                      <svg
                        className="w-3 h-3 text-heading"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 12h14m-7 7V5"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 p-3 rounded bg-white/5">
              <div className="text-sm font-medium mb-2">
                Отладка и диагностика:
              </div>

              <button className="text-xs" onClick={onDiagnose}>
                Диагностика
              </button>

              <div className="text-xs text-white/60 mt-1 pl-6">
                {diagnosticInfo ?? "Нет данных."}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                className="option-btn bg-yellow-400 text-black px-4 py-2 rounded"
                onClick={onClose}
              >
                Сохранить и закрыть
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
