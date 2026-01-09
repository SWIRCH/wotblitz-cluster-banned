import { useState, useEffect, useRef } from "react";
import { safeInvoke } from "../utils/tauriInvoke";
import type { PingInfo, PingMap } from "../types/ping";
import type { Region } from "../types/cluster";
// import type { Cluster, Region } from "../types/cluster";

const PING_TIMEOUT_MS = 2000;
const PING_ATTEMPTS = 3;
const PING_ATTEMPT_DELAY_MS = 120;
const PING_CONCURRENCY = 4;
const PING_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function usePing(selectedRegion: Region | null) {
  const [pings, setPings] = useState<PingMap>({});
  const pingRunIdRef = useRef(0);

  const updateStats = (domain: string, infoPartial: Partial<PingInfo>) => {
    setPings((prev) => {
      const prevInfo = prev[domain] ?? {
        last: null,
        avg: null,
        attempts: 0,
        successes: 0,
        lossPercent: 0,
        status: "idle",
      };
      const next: PingInfo = {
        last: infoPartial.last !== undefined ? infoPartial.last : prevInfo.last,
        avg: infoPartial.avg !== undefined ? infoPartial.avg : prevInfo.avg,
        attempts:
          infoPartial.attempts !== undefined
            ? infoPartial.attempts
            : prevInfo.attempts,
        successes:
          infoPartial.successes !== undefined
            ? infoPartial.successes
            : prevInfo.successes,
        lossPercent:
          infoPartial.lossPercent !== undefined
            ? infoPartial.lossPercent
            : prevInfo.lossPercent,
        status: infoPartial.status ?? prevInfo.status,
      };
      return { ...prev, [domain]: next };
    });
  };

  const pingClusters = async (_regionId?: string) => {
    const runId = ++pingRunIdRef.current;
    const region = selectedRegion;
    if (!region) return;
    const targets = region.clusters ?? [];

    const tasks = targets.map((c) => async () => {
      const domain = c.domain;
      updateStats(domain, {
        last: null,
        avg: null,
        attempts: 0,
        successes: 0,
        lossPercent: 0,
        status: "running",
      });

      let successes = 0;
      let totalMs = 0;
      for (let i = 0; i < PING_ATTEMPTS; i++) {
        if (runId !== pingRunIdRef.current) {
          updateStats(domain, { status: "cancelled" });
          return;
        }
        try {
          const res: any = await safeInvoke("ping_server", {
            hostname: domain,
            timeout_ms: PING_TIMEOUT_MS,
          });
          const ms = typeof res?.ping === "number" ? res.ping : null;
          const errMsg = typeof res?.error === "string" ? res.error : undefined;
          if (ms !== null) {
            successes++;
            totalMs += ms;
          }
          const avg = successes ? Math.round(totalMs / successes) : null;
          const lossPercent = Math.round(((i + 1 - successes) / (i + 1)) * 100);
          updateStats(domain, {
            last: ms,
            avg,
            attempts: i + 1,
            successes,
            lossPercent,
            status: res?.status ?? "ok",
            lastError: errMsg,
          });
        } catch (e) {
          const lossPercent = Math.round(((i + 1 - successes) / (i + 1)) * 100);
          updateStats(domain, {
            last: null,
            avg: successes ? Math.round(totalMs / successes) : null,
            attempts: i + 1,
            successes,
            lossPercent,
            status: "error",
            lastError: String(e),
          });
        }
        await new Promise((r) => setTimeout(r, PING_ATTEMPT_DELAY_MS));
      }

      const finalAvg = successes ? Math.round(totalMs / successes) : null;
      const finalLoss = Math.round(
        ((PING_ATTEMPTS - successes) / PING_ATTEMPTS) * 100
      );
      updateStats(domain, {
        avg: finalAvg,
        lossPercent: finalLoss,
        status: successes ? "ok" : "failed",
      });
    });

    let idx = 0;
    const workers: Promise<void>[] = new Array(
      Math.min(PING_CONCURRENCY, tasks.length)
    )
      .fill(null)
      .map(async () => {
        while (idx < tasks.length) {
          const i = idx++;
          await tasks[i]();
          if (runId !== pingRunIdRef.current) return;
        }
      });

    await Promise.all(workers);
  };

  useEffect(() => {
    if (!selectedRegion) return;
    pingClusters();
    const id = setInterval(() => pingClusters(), PING_REFRESH_INTERVAL_MS);
    return () => {
      pingRunIdRef.current++;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion?.id]);

  return { pings, pingClusters };
}
