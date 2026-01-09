import { Checkbox } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import type { Cluster } from "../../types/cluster";
import type { PingMap } from "../../types/ping";

export default function ClusterList({
  clusters,
  checkedMap = {},
  onToggle,
  pings = {},
}: {
  clusters: Cluster[];
  checkedMap?: Record<string, boolean>;
  onToggle?: (domain: string, checked: boolean) => void;
  pings?: PingMap;
}) {
  return (
    <div className="ban-clusters-2-container">
      <AnimatePresence>
        {clusters.map((c) => (
          <motion.div
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="w-full mt-2"
            key={c.domain}
          >
            <div
              className="rounded-xl p-6 sm:p-4 relative w-full"
              style={
                pings &&
                pings[c.domain] &&
                (pings[c.domain].status !== "ok" ||
                  pings[c.domain].lossPercent === 100)
                  ? { background: "#ff00001c" }
                  : undefined
              }
            >
              <div className="flex items-center">
                <span className="font-semibold text-3xl text-white">
                  {c.id}
                </span>
                <hr className="vertical" />
                <div className="text-sm text-white/50 m-0">
                  {c.location ?? "Unknown Location"}
                  <br />
                  {(() => {
                    const p = pings[c.domain];
                    if (!p) return "—";
                    const avg = p.avg;
                    const display =
                      avg !== null && avg !== undefined ? `${avg} ms` : "—";
                    const cls =
                      avg === null || avg === undefined
                        ? "text-white/50"
                        : avg <= 50
                        ? "text-green-400"
                        : avg >= 105
                        ? "text-red-400"
                        : "text-yellow-400";
                    return (
                      <span>
                        <span className={cls}>{display}</span>{" "}
                        <span className="text-white/50">
                          ({p.lossPercent}% loss)
                        </span>
                      </span>
                    );
                  })()}
                </div>
                <div className="absolute right-4">
                  <Checkbox
                    checked={!!checkedMap[c.domain]}
                    onChange={(val) => onToggle && onToggle(c.domain, val)}
                    className="flex size-6 group rounded-md bg-white/10 p-1 ring-white/15 focus:not-data-focus:outline-none data-checked:bg-white data-focus:outline data-focus:outline-offset-2 data-focus:outline-white"
                  >
                    <svg
                      className="stroke-white opacity-0 group-data-checked:opacity-100"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        d="M3 8L6 11L11 3.5"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Checkbox>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
