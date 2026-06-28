import { useRef, useCallback, useState } from "react";
import { haptic } from "@/lib/haptic";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export interface PullToRefreshHandlers {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => Promise<void>;
  isPulling: boolean;
  isRefreshing: boolean;
  pullProgress: number;
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: UsePullToRefreshOptions): PullToRefreshHandlers {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hapticFiredRef = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      startYRef.current = e.touches[0]!.clientY;
      hapticFiredRef.current = false;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const delta = e.touches[0]!.clientY - startYRef.current;
    if (delta > 0) {
      const progress = Math.min(1, delta / threshold);
      setIsPulling(true);
      setPullProgress(progress);
      if (progress >= 1 && !hapticFiredRef.current) {
        haptic("medium");
        hapticFiredRef.current = true;
      }
    }
  }, [threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    if (pullProgress >= 1) {
      setIsRefreshing(true);
      haptic("success");
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setIsPulling(false);
    setPullProgress(0);
    startYRef.current = null;
    hapticFiredRef.current = false;
  }, [isPulling, pullProgress, onRefresh]);

  return { containerRef, onTouchStart, onTouchMove, onTouchEnd, isPulling, isRefreshing, pullProgress };
}
