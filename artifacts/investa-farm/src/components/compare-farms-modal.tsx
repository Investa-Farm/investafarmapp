import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, TrendingDown, MapPin, Users, Scale } from "lucide-react";
import { getCropImage } from "@/lib/crops";
import { useCurrency } from "@/lib/currency";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { formatKES } from "@/lib/auth";

export type CompareListing = {
  id: number; farmId: number; farmName: string; cropType: string;
  location: string; pricePerShare: number; sharesAvailable: number;
  changePercent: number; imageUrl?: string;
  totalShares?: number; dcfFairValue?: number;
};

const HIGH_RISK = new Set(["coffee", "avocado", "tobacco", "horticulture"]);
const MOD_RISK  = new Set(["tea", "wheat", "tomatoes", "potatoes", "onions"]);
type RiskLevel = "Low" | "Moderate" | "High";

function risk(cropType: string, cp: number): RiskLevel {
  const c = (cropType ?? "").toLowerCase();
  if (HIGH_RISK.has(c) || Math.abs(cp) > 5) return "High";
  if (MOD_RISK.has(c)  || Math.abs(cp) > 2) return "Moderate";
  return "Low";
}

function roi(cropType: string, cp: number): number {
  const base: Record<string, number> = {
    coffee: 22, avocado: 20, tea: 14, wheat: 12, maize: 15, beans: 16,
    tomatoes: 18, rice: 13, sunflower: 14, kale: 20, cabbage: 17,
    dairy: 12, poultry: 16, greenhouse: 22,
  };
  const b = base[(cropType ?? "").toLowerCase()] ?? 15;
  return Math.round(b + cp * 0.5);
}

function seasonHistory(price: number, cp: number) {
  const steps = ["8am","10am","12pm","2pm","4pm","6pm"];
  return steps.map((time, i) => ({
    time,
    value: Math.round(price * (1 + (cp / 100) * (i / (steps.length - 1)))),
  }));
}

function RiskDots({ level }: { level: RiskLevel }) {
  const filled = level === "High" ? 5 : level === "Moderate" ? 3 : 2;
  const color  = level === "High" ? "bg-red-500" : level === "Moderate" ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="flex gap-0.5 items-center">
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`w-2 h-2 rounded-full ${i <= filled ? color : "bg-muted-foreground/20"}`} />
      ))}
    </div>
  );
}

function Winner({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return (
    <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full border border-green-200 ml-1">
      ✓ {label}
    </span>
  );
}

type Props = { open: boolean; farmA: CompareListing | null; farmB: CompareListing | null; onClose: () => void };

export function CompareFarmsModal({ open, farmA, farmB, onClose }: Props) {
  const { formatAmount } = useCurrency();
  if (!farmA || !farmB) return null;

  const rA = risk(farmA.cropType, farmA.changePercent);
  const rB = risk(farmB.cropType, farmB.changePercent);
  const roiA = roi(farmA.cropType, farmA.changePercent);
  const roiB = roi(farmB.cropType, farmB.changePercent);
  const sparkA = generateSparkData(farmA.pricePerShare, 12, farmA.changePercent / 100);
  const sparkB = generateSparkData(farmB.pricePerShare, 12, farmB.changePercent / 100);
  const histA = seasonHistory(farmA.pricePerShare, farmA.changePercent);
  const histB = seasonHistory(farmB.pricePerShare, farmB.changePercent);
  const fundA = farmA.totalShares ? Math.round((farmA.totalShares - farmA.sharesAvailable) / farmA.totalShares * 100) : 0;
  const fundB = farmB.totalShares ? Math.round((farmB.totalShares - farmB.sharesAvailable) / farmB.totalShares * 100) : 0;

  const riskScore = { Low: 1, Moderate: 2, High: 3 } as const;
  const betterRisk  = riskScore[rA] < riskScore[rB] ? "A" : riskScore[rB] < riskScore[rA] ? "B" : null;
  const betterRoi   = roiA > roiB ? "A" : roiB > roiA ? "B" : null;
  const betterPrice = farmA.pricePerShare < farmB.pricePerShare ? "A" : farmB.pricePerShare < farmA.pricePerShare ? "B" : null;
  const betterFund  = fundA > fundB ? "A" : fundB > fundA ? "B" : null;
  const betterMid   = farmA.changePercent > farmB.changePercent ? "A" : farmB.changePercent > farmA.changePercent ? "B" : null;

  const scoreA = [betterRisk, betterRoi, betterPrice, betterFund, betterMid].filter(v => v === "A").length;
  const scoreB = [betterRisk, betterRoi, betterPrice, betterFund, betterMid].filter(v => v === "B").length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex flex-col"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl overflow-hidden flex flex-col"
            style={{ maxHeight: "92dvh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Scale size={16} className="text-primary" />
                <h2 className="font-bold text-base text-foreground">Compare Farms</h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={15} className="text-foreground" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-3 py-3 space-y-3">

              {/* Farm headers */}
              <div className="grid grid-cols-2 gap-2">
                {[{ f: farmA, label: "A" }, { f: farmB, label: "B" }].map(({ f, label }) => (
                  <div key={label} className="rounded-2xl overflow-hidden border border-border">
                    <div className="relative h-24">
                      <img src={getCropImage(f.cropType, f.imageUrl)} alt={f.farmName}
                        className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-white font-bold text-[11px]">{label}</span>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="text-white font-bold text-[11px] leading-tight truncate">{f.farmName}</p>
                        <p className="text-white/70 text-[9px]">{f.cropType} · {f.location}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Winner banner */}
              {scoreA !== scoreB && (
                <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">{scoreA > scoreB ? "🏆" : "🥇"}</span>
                  <div>
                    <p className="text-green-800 font-bold text-sm">
                      Farm {scoreA > scoreB ? "A" : "B"} looks stronger
                    </p>
                    <p className="text-green-600 text-[10px]">
                      Wins {scoreA > scoreB ? scoreA : scoreB} of {scoreA + scoreB} metrics
                    </p>
                  </div>
                </div>
              )}

              {/* Price sparklines side-by-side */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { f: farmA, spark: sparkA, hist: histA, label: "A" },
                  { f: farmB, spark: sparkB, hist: histB, label: "B" },
                ].map(({ f, spark, hist, label }) => {
                  const up = f.changePercent >= 0;
                  return (
                    <div key={label} className="rounded-2xl border border-border p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-muted-foreground text-[9px] font-semibold">Farm {label}</span>
                        <span className={`text-[9px] font-bold ${up ? "text-green-600" : "text-red-500"}`}>
                          {up ? "▲" : "▼"} {Math.abs(f.changePercent).toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ height: 60 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={hist} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`cgrad-${label}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={up ? "#16a34a40" : "#dc262640"} />
                                <stop offset="95%" stopColor={up ? "#16a34a00" : "#dc262600"} />
                              </linearGradient>
                            </defs>
                            <Tooltip
                              formatter={(v: number) => [formatKES(v), ""]}
                              contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #e5e7eb" }}
                            />
                            <Area type="monotone" dataKey="value"
                              stroke={up ? "#16a34a" : "#dc2626"} strokeWidth={1.5}
                              fill={`url(#cgrad-${label})`} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-foreground font-bold text-xs mt-1 text-center">{formatAmount(f.pricePerShare)}/share</p>
                    </div>
                  );
                })}
              </div>

              {/* Metric rows */}
              {[
                {
                  label: "Target ROI",
                  valA: <span className="text-green-600 font-bold text-sm">+{roiA}%</span>,
                  valB: <span className="text-green-600 font-bold text-sm">+{roiB}%</span>,
                  winner: betterRoi,
                  note: "Full-season expected return",
                },
                {
                  label: "Risk Level",
                  valA: <div className="flex flex-col items-center gap-0.5"><RiskDots level={rA} /><span className={`text-[10px] font-semibold ${rA === "Low" ? "text-green-600" : rA === "Moderate" ? "text-amber-500" : "text-red-500"}`}>{rA}</span></div>,
                  valB: <div className="flex flex-col items-center gap-0.5"><RiskDots level={rB} /><span className={`text-[10px] font-semibold ${rB === "Low" ? "text-green-600" : rB === "Moderate" ? "text-amber-500" : "text-red-500"}`}>{rB}</span></div>,
                  winner: betterRisk,
                  note: "Lower is safer",
                },
                {
                  label: "Share Price",
                  valA: <span className="font-bold text-sm text-foreground">{formatAmount(farmA.pricePerShare)}</span>,
                  valB: <span className="font-bold text-sm text-foreground">{formatAmount(farmB.pricePerShare)}</span>,
                  winner: betterPrice,
                  note: "Lower = cheaper entry",
                },
                {
                  label: "Funding Progress",
                  valA: (
                    <div className="w-full">
                      <div className="h-2 bg-muted rounded-full overflow-hidden mb-0.5">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${fundA}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-primary">{fundA}%</span>
                    </div>
                  ),
                  valB: (
                    <div className="w-full">
                      <div className="h-2 bg-muted rounded-full overflow-hidden mb-0.5">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${fundB}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-primary">{fundB}%</span>
                    </div>
                  ),
                  winner: betterFund,
                  note: "Higher = more investor confidence",
                },
                {
                  label: "Mid-Season Return",
                  valA: <span className="text-orange-600 font-bold text-xs">{formatAmount(Math.round(farmA.pricePerShare * 100 * 1.10))}</span>,
                  valB: <span className="text-orange-600 font-bold text-xs">{formatAmount(Math.round(farmB.pricePerShare * 100 * 1.10))}</span>,
                  winner: betterMid,
                  note: "100 shares · 30–60 days",
                },
                {
                  label: "Full Season Return",
                  valA: <span className="text-green-600 font-bold text-xs">{formatAmount(Math.round(farmA.pricePerShare * 100 * (1 + roiA / 100)))}</span>,
                  valB: <span className="text-green-600 font-bold text-xs">{formatAmount(Math.round(farmB.pricePerShare * 100 * (1 + roiB / 100)))}</span>,
                  winner: betterRoi,
                  note: "100 shares · ~6 months",
                },
              ].map(({ label, valA, valB, winner, note }) => (
                <div key={label} className="rounded-2xl border border-border overflow-hidden">
                  <div className="bg-muted/40 px-3 py-1.5 flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-foreground">{label}</p>
                    <p className="text-[9px] text-muted-foreground">{note}</p>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border">
                    {[
                      { val: valA, side: "A" as const, isWinner: winner === "A" },
                      { val: valB, side: "B" as const, isWinner: winner === "B" },
                    ].map(({ val, side, isWinner }) => (
                      <div key={side} className={`p-3 flex flex-col items-center gap-1 ${isWinner ? "bg-green-50/60" : ""}`}>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-muted-foreground">Farm {side}</span>
                          {isWinner && <span className="text-[9px] text-green-600 font-bold">✓</span>}
                        </div>
                        {val}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Shares available */}
              <div className="grid grid-cols-2 gap-2">
                {[{ f: farmA, label: "A" }, { f: farmB, label: "B" }].map(({ f, label }) => (
                  <div key={label} className="rounded-2xl border border-border p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <Users size={11} />
                      <span className="text-[9px]">Farm {label} · Shares Left</span>
                    </div>
                    <p className="font-bold text-sm text-foreground">{f.sharesAvailable.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="h-4" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
