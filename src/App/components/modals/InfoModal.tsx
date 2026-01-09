import { motion, AnimatePresence } from "framer-motion";

type InfoModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  isError?: boolean;
};

export default function InfoModal({
  open,
  onClose,
  title,
  message,
  isError = false,
}: InfoModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="info-modal"
          className="fixed inset-0 z-60 flex items-center justify-center"
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
            <h3
              className={
                "text-lg font-semibold mb-2 " +
                (isError ? "text-red-400" : "text-green-400")
              }
            >
              {title}
            </h3>
            <p className="text-sm text-white/60 mb-4 whitespace-pre-wrap">
              {message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="steam-btn bg-yellow-400 text-black px-4 py-2 rounded"
                onClick={onClose}
              >
                ОК
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
