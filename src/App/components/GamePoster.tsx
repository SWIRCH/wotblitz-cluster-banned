import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import type { Region } from "../../types/cluster";

type GamePosterProps = {
  posterUrl: string;
  tauriAvailable: boolean | null;
  hostsMismatch: boolean;
  gameRunning: boolean;
  onPlayClick: () => void;
  onUpdateClick: () => void;
  onCheckHosts: () => void;
  onSettingsClick: () => void;
  onRefreshClick: () => void;
  onClearClick: () => void;
  selectedRegion: Region | null;
  lastTauriError: string | null;
  mismatchDomains: string[];
};

export default function GamePoster({
  posterUrl,
  tauriAvailable,
  hostsMismatch,
  gameRunning,
  onPlayClick,
  onUpdateClick,
  onCheckHosts,
  onSettingsClick,
  onRefreshClick,
  onClearClick,
  selectedRegion,
  lastTauriError,
  mismatchDomains,
}: GamePosterProps) {
  return (
    <div className="inGamePoster">
      <div id="poster" style={{ backgroundImage: `url('${posterUrl}')` }}>
        <div className="gameStatus">
          <div className="statusE">
            <div className="text-[12px]">
              <AnimatePresence>
                {tauriAvailable === true && hostsMismatch === false && (
                  <motion.div
                    key="hosts-ok"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1"
                  >
                    <Check
                      size={12}
                      stroke="#05df72"
                      strokeWidth={1.5}
                      absoluteStrokeWidth
                    />
                    <span className="text-green-400">Hosts в порядке</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="statusE">
            <div className="text-[12px] cursor-pointer">
              <div className="flex items-center gap-1">
                <button
                  className="text-red-400 text-xs"
                  onClick={onClearClick}
                >
                  Очистить блокировки
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="gameButtons rounded-xl bg-white/5 backdrop-blur-2xl p-4 sm:p-4 relative w-full">
          <AnimatePresence mode="wait">
            <div className="relative w-full h-12 flex items-center mt-1 gap-2">
              {hostsMismatch ? (
                <motion.button
                  key="update-btn"
                  className="steam-btn btnposition bg-yellow-400 text-black absolute left-0 right-0 top-1/2 -translate-y-1/2"
                  initial={{ opacity: 0, y: 8, scale: 0.995 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.995 }}
                  transition={{ duration: 0.18 }}
                  onClick={onUpdateClick}
                  aria-label={`Обновить hosts для ${
                    selectedRegion?.alias_name ?? selectedRegion?.name
                  }`}
                >
                  {`Обновить блок (${
                    selectedRegion?.alias_name ?? selectedRegion?.name
                  })`}
                </motion.button>
              ) : (
                <motion.button
                  key="play-btn"
                  className={`steam-btn btnposition absolute left-0 right-0 top-1/2 -translate-y-1/2 ${
                    gameRunning ? "bg-red-600 text-white" : ""
                  }`}
                  initial={{ opacity: 0, y: 8, scale: 0.995 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.995 }}
                  transition={{ duration: 0.18 }}
                  onClick={onPlayClick}
                >
                  {gameRunning ? "Закрыть" : "Играть"}
                </motion.button>
              )}
            </div>
          </AnimatePresence>

          {/* Hosts status */}
          <AnimatePresence>
            <div className="mt-3 text-sm text-white/60">
              {tauriAvailable === null && <span>Проверка host-файла...</span>}
              {tauriAvailable === false && (
                <span className="text-red-400">
                  Tauri недоступен — запустите desktop-приложение
                </span>
              )}

              {tauriAvailable === true && hostsMismatch === true && (
                <motion.span
                  key="hosts-mismatch"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="text-yellow-300 block"
                >
                  Несоответствия: {mismatchDomains.length} —{" "}
                  {mismatchDomains.slice(0, 5).join(", ")}
                  {mismatchDomains.length > 5 ? "..." : ""}
                </motion.span>
              )}

              <div className="mt-2 flex flex-wrap justify-between items-center gap-3">
                <button className="text-xs underline" onClick={onCheckHosts}>
                  Проверить статус
                </button>

                <button className="text-xs underline" onClick={onSettingsClick}>
                  Настройки
                </button>

                <button className="text-xs underline" onClick={onRefreshClick}>
                  Обновить
                </button>
              </div>

              {lastTauriError && (
                <div className="mt-2 text-xs whitespace-pre-wrap">
                  {lastTauriError}
                </div>
              )}
            </div>
          </AnimatePresence>
        </div>

        <div
          className="posterBlur"
          style={{ backgroundImage: `url('${posterUrl}')` }}
        ></div>
      </div>
    </div>
  );
}
