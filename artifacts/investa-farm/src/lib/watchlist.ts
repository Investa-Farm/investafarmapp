import { useState, useEffect, useCallback } from "react";

const KEY = "investa_watchlist";

function readIds(): number[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function writeIds(ids: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch { /* silent */ }
}

export function useWatchlist() {
  const [ids, setIds] = useState<number[]>(readIds);

  // Keep in sync across tabs
  useEffect(() => {
    const handler = () => setIds(readIds());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const toggle = useCallback((farmId: number) => {
    setIds(prev => {
      const next = prev.includes(farmId)
        ? prev.filter(id => id !== farmId)
        : [...prev, farmId];
      writeIds(next);
      return next;
    });
  }, []);

  const isWatched = useCallback((farmId: number) => ids.includes(farmId), [ids]);

  return { ids, toggle, isWatched };
}
