import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

type LoadingScreenProps = {
  visible: boolean;
};

export default function LoadingScreen({ visible }: LoadingScreenProps) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <Loader2 size={48} className="text-yellow-400" strokeWidth={2} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-white/80 text-lg font-medium"
        >
          Загрузка...
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-white/50 text-sm"
        >
          Инициализация приложения
        </motion.div>
      </div>
    </motion.div>
  );
}
