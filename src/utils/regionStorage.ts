const REGION_KEY = "clusterbanned_selected_region";

export function getSavedRegionId(): string | null {
  try {
    return localStorage.getItem(REGION_KEY);
  } catch (error) {
    console.error("Failed to load saved region:", error);
    return null;
  }
}

export function saveRegionId(regionId: string): void {
  try {
    localStorage.setItem(REGION_KEY, regionId);
  } catch (error) {
    console.error("Failed to save region:", error);
  }
}
