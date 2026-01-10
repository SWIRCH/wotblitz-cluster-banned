import { motion, AnimatePresence } from "framer-motion";
import type { Cluster } from "../../../types/cluster";

type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  domains: string[];
  clusters: Cluster[];
  regionName: string;
  onBlockingAllConfirm: () => void;
};

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  domains,
  clusters,
  regionName,
  onBlockingAllConfirm,
}: ConfirmModalProps) {
  const isBlockingAll = domains.length === clusters.length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-modal"
          className="modal fixed inset-0 z-50 flex items-center justify-center"
        >
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="backdrop-blur-2xl rounded-xl bg-white/5 p-6 sm:p-4 relative w-[min(600px,90%)] "
            initial={{ opacity: 0, y: 8, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.995 }}
            transition={{ duration: 0.18 }}
          >
            <h3 className="text-lg font-semibold mb-2">
              Подтвердите обновление hosts
            </h3>
            <p className="text-sm text-white/60 mb-4">
              Будут добавлены записи типа <code>0.0.0.0 domain</code> для
              следующих доменов в регионе <strong>{regionName}</strong>:
            </p>

            {isBlockingAll && (
              <div className="mb-3 p-3 rounded bg-red-900/20 border border-red-700 text-sm text-red-200">
                <strong>Внимание:</strong> Вы собираетесь заблокировать{" "}
                <strong>все</strong> серверы региона{" "}
                <strong>{regionName}</strong>. Это приведёт к тому, что игра не
                сможет подключаться к серверам этого региона — вы фактически
                отключите доступ к игре в этом регионе.
              </div>
            )}
            <div className="max-h-48 overflow-auto mb-4 bg-white/5 p-3 rounded">
              {domains.length === 0 ? (
                <div className="text-sm">Нет доменов для обновления.</div>
              ) : (
                <ul className="text-sm list-disc pl-5">
                  <AnimatePresence>
                    {domains.map((d) => (
                      <motion.li
                        key={d}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.12 }}
                      >
                        {d}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {isBlockingAll && (
              <div className="mb-3 text-sm text-red-200">
                Это действие полностью отключит доступ к серверам выбранного
                региона — будьте осторожны.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                className="btn bg-white/10 px-4 py-2 rounded"
                onClick={onClose}
              >
                Отмена
              </button>
              <button
                className={`steam-btn px-4 py-2 rounded ${
                  isBlockingAll
                    ? "bg-red-600 text-white"
                    : "bg-yellow-400 text-black"
                }`}
                onClick={() => {
                  if (isBlockingAll) {
                    onBlockingAllConfirm();
                  } else {
                    onConfirm();
                  }
                }}
              >
                Подтвердить
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
