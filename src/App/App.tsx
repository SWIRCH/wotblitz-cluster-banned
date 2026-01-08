import { Check, ChevronDown } from "lucide-react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clustersData from "../data/servers.json";
import ClusterMenu from "./components/ClusterMenu";
import ClusterList from "./components/ClusterList";
import { config } from "../utils/config";
import {
  loadSelections,
  saveSelections,
  clearSelections,
} from "../utils/selectionStorage";
import {
  safeInvoke,
  launchGame,
  isProcessRunning,
  killProcess,
} from "../utils/tauriInvoke";
import {
  loadSettings,
  saveSingleSetting,
  type AppSettings,
} from "../utils/settingsStorage";
import { openAuthorLink } from "../utils/opener";

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    return loadSettings();
  });

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      saveSingleSetting(key, value);
      return updated;
    });
  };

  // const updateSettings = (newSettings: Partial<AppSettings>) => {
  //   setSettings((prev) => {
  //     const updated = { ...prev, ...newSettings };
  //     saveSettings(updated);
  //     return updated;
  //   });
  // };

  const game = clustersData as any; // JSON contains top-level game info

  // default to EU if present, else first region
  const defaultRegion =
    game.clusters.find((c: any) => c.id === "wot_eu") ?? game.clusters[0];
  const [selectedRegionId, setSelectedRegionId] = useState<string>(
    defaultRegion?.id ?? ""
  );

  const selectedRegion =
    game.clusters.find((c: any) => c.id === selectedRegionId) ?? defaultRegion;
  const clusters = selectedRegion?.clusters ?? [];

  const [selections, setSelections] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [hostsMismatch, setHostsMismatch] = useState(false);

  // const [useFirewall, setUseFirewall] = useState(true);
  // const [useBackup, setUseBackup] = useState(false);

  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDomains, setConfirmDomains] = useState<string[]>([]);

  // Clear confirmation modal
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // Blocking-all extra confirmation (requires explicit ACK)
  const [blockingAllConfirmOpen, setBlockingAllConfirmOpen] = useState(false);
  const [blockingAllAck, setBlockingAllAck] = useState(false);

  // Informational modal (for success / errors)
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTitle, setInfoTitle] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [infoIsError, setInfoIsError] = useState(false);

  const [LoadingConfirmButton_ls, setLoadingConfirmButton_ls] = useState(false);

  // Debugging / status
  const [tauriAvailable, setTauriAvailable] = useState<boolean | null>(null); // null = unknown
  const [mismatchDomains, setMismatchDomains] = useState<string[]>([]);
  const [lastTauriError, setLastTauriError] = useState<string | null>(null);

  // const [networkDebug, setNetworkDebug] = useState<any>(null);

  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);

  // Modals
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Admin/elevation modal
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [_adminChecked, setAdminChecked] = useState(false);
  // Ping results (per-host stats)
  type PingInfo = {
    last: number | null;
    avg: number | null;
    attempts: number;
    successes: number;
    lossPercent: number;
    status: string;
    lastError?: string;
  };
  const [pings, setPings] = useState<Record<string, PingInfo>>({});

  // Ping config
  const PING_TIMEOUT_MS = 2000; // per-attempt timeout
  const PING_ATTEMPTS = 3; // attempts per host
  const PING_ATTEMPT_DELAY_MS = 120; // delay between attempts for same host
  const PING_CONCURRENCY = 4; // number of hosts pinged in parallel
  const PING_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

  // Poster selection (pick a random poster from game.posters on startup)
  const [posterUrl, setPosterUrl] = useState<string>(
    (game as any).posters && (game as any).posters.length > 0
      ? (game as any).posters[0]
      : "/Games/444200/coaav5.jpg"
  );

  useEffect(() => {
    try {
      const posters = (game as any).posters;
      if (Array.isArray(posters) && posters.length > 0) {
        const idx = Math.floor(Math.random() * posters.length);
        setPosterUrl(posters[idx]);
      }
    } catch (err) {
      // ignore
    }
  }, []);

  const checkHostsNow = async () => {
    try {
      const regionSelections = {
        [selectedRegionId]:
          selections[selectedRegionId] ??
          Object.fromEntries(clusters.map((c: any) => [c.domain, true])),
      };
      console.debug(
        "check_hosts_consistency -> sending (manual)",
        regionSelections
      );
      const res: any = await safeInvoke("check_hosts_consistency", {
        selections: regionSelections,
      });
      console.debug("check_hosts_consistency -> result (manual)", res);
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
      console.debug("check_hosts_consistency failed (manual)", e);
      setTauriAvailable(false);
      setMismatchDomains([]);
      setHostsMismatch(false);
      setLastTauriError(String(e));
    }
  };

  useEffect(() => {
    loadSelections().then(async (s) => {
      const initial = s || {};
      if (Object.keys(initial).length === 0) {
        // First run — default all clusters to enabled (true)
        const defaults: Record<string, Record<string, boolean>> = {};
        for (const region of game.clusters) {
          defaults[region.id] = Object.fromEntries(
            (region.clusters ?? []).map((c: any) => [c.domain, true])
          );
        }
        await saveSelections(defaults);
        setSelections(defaults);

        // Immediately check hosts consistency using the defaults we just created
        (async () => {
          try {
            const regionSelections = {
              [selectedRegionId]:
                defaults[selectedRegionId] ??
                Object.fromEntries(clusters.map((c: any) => [c.domain, true])),
            };
            const res: any = await safeInvoke("check_hosts_consistency", {
              selections: regionSelections,
            });
            setTauriAvailable(true);
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
            console.debug("initial check_hosts_consistency failed", e);
            setTauriAvailable(false);
            setMismatchDomains([]);
            setHostsMismatch(false);
          }
        })();
      } else {
        setSelections(initial);

        // Immediately check hosts consistency using the loaded selections
        (async () => {
          try {
            const regionSelections = {
              [selectedRegionId]:
                initial[selectedRegionId] ??
                Object.fromEntries(clusters.map((c: any) => [c.domain, true])),
            };
            const res: any = await safeInvoke("check_hosts_consistency", {
              selections: regionSelections,
            });
            setTauriAvailable(true);
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
            console.debug("initial check_hosts_consistency failed", e);
            setTauriAvailable(false);
            setMismatchDomains([]);
            setHostsMismatch(false);
          }
        })();
      }

      // After loading selections and initial checks, verify elevation
      (async () => {
        try {
          const ev: any = await safeInvoke("check_elevation");
          if (ev && ev.isAdmin === false) {
            setAdminModalOpen(true);
          }
          setAdminChecked(true);
        } catch (e) {
          console.debug("check_elevation failed", e);
          setAdminChecked(true);
        }
      })();
    });

    // On app open, do a one-shot check whether the game is running (user requested behavior)
    (async () => {
      await checkGameRunning();
    })();
  }, []);

  const regionMap = selections[selectedRegionId] ?? {};

  const selectedDomain =
    Object.keys(regionMap).find((k) => regionMap[k]) ?? clusters[0]?.domain;

  // Re-check hosts for the currently selected region (delegate to Rust via Tauri invoke)
  useEffect(() => {
    (async () => {
      try {
        const regionSelections = {
          [selectedRegionId]:
            selections[selectedRegionId] ??
            Object.fromEntries(clusters.map((c: any) => [c.domain, true])),
        };
        console.debug("check_hosts_consistency -> sending", regionSelections);
        const res: any = await safeInvoke("check_hosts_consistency", {
          selections: regionSelections,
        });
        console.debug("check_hosts_consistency -> result", res);
        setTauriAvailable(true);
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
      }
    })();
  }, [selections, selectedRegionId]);

  const handleSelectCluster = (domain: string) => {
    setSelections((prev) => {
      const newRegion = Object.fromEntries(
        clusters.map((c: any) => [c.domain, c.domain === domain])
      );
      const next = { ...prev, [selectedRegionId]: newRegion };
      saveSelections(next);
      return next;
    });
  };

  const handleToggleCluster = (domain: string, checked: boolean) => {
    setSelections((prev) => {
      const prevRegion = prev[selectedRegionId] ?? {};
      const newRegion = { ...prevRegion, [domain]: checked };
      const next = { ...prev, [selectedRegionId]: newRegion };
      saveSelections(next);
      return next;
    });
  };

  const applyHostsUpdate = async (blockedDomains?: string[]) => {
    // Use provided domains (confirmation) or compute for current region
    let domains =
      blockedDomains ??
      (() => {
        const rmap =
          selections[selectedRegionId] ??
          Object.fromEntries(clusters.map((c: any) => [c.domain, true]));
        return clusters
          .filter((c: any) => !rmap[c.domain])
          .map((c: any) => c.domain);
      })();

    let isRemoval = false;
    if (domains.length === 0) {
      // No domains to block — but maybe we need to *remove* existing blocks (unblock all) for this region.
      try {
        const allBlocked: any = await safeInvoke("read_blocked_domains");
        const blockedSet = new Set(
          (allBlocked || []).map((s: string) => s.toLowerCase())
        );
        const toRemove = clusters
          .filter((c: any) => blockedSet.has(c.domain.toLowerCase()))
          .map((c: any) => c.domain);
        if (toRemove.length === 0) {
          setInfoTitle("Нет доменов для обновления");
          setInfoMessage("В текущем регионе нет доменов для обновления.");
          setInfoIsError(false);
          setInfoOpen(true);
          setConfirmOpen(false);
          return;
        }
        // Replace domains with the list to remove (unblock)
        domains = toRemove;
        isRemoval = true;
      } catch (e) {
        setInfoTitle("Не удалось проверить hosts");
        setInfoMessage(String(e));
        setInfoIsError(true);
        setInfoOpen(true);
        setConfirmOpen(false);
        return;
      }
    }

    try {
      let updateRes: any;
      let firewallRes: any = null;

      // Обновляем hosts файл
      updateRes = isRemoval
        ? await safeInvoke("update_hosts_block", {
            blocked_domains: domains,
            remove: true,
            region: selectedRegionId,
            backupSaved: settings.useBackup,
          })
        : await safeInvoke("update_hosts_block", {
            blocked_domains: domains,
            region: selectedRegionId,
            backupSaved: settings.useBackup,
          });

      // Если включен брандмауэр, обновляем и правила брандмауэра
      if (settings.useFirewall) {
        console.log({
          selectedRegionId,
          domains,
        });
        try {
          // Нужно импортировать функцию updateFirewallRules
          const { updateFirewallRules } = await import("../utils/tauriInvoke");
          firewallRes = await updateFirewallRules(
            selectedRegionId,
            domains,
            !isRemoval // enable = true если блокируем, false если разблокируем
          );
        } catch (firewallError) {
          console.error("Firewall update failed:", firewallError);
          // Не прерываем выполнение, просто показываем предупреждение
          firewallRes = `Предупреждение: не удалось обновить брандмауэр: ${firewallError}`;
        }
      }

      // Формируем сообщение об успехе
      let successMessage = "";
      if (settings.useFirewall && firewallRes) {
        successMessage = `
✅ Hosts файл обновлен:
${updateRes}
        
✅ Правила брандмауэра ${isRemoval ? "удалены" : "добавлены"}:
${firewallRes}
        
Изменения применены на уровне сети (блокировка по IP).
      `;
      } else {
        successMessage = `
✅ Hosts файл обновлен:
${updateRes}
        
ℹ️ Брандмауэр не использовался.
${
  settings.useFirewall
    ? "(не удалось применить правила брандмауэра)"
    : "(отключен в настройках)"
}
      `;
      }

      setInfoTitle(isRemoval ? "Разблокировано" : "Заблокировано");
      setInfoMessage(successMessage.trim());
      setInfoIsError(false);
      setInfoOpen(true);
      setConfirmOpen(false);

      // Перепроверяем статус hosts
      const rmap =
        selections[selectedRegionId] ??
        Object.fromEntries(clusters.map((c: any) => [c.domain, true]));
      const regionSelections = { [selectedRegionId]: rmap };
      const res: any = await safeInvoke("check_hosts_consistency", {
        selections: regionSelections,
      });
      setHostsMismatch(res?.mismatch ?? false);
    } catch (e) {
      let errorMessage = String(e);
      let errorTitle = "Ошибка обновления";

      if (settings.useFirewall) {
        errorTitle = "Ошибка обновления правил";
        errorMessage = `
        ❌ Не удалось применить изменения:
        
        ${errorMessage}
        
        Возможно, требуются права администратора для изменения правил брандмауэра.
        Попробуйте запустить приложение от имени администратора.
      `;
      }

      setInfoTitle(errorTitle);
      setInfoMessage(errorMessage.trim());
      setInfoIsError(true);
      setInfoOpen(true);
      setConfirmOpen(false);
    }
  };

  const clearCluster = async () => {
    try {
      let messages = [];

      setLoadingConfirmButton_ls(true);

      // Очищаем hosts
      const hostsRes: any = await safeInvoke("clear_cluster_blocks", {
        backupSaved: settings.useBackup,
      });
      messages.push(hostsRes);

      // Очищаем брандмауэр если он использовался
      if (settings.useFirewall) {
        try {
          const { clearFirewallRules } = await import("../utils/tauriInvoke");
          const fwRes = await clearFirewallRules();
          messages.push(`Брандмауэр: ${fwRes}`);
        } catch (fwError) {
          messages.push(`Ошибка очистки брандмауэра: ${fwError}`);
        }
      }

      setInfoTitle("Всё очищено");
      setInfoMessage(messages.join("\n\n"));
      setInfoIsError(false);
      setInfoOpen(true);
      setClearConfirmOpen(false);

      // Clear saved selections so UI resets to defaults
      await clearSelections();
      // reload defaults into state
      const defaults: Record<string, Record<string, boolean>> = {};
      for (const region of game.clusters) {
        defaults[region.id] = Object.fromEntries(
          (region.clusters ?? []).map((c: any) => [c.domain, true])
        );
      }
      setLoadingConfirmButton_ls(false);
      setSelections(defaults);
      await saveSelections(defaults);

      // Update UI status
      checkHostsNow();

      // Clear ping results too
      setPings({});
      await pingClusters(selectedRegionId);
      await checkGameRunning();
    } catch (e) {
      setInfoTitle("Ошибка очистки");
      setInfoMessage(String(e));
      setInfoIsError(true);
      setInfoOpen(true);
    }
  };

  // Ping run id to allow cancelling overlapping runs
  const pingRunIdRef = useRef(0);

  // Game running state
  const [gameRunning, setGameRunning] = useState(false);
  // Candidate process name substrings to detect the game process
  const GAME_PROCESS_NAMES = ["wotblitz", "blitz", "worldoftanksblitz"];

  async function checkGameRunning() {
    try {
      for (const n of GAME_PROCESS_NAMES) {
        const res: any = await isProcessRunning(n);
        if (res === true) {
          setGameRunning(true);
          return true;
        }
      }
      setGameRunning(false);
      return false;
    } catch (e) {
      console.debug("checkGameRunning failed", e);
      setGameRunning(false);
      return false;
    }
  }

  // Auto-run ping on mount and when region changes, but with low frequency
  useEffect(() => {
    // initial ping
    pingClusters(selectedRegionId);
    // periodic refresh
    const id = setInterval(
      () => pingClusters(selectedRegionId),
      PING_REFRESH_INTERVAL_MS
    );

    // No continuous polling for game status here — we only check on-demand.

    return () => {
      // bump run id to cancel pending work
      pingRunIdRef.current++;
      clearInterval(id);
    };
  }, [selectedRegionId]);

  // pingClusters implementation with concurrency and per-host attempts
  async function pingClusters(regionId?: string) {
    const runId = ++pingRunIdRef.current;
    const rid = regionId ?? selectedRegionId;
    const region =
      game.clusters.find((c: any) => c.id === rid) ?? defaultRegion;
    const targets = region?.clusters ?? [];

    // utility to update pings incrementally
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
          last:
            infoPartial.last !== undefined ? infoPartial.last : prevInfo.last,
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

    // create per-host worker tasks
    const tasks = targets.map((c: any) => async () => {
      const domain = c.domain;
      // reset host entry
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
        // abort if new run started
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
        // delay between attempts
        await new Promise((r) => setTimeout(r, PING_ATTEMPT_DELAY_MS));
      }

      // final status
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

    // run tasks with concurrency limit
    let idx = 0;
    const workers: Promise<void>[] = new Array(
      Math.min(PING_CONCURRENCY, tasks.length)
    )
      .fill(null)
      .map(async () => {
        while (idx < tasks.length) {
          const i = idx++;
          await tasks[i]();
          // abort early if run changed
          if (runId !== pingRunIdRef.current) return;
        }
      });

    await Promise.all(workers);
  }

  return (
    <main className="" id="layer-ingame">
      <div className="navbar">
        <div>
          <div className="flex items-center">
            <div className="logo"></div>
            <div className="game-select flex items-center gap-2">
              <img width={25} height={25} src={game.icon} />
              <h3>{game.name}</h3>
            </div>
            <hr className="vertical" />
            <div className="game-select">
              <Menu>
                <MenuButton className="dropdownButton flex items-center gap-2">
                  <img
                    width={22}
                    height={22}
                    src={selectedRegion?.icon ?? game.icon}
                  />
                  <h3>{selectedRegion?.alias_name ?? selectedRegion?.name} </h3>
                  <ChevronDown
                    size={20}
                    strokeWidth={1.5}
                    absoluteStrokeWidth
                  />
                </MenuButton>
                <MenuItems
                  anchor="bottom"
                  transition
                  className={
                    "dropdown_items origin-top transition duration-200 ease-out data-closed:scale-95 data-closed:opacity-0 flex justify-between items-center space-y-1 rounded-xl"
                  }
                >
                  {game.clusters.map((region: any) => (
                    <MenuItem key={region.id}>
                      <div
                        className="dropdownInteractiveItem flex items-center gap-2"
                        onClick={() => setSelectedRegionId(region.id)}
                      >
                        <img
                          width={22}
                          height={22}
                          src={region.icon}
                          className={
                            region.id === selectedRegionId ? "rounded-full" : ""
                          }
                        />
                        <span>{region.name}</span>
                      </div>
                    </MenuItem>
                  ))}
                </MenuItems>
              </Menu>
            </div>
          </div>
        </div>
        <div>
          {/* <div className="text-xs text-gray-400">
            Firewall enabled: {settings.useFirewall ? "Yes" : "No"}
            {settings.useFirewall ? " (Available)" : " (Not available)"}
          </div> */}
          <small>
            <span className="cursor-pointer" onClick={() => openAuthorLink()}>
              {config.AUTHOR}@{config.BREACH} {config.VERSION}
            </span>
          </small>
        </div>
      </div>
      <div className="inGameContainer">
        <div className="inGamePoster">
          <div id="poster" style={{ backgroundImage: `url('${posterUrl}')` }}>
            <div className="gameStatus">
              <div className="statusE">
                <div className="text-[12px]">
                  <AnimatePresence>
                    {tauriAvailable === true && hostsMismatch === false && (
                      <motion.div
                        key="hosts-ok"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-1"
                      >
                        <Check
                          size={12}
                          stroke="#05df72"
                          strokeWidth={1.5}
                          absoluteStrokeWidth
                        />
                        <span className="text-green-400">Hosts в порядке</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="statusE">
                <div className="text-[12px] cursor-pointer">
                  <div className="flex items-center gap-1">
                    <button
                      className="text-red-400 text-xs"
                      onClick={() => setClearConfirmOpen(true)}
                    >
                      Очистить блокировки
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="gameButtons rounded-xl bg-white/5 backdrop-blur-2xl p-4 sm:p-4 relative w-full">
              <AnimatePresence mode="wait">
                <div className="relative w-full h-12 flex items-center mt-1 gap-2">
                  {hostsMismatch ? (
                    <motion.button
                      key="update-btn"
                      className="steam-btn btnposition bg-yellow-400 text-black absolute left-0 right-0 top-1/2 -translate-y-1/2"
                      initial={{ opacity: 0, y: 8, scale: 0.995 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.995 }}
                      transition={{ duration: 0.18 }}
                      onClick={() => {
                        const rmap =
                          selections[selectedRegionId] ??
                          Object.fromEntries(
                            clusters.map((c: any) => [c.domain, true])
                          );
                        const blockedDomains = clusters
                          .filter((c: any) => !rmap[c.domain])
                          .map((c: any) => c.domain);
                        setConfirmDomains(blockedDomains);
                        setConfirmOpen(true);
                      }}
                      aria-label={`Обновить hosts для ${
                        selectedRegion?.alias_name ?? selectedRegion?.name
                      }`}
                    >
                      {`Обновить блок (${
                        selectedRegion?.alias_name ?? selectedRegion?.name
                      })`}
                    </motion.button>
                  ) : (
                    // Play / Close button (launch via Steam protocol, track running state)
                    <motion.button
                      key="play-btn"
                      className={`steam-btn btnposition absolute left-0 right-0 top-1/2 -translate-y-1/2 ${
                        gameRunning ? "bg-red-600 text-white" : ""
                      }`}
                      initial={{ opacity: 0, y: 8, scale: 0.995 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.995 }}
                      transition={{ duration: 0.18 }}
                      onClick={async () => {
                        try {
                          if (gameRunning) {
                            // try to kill by known name(s)
                            const names = [
                              "wotblitz",
                              "blitz",
                              "worldoftanksblitz",
                            ];
                            for (const n of names) {
                              try {
                                await killProcess(n);
                              } catch (e) {
                                // ignore
                              }
                            }
                            setInfoTitle("Закрытие игры");
                            setInfoMessage(
                              "Попытка закрыть процесс игры (если он был запущен)"
                            );
                            setInfoIsError(false);
                            setInfoOpen(true);
                            // force a re-check
                            setTimeout(() => checkGameRunning(), 1200);
                          } else {
                            // launch via Steam
                            try {
                              await launchGame("444200");
                              setInfoTitle("Запуск...");
                              setInfoMessage(
                                "Запрос на запуск отправлен: Steam будет открыт."
                              );
                              setInfoIsError(false);
                              setInfoOpen(true);
                              // re-check shortly
                              setTimeout(() => checkGameRunning(), 10000);
                            } catch (e) {
                              setInfoTitle("Не удалось запустить игру");
                              setInfoMessage(String(e));
                              setInfoIsError(true);
                              setInfoOpen(true);
                            }
                          }
                        } catch (err) {
                          setInfoTitle("Ошибка");
                          setInfoMessage(String(err));
                          setInfoIsError(true);
                          setInfoOpen(true);
                        }
                      }}
                    >
                      {gameRunning ? "Закрыть" : "Играть"}
                    </motion.button>
                  )}

                  {/* <motion.button
                    key="option-btn"
                    className={`steam-btn option-btn btnposition absolute left-0 right-0 top-1/2 -translate-y-1/2`}
                    initial={{ opacity: 0, y: 8, scale: 0.995 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.995 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Settings2 />
                  </motion.button> */}
                </div>
              </AnimatePresence>

              {/* Hosts status */}
              <AnimatePresence>
                <div className="mt-3 text-sm text-white/60">
                  {tauriAvailable === null && (
                    <span>Проверка host-файла...</span>
                  )}
                  {tauriAvailable === false && (
                    <span className="text-red-400">
                      Tauri недоступен — запустите desktop-приложение
                    </span>
                  )}

                  {/* {tauriAvailable === true && hostsMismatch === false && (
                  <span className="text-green-400">Hosts в порядке</span>
                )} */}

                  {tauriAvailable === true && hostsMismatch === true && (
                    <motion.span
                      key="hosts-mismatch"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="text-yellow-300 block"
                    >
                      Несоответствия: {mismatchDomains.length} —{" "}
                      {mismatchDomains.slice(0, 5).join(", ")}
                      {mismatchDomains.length > 5 ? "..." : ""}
                    </motion.span>
                  )}

                  <div className="mt-2 flex flex-wrap justify-between items-center gap-3">
                    <button
                      className="text-xs underline"
                      onClick={() => checkHostsNow()}
                    >
                      Проверить статус
                    </button>

                    <button
                      className="text-xs underline"
                      onClick={() => setSettingsModalOpen(true)}
                    >
                      Настройки
                    </button>

                    <button
                      className="text-xs underline"
                      onClick={async () => {
                        await pingClusters(selectedRegionId);
                        // Also check game status on manual refresh
                        await checkGameRunning();
                      }}
                    >
                      Обновить
                    </button>
                  </div>

                  {lastTauriError && (
                    <div className="mt-2 text-xs whitespace-pre-wrap">
                      {lastTauriError}
                    </div>
                  )}
                </div>
              </AnimatePresence>
            </div>

            {/* Confirmation modal (simple) */}
            <AnimatePresence>
              {confirmOpen && (
                <motion.div
                  key="confirm-modal"
                  className="fixed inset-0 z-50 flex items-center justify-center"
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
                      Подтвердите обновление hosts
                    </h3>
                    <p className="text-sm text-white/60 mb-4">
                      Будут добавлены записи типа <code>0.0.0.0 domain</code>{" "}
                      для следующих доменов в регионе{" "}
                      <strong>
                        {selectedRegion?.alias_name ?? selectedRegion?.name}
                      </strong>
                      :
                    </p>

                    {confirmDomains.length === clusters.length && (
                      <div className="mb-3 p-3 rounded bg-red-900/20 border border-red-700 text-sm text-red-200">
                        <strong>Внимание:</strong> Вы собираетесь заблокировать{" "}
                        <strong>все</strong> серверы региона{" "}
                        <strong>
                          {selectedRegion?.alias_name ?? selectedRegion?.name}
                        </strong>
                        . Это приведёт к тому, что игра не сможет подключаться к
                        серверам этого региона — вы фактически отключите доступ
                        к игре в этом регионе.
                      </div>
                    )}
                    <div className="max-h-48 overflow-auto mb-4 bg-white/5 p-3 rounded">
                      {confirmDomains.length === 0 ? (
                        <div className="text-sm">
                          Нет доменов для обновления.
                        </div>
                      ) : (
                        <ul className="text-sm list-disc pl-5">
                          <AnimatePresence>
                            {confirmDomains.map((d) => (
                              <motion.li
                                key={d}
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -6 }}
                                transition={{ duration: 0.12 }}
                              >
                                {d}
                              </motion.li>
                            ))}
                          </AnimatePresence>
                        </ul>
                      )}
                    </div>

                    {confirmDomains.length === clusters.length && (
                      <div className="mb-3 text-sm text-red-200">
                        Это действие полностью отключит доступ к серверам
                        выбранного региона — будьте осторожны.
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        className="btn bg-white/10 px-4 py-2 rounded"
                        onClick={() => setConfirmOpen(false)}
                      >
                        Отмена
                      </button>
                      <button
                        className={`steam-btn px-4 py-2 rounded ${
                          confirmDomains.length === clusters.length
                            ? "bg-red-600 text-white"
                            : "bg-yellow-400 text-black"
                        }`}
                        onClick={() => {
                          if (confirmDomains.length === clusters.length) {
                            setBlockingAllConfirmOpen(true);
                            setBlockingAllAck(false);
                          } else {
                            applyHostsUpdate(confirmDomains);
                          }
                        }}
                      >
                        Подтвердить
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Blocking ALL confirmation (requires explicit ACK) */}
            <AnimatePresence>
              {blockingAllConfirmOpen && (
                <motion.div
                  key="blocking-all-confirm-modal"
                  className="fixed inset-0 z-50 flex items-center justify-center"
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
                      Подтвердите блокировку всех серверов
                    </h3>
                    <p className="text-sm text-white/60 mb-4">
                      Вы собираетесь заблокировать <strong>все</strong> серверы
                      региона{" "}
                      <strong>
                        {selectedRegion?.alias_name ?? selectedRegion?.name}
                      </strong>
                      . Это приведёт к тому, что игра не сможет подключаться к
                      серверам этого региона — вы фактически отключите доступ к
                      игре в этом регионе.
                    </p>

                    <label className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        checked={blockingAllAck}
                        onChange={(e) =>
                          setBlockingAllAck(
                            (e.target as HTMLInputElement).checked
                          )
                        }
                      />
                      <span className="text-sm text-white/60">
                        Я понимаю, что это отключит доступ к игре в этом регионе
                      </span>
                    </label>

                    <div className="flex justify-end gap-2">
                      <button
                        className="btn bg-white/10 px-4 py-2 rounded"
                        onClick={() => setBlockingAllConfirmOpen(false)}
                      >
                        Отмена
                      </button>
                      <button
                        className="steam-btn bg-red-600 text-white px-4 py-2 rounded"
                        disabled={!blockingAllAck}
                        onClick={async () => {
                          setBlockingAllConfirmOpen(false);
                          await applyHostsUpdate(confirmDomains);
                        }}
                      >
                        Подтвердить блокировку
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Clear Hosts confirmation modal */}
            <AnimatePresence>
              {clearConfirmOpen && (
                <motion.div
                  key="clear-confirm-modal"
                  className="fixed inset-0 z-50 flex items-center justify-center"
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
                      Очистить Hosts{" "}
                      {settings.useFirewall ? "& Firewall" : undefined}
                    </h3>
                    <p className="text-sm text-white/60 mb-4">
                      Это удалит все секции и правила, добавленные приложением в
                      файл hosts и в брандмауэр.{" "}
                      {!!settings.useBackup &&
                        "Резервная копия будет создана автоматически."}{" "}
                      Вы уверены?
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        className="btn bg-white/10 px-4 py-2 rounded"
                        onClick={() => setClearConfirmOpen(false)}
                      >
                        Отмена
                      </button>
                      <button
                        className="steam-btn bg-red-600 text-white px-4 py-2 rounded flex items-center w-full"
                        onClick={clearCluster}
                        disabled={LoadingConfirmButton_ls}
                      >
                        {LoadingConfirmButton_ls
                          ? "Обновление данных..."
                          : "Подтвердить"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {infoOpen && (
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
                        (infoIsError ? "text-red-400" : "text-green-400")
                      }
                    >
                      {infoTitle}
                    </h3>
                    <p className="text-sm text-white/60 mb-4 whitespace-pre-wrap">
                      {infoMessage}
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        className="steam-btn bg-yellow-400 text-black px-4 py-2 rounded"
                        onClick={() => setInfoOpen(false)}
                      >
                        ОК
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Admin/Elevation modal (non-closable; requires retry or elevation) */}
            <AnimatePresence>
              {settingsModalOpen && (
                <motion.div
                  key="settings-modal"
                  className="fixed inset-0 z-1000 flex items-center justify-center"
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
                      Настройки приложения
                    </h3>

                    <p className="text-sm text-white/60 mb-4">
                      Здесь вы можете настроить параметры приложения.
                    </p>

                    <div className="mt-3 p-3 rounded bg-white/5">
                      <div className="text-sm font-medium mb-2">
                        Методы блокировки:
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={settings.useFirewall}
                          onChange={(e) =>
                            updateSetting("useFirewall", e.target.checked)
                          }
                          className="rounded"
                        />
                        <span>Использовать брандмауэр Windows</span>
                        <span className="text-green-400 text-xs">
                          (рекомендуется)
                        </span>
                      </label>

                      <div className="text-xs text-white/60 mt-1 pl-6">
                        Блокирует подключения на уровне сети. Работает даже если
                        игра использует IP напрямую. Требует прав
                        администратора.
                      </div>
                    </div>

                    <div className="mt-3 p-3 rounded bg-white/5">
                      <div className="text-sm font-medium mb-2">
                        Бекапы (резеврные копии)
                      </div>

                      <div className="">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={settings.useBackup}
                            onChange={(e) =>
                              updateSetting("useBackup", e.target.checked)
                            }
                            className="rounded"
                          />
                          <span>Создавать бекапы hosts</span>
                          <span className="text-green-400 text-xs">
                            (рекомендуется)
                          </span>
                        </label>

                        <div className="text-xs text-white/60 mt-1 pl-6">
                          После очистки создаёт файл .bak в папке с hosts.
                        </div>
                      </div>

                      <div className="">
                        {/* <label className="flex items-center gap-2 text-sm">
                          <input
                            type="number"
                            defaultValue={settings.backupCount}
                            onChange={(e) =>
                              updateSetting(
                                "backupCount",
                                Number(e.target.value)
                              )
                            }
                            className="rounded"
                          />
                          <span>Создавать бекапы hosts</span>
                          <span className="text-green-400 text-xs">
                            (рекомендуется)
                          </span>
                        </label> */}

                        <div className="relative flex flex-col mt-2">
                          <div className="text-sm mb-1.5">
                            <span>Максимальное колличество бекапов</span>
                          </div>
                          <div className="relative flex items-center">
                            <button
                              type="button"
                              id="decrement-button"
                              data-input-counter-decrement="counter-input"
                              className="flex items-center justify-center text-body bg-neutral-secondary-medium box-border border border-default-medium hover:bg-neutral-tertiary-medium hover:text-heading focus:ring-4 focus:ring-neutral-tertiary rounded-full text-sm focus:outline-none h-6 w-6"
                              onClick={() =>
                                updateSetting(
                                  "backupCount",
                                  Math.max(1, settings.backupCount) - 1
                                )
                              }
                            >
                              <svg
                                className="w-3 h-3 text-heading"
                                aria-hidden="true"
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  stroke="currentColor"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M5 12h14"
                                />
                              </svg>
                            </button>
                            <input
                              type="text"
                              id="counter-input"
                              data-input-counter
                              className="shrink-0 text-heading border-0 bg-transparent text-sm font-normal focus:outline-none focus:ring-0 max-w-[2.5rem] text-center"
                              placeholder=""
                              value={settings.backupCount}
                              required
                            />
                            <button
                              type="button"
                              id="increment-button"
                              data-input-counter-increment="counter-input"
                              className="flex items-center justify-center text-body bg-neutral-secondary-medium box-border border border-default-medium hover:bg-neutral-tertiary-medium hover:text-heading focus:ring-4 focus:ring-neutral-tertiary rounded-full text-sm focus:outline-none h-6 w-6"
                              onClick={() =>
                                updateSetting(
                                  "backupCount",
                                  Math.min(29, settings.backupCount) + 1
                                )
                              }
                            >
                              <svg
                                className="w-3 h-3 text-heading"
                                aria-hidden="true"
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  stroke="currentColor"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M5 12h14m-7 7V5"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 p-3 rounded bg-white/5">
                      <div className="text-sm font-medium mb-2">
                        Отладка и диагностика:
                      </div>

                      <button
                        className="text-xs"
                        onClick={async () => {
                          try {
                            const d: any = await import("../utils/tauriInvoke");
                            const res = await d.diagnoseTauri();
                            console.debug("diagnoseTauri -> result", res);
                            setDiagnosticInfo(JSON.stringify(res, null, 2));
                            setTauriAvailable(
                              res.invokeExists || res.windowTAURI
                            );
                          } catch (err) {
                            console.debug("diagnoseTauri failed", err);
                            setLastTauriError(String(err));
                            setTauriAvailable(false);
                          }
                        }}
                      >
                        Диагностика
                      </button>

                      <div className="text-xs text-white/60 mt-1 pl-6">
                        {diagnosticInfo ?? "Нет данных."}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        className="option-btn bg-yellow-400 text-black px-4 py-2 rounded"
                        onClick={() => {
                          // Close the admin modal then open the help/info modal
                          setSettingsModalOpen(false);
                        }}
                      >
                        Сохранить и закрыть
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Admin/Elevation modal (non-closable; requires retry or elevation) */}
            <AnimatePresence>
              {adminModalOpen && (
                <motion.div
                  key="admin-modal"
                  className="fixed inset-0 z-1000 flex items-center justify-center"
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
                      Приложение не обладает правами для изменения системного
                      файла hosts. Чтобы использовать функциональность
                      блокировки/разблокировки серверов, запустите приложение с
                      правами администратора.
                    </p>

                    <div className="flex justify-end gap-2">
                      <button
                        className="steam-btn bg-yellow-400 text-black px-4 py-2 rounded"
                        onClick={() => {
                          // Close the admin modal then open the help/info modal
                          setAdminModalOpen(false);
                          setAdminChecked(true);

                          setInfoTitle(
                            "Как запустить с правами администратора"
                          );
                          setInfoMessage(
                            "Запустите приложение от имени администратора (ПКМ → Запуск от имени администратора) или создайте ярлык, в котором в свойствах выберите запуск от имени администратора. После этого нажмите 'Повторить'."
                          );
                          setInfoIsError(false);
                          setInfoOpen(true);
                        }}
                      >
                        Инструкция
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              className="posterBlur"
              style={{ backgroundImage: `url('${posterUrl}')` }}
            ></div>
          </div>
        </div>
        <div className="inGameOption">
          {/* <div className="whilecard">
            <div className="flex justify-between items-center space-y-1 rounded-xl bg-white/5 p-1 sm:p-2">
              <h3>Выбор режима</h3>
              <ChevronDown size={20} strokeWidth={1.5} absoluteStrokeWidth />
            </div>
            <div className="content">
              <form id="SelectInteract">
                <div className="SelectInteractRadio">
                  <input
                    type="radio"
                    id="ban-clusters-1"
                    name="auto-connect-cluster-action"
                  />
                  <label htmlFor="ban-clusters-1">
                    Автоматически подключаться к серверу с самой низкой
                    задержкой
                  </label>
                </div>
                <div className="SelectInteractRadio">
                  <input
                    type="radio"
                    id="ban-clusters-2"
                    name="cluster-action"
                    checked
                  />
                  <label htmlFor="ban-clusters-2">
                    Не отслеживать открытия игры
                  </label>
                </div>
              </form>
            </div>
          </div> */}
          <div className="whilecard">
            <div className="flex justify-between items-center space-y-1 rounded-xl bg-white/5 p-1 sm:p-2">
              <h3>Выбрать сервер</h3>
            </div>
            <div className="content">
              <div className="ban-clusters-1 mt-1">
                <ClusterMenu
                  clusters={clusters}
                  selectedDomain={selectedDomain}
                  onSelect={handleSelectCluster}
                  pings={pings}
                />
              </div>
            </div>
          </div>
          <div className="whilecard mt-5">
            <div className="flex sticky top-0 justify-between items-center space-y-1 rounded-xl bg-white/5 p-1 sm:p-2">
              <h3>Выборочная блокировка</h3>

              {/* Ping summary (region-limited) */}
              {clusters.length > 0 && (
                <div className="text-xs text-white/60">
                  {(() => {
                    const domainSet = new Set(
                      clusters.map((c: any) => c.domain)
                    );
                    const regionPings = Object.entries(pings)
                      .filter(([k, _v]) => domainSet.has(k))
                      .map(([_k, v]) => v);

                    const vals = regionPings.filter(
                      (p) => p.avg !== null
                    ) as any[];
                    const avg = vals.length
                      ? Math.round(
                          vals.reduce((s, x) => s + (x.avg || 0), 0) /
                            vals.length
                        )
                      : null;
                    const ok = regionPings.filter(
                      (p) => p.status === "ok"
                    ).length;
                    const total = clusters.length;
                    return (
                      <span>
                        Ping: {avg ? `${avg} ms` : "—"} ({ok}/{total} ok)
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="content p-0 relative">
              <div className="ban-clusters-2 mt-1 scrollbarYAuto">
                <ClusterList
                  clusters={clusters}
                  checkedMap={regionMap}
                  onToggle={handleToggleCluster}
                  pings={pings}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
