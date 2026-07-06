import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ArrowDown } from "lucide-react";

interface PullToRefreshIndicatorProps {
  isPulling: boolean;
  isRefreshing: boolean;
  pullProgress: number;
}

export function PullToRefreshIndicator({ isPulling, isRefreshing, pullProgress }: PullToRefreshIndicatorProps) {
  const ready = pullProgress >= 1;

  return (
    <AnimatePresence>
      {(isPulling || isRefreshing) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.18 }}
          className="flex items-center justify-center pt-3 pb-1"
        >
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-200 ${
              isRefreshing
                ? "bg-primary/10 text-primary"
                : ready
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isRefreshing ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <motion.div
                animate={{ rotate: ready ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ArrowDown size={13} />
              </motion.div>
            )}
            <span>
              {isRefreshing ? "Refreshing…" : ready ? "Release to refresh" : "Pull to refresh"}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
