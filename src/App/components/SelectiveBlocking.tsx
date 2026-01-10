import ClusterList from "./ClusterList";
import type { Cluster } from "../../types/cluster";
import type { PingMap } from "../../types/ping";
// import type { Selections } from "../../types/selections";

type SelectiveBlockingProps = {
  clusters: Cluster[];
  checkedMap: Record<string, boolean>;
  onToggle: (domain: string, checked: boolean) => void;
  pings: PingMap;
};

export default function SelectiveBlocking({
  clusters,
  checkedMap,
  onToggle,
  pings,
}: SelectiveBlockingProps) {
  const domainSet = new Set(clusters.map((c) => c.domain));
  const regionPings = Object.entries(pings)
    .filter(([k]) => domainSet.has(k))
    .map(([, v]) => v);

  const vals = regionPings.filter((p) => p.avg !== null);
  const avg = vals.length
    ? Math.round(vals.reduce((s, x) => s + (x.avg || 0), 0) / vals.length)
    : null;
  const ok = regionPings.filter((p) => p.status === "ok").length;
  const total = clusters.length;

  return (
    <div className="whilecard mt-5">
      <div className="flex sticky top-0 justify-between items-center space-y-1 rounded-xl bg-white/5 p-1 sm:p-2">
        <h3>Выборочная блокировка</h3>

        {clusters.length > 0 && (
          <div className="text-xs text-white/60">
            <span>
              Avg Ping: {avg ? `${avg} ms` : "—"} ({ok}/{total} ok)
            </span>
          </div>
        )}
      </div>
      <div className="content p-0 relative">
        <div className="ban-clusters-2 mt-1 scrollbarYAuto">
          <ClusterList
            clusters={clusters}
            checkedMap={checkedMap}
            onToggle={onToggle}
            pings={pings}
          />
        </div>
      </div>
    </div>
  );
}
