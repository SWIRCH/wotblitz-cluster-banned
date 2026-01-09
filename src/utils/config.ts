import { getVersion, getTauriVersion, getName, getBundleType } from '@tauri-apps/api/app';

export const config = {
  AUTHOR: "aysi",
  AUTHOR_LINK: "https://github.com/SWIRCH/clusterbanned",
  BUILD: "00005123",
  NAME: await getName(),
  BUNDLE_TYPE: await getBundleType(),
  VERSION: await getVersion(),
  TAURI_VERSION: await getTauriVersion(),
  BREACH: "clusterban",
};
