import { useState, useEffect } from "react";
import { isProcessRunning, killProcess } from "../utils/tauriInvoke";

const GAME_PROCESS_NAMES = ["wotblitz", "blitz", "worldoftanksblitz"];

export function useGameStatus() {
  const [gameRunning, setGameRunning] = useState(false);

  const checkGameRunning = async () => {
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
  };

  const killGame = async () => {
    for (const n of GAME_PROCESS_NAMES) {
      try {
        await killProcess(n);
      } catch (e) {
        // ignore
      }
    }
    setTimeout(() => checkGameRunning(), 1200);
  };

  useEffect(() => {
    checkGameRunning();
  }, []);

  return { gameRunning, checkGameRunning, killGame };
}
