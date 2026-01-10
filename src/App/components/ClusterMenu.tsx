import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Cluster } from "../../types/cluster";
import type { PingMap } from "../../types/ping";

export default function ClusterMenu({
  clusters,
  selectedDomain,
  onSelect,
  pings = {},
}: {
  clusters: Cluster[];
  selectedDomain?: string;
  onSelect?: (domain: string) => void;
  pings?: PingMap;
}) {
  const selected =
    clusters.find((c) => c.domain === selectedDomain) ?? clusters[0];

  console.log(selectedDomain);

  return (
    <Menu>
      <MenuButton className="dropdownButton flex items-center gap-2">
        <div className="server-select flex items-center gap-2">
          <img width={25} height={25} src={`Games/444200/mini.png`} />
          <div className="flex items-center">
            <h3>{selected ? `${selected.id} - ${selected.domain}` : "—"}</h3>
            <span className="mx-1">—</span>
            {(() => {
              const avg = pings[selected?.domain ?? ""]?.avg;
              const display =
                avg !== null && avg !== undefined
                  ? `${avg} ms`
                  : selected?.latency ?? "5000 ms";
              const cls =
                avg === null || avg === undefined
                  ? "text-white/60"
                  : avg <= 50
                  ? "text-green-400"
                  : avg >= 105
                  ? "text-red-400"
                  : "text-yellow-400";
              return <span className={cls}>{display}</span>;
            })()}
          </div>
          <ChevronDown size={20} strokeWidth={1.5} absoluteStrokeWidth />
        </div>
      </MenuButton>
      <MenuItems
        anchor="bottom"
        transition
        className={
          "dropdown_items origin-top transition duration-200 ease-out data-closed:scale-95 data-closed:opacity-0"
        }
      >
        <AnimatePresence>
          {clusters.map((c) => (
            <MenuItem key={c.domain}>
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                style={
                  pings &&
                  pings[c.domain] &&
                  (pings[c.domain].status !== "ok" ||
                    pings[c.domain].lossPercent === 100)
                    ? { background: "#ff00001c" }
                    : undefined
                }
              >
                <div
                  className="dropdownInteractiveItem flex items-center gap-2"
                  onClick={() => onSelect && onSelect(c.domain)}
                >
                  <img width={22} height={22} src="Games/444200/mini.png" />
                  <div className="flex items-center">
                    <span>{`${c.id} - ${c.domain}`}</span>
                    <span className="mx-1">—</span>
                    {(() => {
                      const avg = pings[c.domain]?.avg;
                      const display =
                        avg !== null && avg !== undefined
                          ? `${avg} ms`
                          : c.latency ?? "5000 ms";
                      const cls =
                        avg === null || avg === undefined
                          ? "text-white/60"
                          : avg <= 50
                          ? "text-green-400"
                          : avg >= 105
                          ? "text-red-400"
                          : "text-yellow-400";
                      return <span className={cls}>{display}</span>;
                    })()}
                  </div>
                </div>
              </motion.div>
            </MenuItem>
          ))}
        </AnimatePresence>
      </MenuItems>
    </Menu>
  );
}
