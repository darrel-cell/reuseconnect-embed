import { useEffect, useState } from "react";

export type ListViewMode = "list" | "card";

/**
 * Persist list vs card preference per page (e.g. "sites-view", "clients-view").
 */
export function usePersistedViewMode(
  storageKey: string,
  defaultMode: ListViewMode = "card"
): [ListViewMode, (mode: ListViewMode) => void] {
  const [viewMode, setViewModeState] = useState<ListViewMode>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "list" || stored === "card") return stored;
    } catch {
      // ignore
    }
    return defaultMode;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, viewMode);
    } catch {
      // ignore
    }
  }, [storageKey, viewMode]);

  return [viewMode, setViewModeState];
}
