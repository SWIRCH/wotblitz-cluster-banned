import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import clustersData from "../data/servers.json";
import ClusterMenu from "./components/ClusterMenu";
import Navbar from "./components/Navbar";
import GamePoster from "./components/GamePoster";
import SelectiveBlocking from "./components/SelectiveBlocking";
import LoadingScreen from "./components/LoadingScreen";
import ConfirmModal from "./components/modals/ConfirmModal";
import BlockingAllConfirmModal from "./components/modals/BlockingAllConfirmModal";
import ClearConfirmModal from "./components/modals/ClearConfirmModal";
import InfoModal from "./components/modals/InfoModal";
import SettingsModal from "./components/modals/SettingsModal";
import AdminModal from "./components/modals/AdminModal";
import { useSettings } from "../hooks/useSettings";
import { useSelections } from "../hooks/useSelections";
import { useHosts } from "../hooks/useHosts";
import { usePing } from "../hooks/usePing";
import { useGameStatus } from "../hooks/useGameStatus";
import { useHostsActions } from "../hooks/useHostsActions";
import { safeInvoke, launchGame, diagnoseTauri } from "../utils/tauriInvoke";
import { getSavedRegionId, saveRegionId } from "../utils/regionStorage";
import type { Game } from "../types/cluster";

export default function App() {
  const game = clustersData as Game;
  const [isLoading, setIsLoading] = useState(true);

  // Получаем сохраненный регион или используем EU по умолчанию
  const getInitialRegionId = (): string => {
    const savedRegionId = getSavedRegionId();
    if (savedRegionId) {
      // Проверяем, что сохраненный регион существует в списке
      const regionExists = game.clusters.some((c) => c.id === savedRegionId);
      if (regionExists) {
        return savedRegionId;
      }
    }
    // По умолчанию EU, если есть, иначе первый регион
    const defaultRegion =
      game.clusters.find((c) => c.id === "wot_eu") ?? game.clusters[0];
    return defaultRegion?.id ?? "";
  };

  const [selectedRegionId, setSelectedRegionId] = useState<string>(
    getInitialRegionId()
  );

  // Сохраняем регион при изменении
  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    saveRegionId(regionId);
  };

  // Получаем текущий регион или EU по умолчанию
  const defaultRegion =
    game.clusters.find((c) => c.id === "wot_eu") ?? game.clusters[0];
  const selectedRegion =
    game.clusters.find((c) => c.id === selectedRegionId) ?? defaultRegion;
  const clusters = selectedRegion?.clusters ?? [];

  // Hooks
  const { settings, updateSetting, loading: settingsLoading } = useSettings();
  const { selections, updateSelection, selectCluster, clearAllSelections } =
    useSelections(game);
  const {
    hostsMismatch,
    mismatchDomains,
    tauriAvailable,
    lastTauriError,
    checkHostsConsistency,
  } = useHosts(selectedRegionId, selections, clusters);
  const { pings, pingClusters } = usePing(selectedRegion);
  const { gameRunning, checkGameRunning, killGame } = useGameStatus();
  const { applyHostsUpdate, clearCluster, loading } = useHostsActions(
    selectedRegionId,
    selections,
    clusters,
    settings
  );

  // Poster selection
  const [posterUrl, setPosterUrl] = useState<string>(
    game.posters && game.posters.length > 0
      ? game.posters[0]
      : "/Games/444200/coaav5.jpg"
  );

  useEffect(() => {
    try {
      const posters = game.posters;
      if (Array.isArray(posters) && posters.length > 0) {
        const idx = Math.floor(Math.random() * posters.length);
        setPosterUrl(posters[idx]);
      }
    } catch (err) {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!settingsLoading && Object.keys(selections).length > 0) {
      console.log(
        "Данные приложения загружены, ожидаем завершения проверки обновлений"
      );
    }
  }, [settingsLoading, selections]);

  const handleLoadingComplete = () => {
    console.log("LoadingScreen разрешил закрытие");
    setIsLoading(false);
  };

  // Check elevation on mount
  useEffect(() => {
    (async () => {
      try {
        const ev: any = await safeInvoke("check_elevation");
        if (ev && ev.isAdmin === false) {
          setAdminModalOpen(true);
        }
      } catch (e) {
        console.debug("check_elevation failed", e);
      }
    })();
  }, []);

  const regionMap = selections[selectedRegionId] ?? {};
  const selectedDomain =
    Object.keys(regionMap).find((k) => regionMap[k]) ?? clusters[0]?.domain;

  // Modal states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDomains, setConfirmDomains] = useState<string[]>([]);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [blockingAllConfirmOpen, setBlockingAllConfirmOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTitle, setInfoTitle] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [infoIsError, setInfoIsError] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<string | null>(null);

  const handleSelectCluster = (domain: string) => {
    selectCluster(selectedRegionId, domain, clusters);
  };

  const handleToggleCluster = (domain: string, checked: boolean) => {
    updateSelection(selectedRegionId, domain, checked);
  };

  const handleApplyHosts = async (domains?: string[]) => {
    const result = await applyHostsUpdate(domains);
    setInfoTitle(result.title);
    setInfoMessage(result.message);
    setInfoIsError(!result.success);
    setInfoOpen(true);
    setConfirmOpen(false);
    if (result.success) {
      await checkHostsConsistency();
    }
  };

  const handleClearCluster = async () => {
    const result = await clearCluster();
    setInfoTitle(result.title);
    setInfoMessage(result.message);
    setInfoIsError(!result.success);
    setInfoOpen(true);
    setClearConfirmOpen(false);

    if (result.success) {
      await clearAllSelections();
      await checkHostsConsistency();
      await pingClusters(selectedRegionId);
      await checkGameRunning();
    }
  };

  const handlePlayClick = async () => {
    try {
      if (gameRunning) {
        await killGame();
        setInfoTitle("Закрытие игры");
        setInfoMessage("Попытка закрыть процесс игры (если он был запущен)");
        setInfoIsError(false);
        setInfoOpen(true);
      } else {
        try {
          await launchGame("444200");
          setInfoTitle("Запуск...");
          setInfoMessage("Запрос на запуск отправлен: Steam будет открыт.");
          setInfoIsError(false);
          setInfoOpen(true);
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
  };

  const handleUpdateClick = () => {
    const rmap =
      selections[selectedRegionId] ??
      Object.fromEntries(clusters.map((c) => [c.domain, true]));
    const blockedDomains = clusters
      .filter((c) => !rmap[c.domain])
      .map((c) => c.domain);
    setConfirmDomains(blockedDomains);
    setConfirmOpen(true);
  };

  const handleDiagnose = async () => {
    try {
      const res = await diagnoseTauri();
      console.debug("diagnoseTauri -> result", res);
      setDiagnosticInfo(JSON.stringify(res, null, 2));
    } catch (err) {
      console.debug("diagnoseTauri failed", err);
      setDiagnosticInfo(String(err));
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading && (
          <LoadingScreen
            key="loading"
            visible={isLoading}
            onLoadingComplete={handleLoadingComplete}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!isLoading && (
          <main className="" id="layer-ingame" key="main">
            <Navbar
              game={game}
              selectedRegion={selectedRegion}
              onRegionChange={handleRegionChange}
            />
            <div className="inGameContainer">
              <GamePoster
                posterUrl={posterUrl}
                tauriAvailable={tauriAvailable}
                hostsMismatch={hostsMismatch}
                gameRunning={gameRunning}
                onPlayClick={handlePlayClick}
                onUpdateClick={handleUpdateClick}
                onCheckHosts={checkHostsConsistency}
                onSettingsClick={() => setSettingsModalOpen(true)}
                onRefreshClick={async () => {
                  await pingClusters(selectedRegionId);
                  await checkGameRunning();
                }}
                onClearClick={() => setClearConfirmOpen(true)}
                selectedRegion={selectedRegion}
                lastTauriError={lastTauriError}
                mismatchDomains={mismatchDomains}
              />
              <div className="inGameOption">
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
                <SelectiveBlocking
                  clusters={clusters}
                  checkedMap={regionMap}
                  onToggle={handleToggleCluster}
                  pings={pings}
                />
              </div>
            </div>

            {/* Modals */}
            <ConfirmModal
              open={confirmOpen}
              onClose={() => setConfirmOpen(false)}
              onConfirm={() => handleApplyHosts(confirmDomains)}
              domains={confirmDomains}
              clusters={clusters}
              regionName={
                selectedRegion?.alias_name ?? selectedRegion?.name ?? ""
              }
              onBlockingAllConfirm={() => setBlockingAllConfirmOpen(true)}
            />

            <BlockingAllConfirmModal
              open={blockingAllConfirmOpen}
              onClose={() => setBlockingAllConfirmOpen(false)}
              onConfirm={async () => {
                setBlockingAllConfirmOpen(false);
                await handleApplyHosts(confirmDomains);
              }}
              regionName={
                selectedRegion?.alias_name ?? selectedRegion?.name ?? ""
              }
            />

            <ClearConfirmModal
              open={clearConfirmOpen}
              onClose={() => setClearConfirmOpen(false)}
              onConfirm={handleClearCluster}
              useFirewall={settings.useFirewall}
              useBackup={settings.useBackup}
              loading={loading}
            />

            <InfoModal
              open={infoOpen}
              onClose={() => setInfoOpen(false)}
              title={infoTitle}
              message={infoMessage}
              isError={infoIsError}
            />

            <SettingsModal
              open={settingsModalOpen}
              onClose={() => setSettingsModalOpen(false)}
              settings={settings}
              onUpdateSetting={updateSetting}
              onDiagnose={handleDiagnose}
              diagnosticInfo={diagnosticInfo}
            />

            <AdminModal
              open={adminModalOpen}
              onShowInstructions={() => {
                setAdminModalOpen(false);
                setInfoTitle("Как запустить с правами администратора");
                setInfoMessage(
                  "Запустите приложение от имени администратора (ПКМ → Запуск от имени администратора) или создайте ярлык, в котором в свойствах выберите запуск от имени администратора. После этого нажмите 'Повторить'."
                );
                setInfoIsError(false);
                setInfoOpen(true);
              }}
            />
          </main>
        )}
      </AnimatePresence>
    </>
  );
}
