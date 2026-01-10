import { motion, AnimatePresence } from "framer-motion";

type ClearConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  useFirewall: boolean;
  useBackup: boolean;
  loading: boolean;
};

export default function ClearConfirmModal({
  open,
  onClose,
  onConfirm,
  useFirewall,
  useBackup,
  loading,
}: ClearConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="clear-confirm-modal"
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
              Очистить Hosts {useFirewall ? "& Firewall" : undefined}
            </h3>
            <p className="text-sm text-white/60 mb-4">
              Это удалит все секции и правила, добавленные приложением в файл
              hosts и в брандмауэр.{" "}
              {useBackup && "Резервная копия будет создана автоматически."} Вы
              уверены?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="btn bg-white/10 px-4 py-2 rounded"
                onClick={onClose}
              >
                Отмена
              </button>
              <button
                className="steam-btn bg-red-600 text-white px-4 py-2 rounded flex items-center w-full"
                onClick={onConfirm}
                disabled={loading}
              >
                {loading ? "Обновление данных..." : "Подтвердить"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
