import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

type BlockingAllConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  regionName: string;
};

export default function BlockingAllConfirmModal({
  open,
  onClose,
  onConfirm,
  regionName,
}: BlockingAllConfirmModalProps) {
  const [ack, setAck] = useState(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="blocking-all-confirm-modal"
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
              Подтвердите блокировку всех серверов
            </h3>
            <p className="text-sm text-white/60 mb-4">
              Вы собираетесь заблокировать <strong>все</strong> серверы региона{" "}
              <strong>{regionName}</strong>. Это приведёт к тому, что игра не
              сможет подключаться к серверам этого региона — вы фактически
              отключите доступ к игре в этом регионе.
            </p>

            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              <span className="text-sm text-white/60">
                Я понимаю, что это отключит доступ к игре в этом регионе
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <button
                className="btn bg-white/10 px-4 py-2 rounded"
                onClick={onClose}
              >
                Отмена
              </button>
              <button
                className="steam-btn bg-red-600 text-white px-4 py-2 rounded"
                disabled={!ack}
                onClick={() => {
                  onConfirm();
                  setAck(false);
                }}
              >
                Подтвердить блокировку
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
