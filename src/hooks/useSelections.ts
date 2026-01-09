import { useState, useEffect } from "react";
import {
  loadSelections,
  saveSelections,
  clearSelections,
} from "../utils/selectionStorage";
import type { Selections } from "../types/selections";
import type { Game } from "../types/cluster";

export function useSelections(game: Game) {
  const [selections, setSelections] = useState<Selections>({});

  useEffect(() => {
    loadSelections().then(async (s) => {
      const initial = s || {};
      if (Object.keys(initial).length === 0) {
        // First run — default all clusters to enabled (true)
        const defaults: Selections = {};
        for (const region of game.clusters) {
          defaults[region.id] = Object.fromEntries(
            (region.clusters ?? []).map((c) => [c.domain, true])
          );
        }
        await saveSelections(defaults);
        setSelections(defaults);
      } else {
        setSelections(initial);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSelection = (
    regionId: string,
    domain: string,
    checked: boolean
  ) => {
    setSelections((prev) => {
      const prevRegion = prev[regionId] ?? {};
      const newRegion = { ...prevRegion, [domain]: checked };
      const next = { ...prev, [regionId]: newRegion };
      saveSelections(next);
      return next;
    });
  };

  const selectCluster = (regionId: string, domain: string, clusters: any[]) => {
    setSelections((prev) => {
      const newRegion = Object.fromEntries(
        clusters.map((c) => [c.domain, c.domain === domain])
      );
      const next = { ...prev, [regionId]: newRegion };
      saveSelections(next);
      return next;
    });
  };

  const clearAllSelections = async () => {
    await clearSelections();
    const defaults: Selections = {};
    for (const region of game.clusters) {
      defaults[region.id] = Object.fromEntries(
        (region.clusters ?? []).map((c) => [c.domain, true])
      );
    }
    setSelections(defaults);
    await saveSelections(defaults);
  };

  return {
    selections,
    setSelections,
    updateSelection,
    selectCluster,
    clearAllSelections,
  };
}
