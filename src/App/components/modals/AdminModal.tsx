import { motion, AnimatePresence } from "framer-motion";

type AdminModalProps = {
  open: boolean;
  onShowInstructions: () => void;
};

export default function AdminModal({
  open,
  onShowInstructions,
}: AdminModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="admin-modal"
          className="modal fixed inset-0 z-1000 flex items-center justify-center"
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
              Требуются права администратора
            </h3>
            <p className="text-sm text-white/60 mb-4">
              Приложение не обладает правами для изменения системного файла
              hosts. Чтобы использовать функциональность
              блокировки/разблокировки серверов, запустите приложение с правами
              администратора.
            </p>

            <div className="flex justify-end gap-2">
              <button
                className="steam-btn bg-yellow-400 text-black px-4 py-2 rounded"
                onClick={onShowInstructions}
              >
                Инструкция
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
