import { useState, useEffect } from "react";
import { safeInvoke } from "../utils/tauriInvoke";
import type { Selections } from "../types/selections";
import type { Cluster } from "../types/cluster";

export function useHosts(
  selectedRegionId: string,
  selections: Selections,
  clusters: Cluster[]
) {
  const [hostsMismatch, setHostsMismatch] = useState(false);
  const [mismatchDomains, setMismatchDomains] = useState<string[]>([]);
  const [tauriAvailable, setTauriAvailable] = useState<boolean | null>(null);
  const [lastTauriError, setLastTauriError] = useState<string | null>(null);

  const checkHostsConsistency = async () => {
    try {
      const regionSelections = {
        [selectedRegionId]:
          selections[selectedRegionId] ??
          Object.fromEntries(clusters.map((c) => [c.domain, true])),
      };
      console.debug("check_hosts_consistency -> sending", regionSelections);
      const res: any = await safeInvoke("check_hosts_consistency", {
        selections: regionSelections,
      });
      console.debug("check_hosts_consistency -> result", res);
      setTauriAvailable(true);
      setLastTauriError(null);
      const blockedSet = new Set(
        (res?.blocked || []).map((s: string) => s.toLowerCase())
      );
      const mismatches: string[] = [];
      for (const c of clusters) {
        const localEnabled = !!(regionSelections[selectedRegionId] || {})[
          c.domain
        ];
        const hostsBlocked = blockedSet.has(c.domain.toLowerCase());
        if (hostsBlocked !== !localEnabled) mismatches.push(c.domain);
      }
      setMismatchDomains(mismatches);
      setHostsMismatch(mismatches.length > 0);
    } catch (e) {
      console.debug("check_hosts_consistency failed", e);
      setTauriAvailable(false);
      setMismatchDomains([]);
      setHostsMismatch(false);
      setLastTauriError(String(e));
    }
  };

  useEffect(() => {
    checkHostsConsistency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, selectedRegionId, clusters.length]);

  return {
    hostsMismatch,
    mismatchDomains,
    tauriAvailable,
    lastTauriError,
    checkHostsConsistency,
  };
}
