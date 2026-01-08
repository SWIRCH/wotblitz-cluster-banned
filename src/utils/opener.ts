import { openUrl } from "@tauri-apps/plugin-opener";
import { config } from "./config";

export async function openAuthorLink() {
  await openUrl(config.AUTHOR_LINK);
}
