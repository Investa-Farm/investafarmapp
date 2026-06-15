import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp, Users, Star, Copy, ChevronRight, Loader2, Shield, Zap, Leaf, Sliders, BadgeCheck } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getToken } from "@/lib/auth";
import { getCropImage } from "@/lib/crops";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

const STRATEGY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  growth:           { label: "High Growth",       icon: <Zap size={12} />,    color: "bg-amber-100 text-amber-700" },
  balanced:         { label: "Balanced",           icon: <Sliders size={12} />,color: "bg-blue-100 text-blue-700" },
  climate_resilient:{ label: "Climate Resilient",  icon: <Leaf size={12} />,   color: "bg-green-100 text-green-700" },
  custom:           { label: "Custom",             icon: <Star size={12} />,   color: "bg-purple-100 text-purple-700" },
};

function StrategyBadge({ strategy }: { strategy: string }) {
  const meta = STRATEGY_META[strategy] ?? { label: strategy, icon: <Star size={12} />, color: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
      {meta.icon}{meta.label}
    </span>
  );
}

function CopyModal({ portfolio, onClose }: { portfolio: any; onClose: () => void }) {
  const [autoRebalance, setAutoRebalance] = useState(false);
  const [step, setStep] = useState<"confirm" | "done">("confirm");
  const [loading, setLoading] = useState(false);
  const token = getToken();

  const handleCopy = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/portfolio-manager/${portfolio.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ autoRebalance }),
      });
      if (r.ok) setStep("done");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative w-full max-w-[430px] bg-white rounded-t-3xl px-5 pt-5 pb-10"
      >
        {step === "confirm" ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-foreground font-bold text-base">Copy Portfolio</p>
                <p className="text-muted-foreground text-xs">{portfolio.name}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">✕</button>
            </div>

            <div className="bg-muted/50 rounded-2xl p-3 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Manager Fee</span>
                <span className="font-semibold">{portfolio.managementFeePercent}% / yr</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Holdings</span>
                <span className="font-semibold">{portfolio.holdingCount} farms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expected Return</span>
                <span className="font-semibold text-green-600">+{portfolio.expectedReturn}%</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
              <p className="text-blue-700 text-xs leading-relaxed">
                Copying this portfolio lets you mirror the manager's strategy. Shares are purchased in the same weights using your wallet funds.
              </p>
            </div>

            <div className="flex items-center justify-between bg-muted/40 rounded-xl p-3 mb-4">
              <div>
                <p className="text-foreground text-sm font-semibold">Auto-rebalance</p>
                <p className="text-muted-foreground text-xs">Update when manager changes weights</p>
              </div>
              <button
                onClick={() => setAutoRebalance(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${autoRebalance ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${autoRebalance ? "left-5" : "left-0.5"}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose} className="py-3 rounded-xl border border-border text-foreground text-sm font-semibold">Cancel</button>
              <button onClick={handleCopy} disabled={loading}
                className="py-3 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-1.5">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                {loading ? "Copying…" : "Copy Portfolio"}
              </button>
            </div>
          </>
        ) : (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <BadgeCheck size={40} className="text-green-500" />
            </div>
            <div>
              <p className="text-foreground font-bold text-xl">Portfolio Copied!</p>
              <p className="text-muted-foreground text-sm mt-1">You're now following <strong>{portfolio.name}</strong></p>
            </div>
            <button onClick={onClose} className="w-full bg-primary text-white font-bold py-3.5 rounded-xl">Done</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function CommunityPortfolios() {
  const [, setLocation] = useLocation();
  const [copyTarget, setCopyTarget] = useState<any>(null);
  const token = getToken();

  const { data: portfolios = [], isLoading } = useQuery<any[]>({
    queryKey: ["community-portfolios"],
    queryFn: async () => {
      const r = await fetch("/api/portfolio-manager/community", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });

  return (
    <div className="app-shell pb-20 page-enter">
      {/* Header */}
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setLocation("/market")} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-white/70 text-xs">Investa Farm</p>
            <h1 className="text-white text-xl font-bold">Community Portfolios</h1>
          </div>
        </div>
        <p className="text-white/70 text-sm">Browse and copy expert-curated farm portfolios. AI-optimised for every risk appetite.</p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: "Portfolios", val: String(portfolios.length) },
            { label: "Strategies", val: "4" },
            { label: "Avg Return", val: portfolios.length > 0 ? `+${(portfolios.reduce((s: number, p: any) => s + (p.expectedReturn ?? 0), 0) / portfolios.length).toFixed(1)}%` : "—" },
          ].map(({ label, val }) => (
            <div key={label} className="bg-white/20 rounded-xl p-2.5 text-center">
              <p className="text-white text-sm font-bold">{val}</p>
              <p className="text-white/60 text-[9px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
        ) : portfolios.length === 0 ? (
          <div className="text-center py-16">
            <TrendingUp size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-bold text-base">No portfolios yet</p>
            <p className="text-muted-foreground text-sm mt-1">Be the first to publish an AI-built portfolio</p>
          </div>
        ) : (
          portfolios.map((p: any, i: number) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Top image strip */}
              {(p.topCrops ?? []).length > 0 && (
                <div className="flex h-16 overflow-hidden">
                  {(p.topCrops as string[]).slice(0, 3).map((crop, ci) => (
                    <img key={ci} src={getCropImage(crop)} alt={crop}
                      className="flex-1 object-cover" style={{ minWidth: 0 }} />
                  ))}
                </div>
              )}

              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-foreground font-bold text-sm truncate">{p.name}</p>
                    {p.description && (
                      <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-green-600 font-bold text-lg">+{p.expectedReturn}%</p>
                    <p className="text-muted-foreground text-[9px]">expected return</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <StrategyBadge strategy={p.strategy} />
                  <span className="text-[9px] font-semibold bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                    Risk {p.targetRisk}/10
                  </span>
                  <span className="text-[9px] font-semibold bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                    {p.holdingCount} farms
                  </span>
                  {Number(p.managementFeePercent) > 0 && (
                    <span className="text-[9px] font-semibold bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">
                      {p.managementFeePercent}% fee/yr
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <Users size={11} />
                    <span>{p.followerCount ?? 0} followers</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLocation(`/market/portfolios/${p.id}`)}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground flex items-center gap-1"
                    >
                      Details <ChevronRight size={11} />
                    </button>
                    <button
                      onClick={() => setCopyTarget(p)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold flex items-center gap-1"
                    >
                      <Copy size={11} /> Copy
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {copyTarget && <CopyModal portfolio={copyTarget} onClose={() => setCopyTarget(null)} />}
      <BottomNav />
    </div>
  );
}
