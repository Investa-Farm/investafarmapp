import { useState, useMemo } from "react";
import { useGetPortfolio, useGetPortfolioSummary } from "@workspace/api-client-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, formatChange, getStoredUser } from "@/lib/auth";
import { TrendingUp, TrendingDown, Share2, Tag, ExternalLink, Users, BadgeCheck, Copy, Check, Lock, Globe, ChevronRight as ChevRight } from "lucide-react";
import { Link } from "wouter";
import { ShareModal } from "@/components/share-modal";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ExitModal } from "@/components/exit-modal";
import { SellSharesModal } from "@/components/sell-shares-modal";
import { getCropImage } from "@/lib/crops";

type Holding = {
  id: number; farmId: number; farmName: string; cropType: string; location: string;
  quantity: number; purchasePrice: number; currentPrice: number; totalValue: number;
  gainLoss: number; gainLossPercent: number; exitType: string; imageUrl?: string; status: string;
};

type Period = "1W" | "1M" | "3M";

function buildChartData(totalInvested: number, totalValue: number, period: Period) {
  const points = period === "1W" ? 7 : period === "1M" ? 30 : 90;
  const labels: string[] = [];
  const now = new Date();
  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (period === "1W") labels.push(d.toLocaleDateString("en-KE", { weekday: "short" }));
    else if (period === "1M") labels.push(d.getDate() === 1 || i === points - 1 || i === 0 ? d.toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "");
    else labels.push(i % 15 === 0 ? d.toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "");
  }

  const start = totalInvested * 0.88;
  const end = totalValue;
  return labels.map((label, i) => {
    const t = i / (points - 1);
    const trend = start + (end - start) * t;
    const noise = totalInvested * 0.02 * (Math.sin(i * 1.7) * 0.6 + Math.cos(i * 0.9) * 0.4);
    return { label, value: Math.max(start * 0.85, trend + noise) };
  });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="text-foreground font-bold">{formatKES(payload[0].value)}</p>
    </div>
  );
};

export default function Portfolio() {
  const { data: holdings, isLoading } = useGetPortfolio();
  const { data: summary } = useGetPortfolioSummary();
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [shareHolding, setShareHolding] = useState<Holding | null>(null);
  const [period, setPeriod] = useState<Period>("1W");
  const [activeTab, setActiveTab] = useState<"holdings" | "broker">("holdings");
  const [brokerEnabled, setBrokerEnabled] = useState(() => localStorage.getItem("investa_broker_mode") === "true");
  const [copied, setCopied] = useState(false);
  const user = getStoredUser();

  const brokerLink = `https://investafarm.co.ke/broker/${user?.id ?? ""}`;
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(brokerLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleBrokerToggle = () => {
    const next = !brokerEnabled;
    setBrokerEnabled(next);
    localStorage.setItem("investa_broker_mode", String(next));
  };

  const handleExitClick = (h: Holding) => { setSelectedHolding(h); setExitOpen(true); };
  const handleSellClick = (h: Holding) => { setSelectedHolding(h); setSellOpen(true); };

  const chartData = useMemo(() => {
    if (!summary) return [];
    return buildChartData(summary.totalInvested, summary.totalValue, period);
  }, [summary, period]);

  const chartMin = useMemo(() => chartData.length ? Math.min(...chartData.map(d => d.value)) * 0.995 : 0, [chartData]);
  const chartMax = useMemo(() => chartData.length ? Math.max(...chartData.map(d => d.value)) * 1.005 : 0, [chartData]);
  const isPortfolioUp = summary ? summary.totalValue >= summary.totalInvested : true;

  return (
    <div className="app-shell pb-20 page-enter" data-testid="portfolio-page">
      {/* Hero header */}
      <div className="hero-header pt-12 pb-5 px-5">
        <p className="text-white/80 text-xs font-medium">My Portfolio</p>
        {summary ? (
          <>
            <p className="text-white/70 text-sm mt-1">Portfolio Value</p>
            <p className="text-white text-3xl font-bold mt-0.5">{formatKES(summary.totalValue)}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1">
                <TrendingUp size={12} className="text-white/80" />
                <span className="text-white/80 text-xs font-semibold">{formatChange(summary.todayReturnPercent)} today</span>
              </div>
              <span className="text-white/30">|</span>
              <span className="text-white/70 text-xs">{formatChange(summary.weekReturnPercent)} this week</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { label: "Invested", val: formatKES(summary.totalInvested) },
                { label: "Today's P&L", val: formatKES(summary.todayReturn) },
                { label: "Holdings", val: String(summary.holdings) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white/20 rounded-xl p-2.5 text-center">
                  <p className="text-white text-xs font-bold truncate">{val}</p>
                  <p className="text-white/60 text-[9px] mt-0.5 truncate">{label}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Skeleton className="h-24 mt-2 rounded-2xl bg-white/20" />
        )}
      </div>

      {/* ── Performance Chart ── */}
      <div className="mx-4 mt-4 bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div>
            <p className="text-foreground font-bold text-sm">Portfolio Performance</p>
            {summary && (
              <p className={`text-xs font-semibold mt-0.5 ${isPortfolioUp ? "text-green-600" : "text-red-500"}`}>
                {isPortfolioUp ? "+" : ""}{formatKES(summary.totalValue - summary.totalInvested)}
                <span className="font-normal text-muted-foreground ml-1">total return</span>
              </p>
            )}
          </div>
          {/* Period selector */}
          <div className="flex bg-muted rounded-xl p-0.5 gap-0.5">
            {(["1W", "1M", "3M"] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  period === p ? "bg-primary text-white shadow-sm" : "text-muted-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {!summary ? (
          <Skeleton className="mx-4 mb-4 h-44 rounded-xl" />
        ) : summary.totalInvested === 0 ? (
          <div className="mx-4 mb-4 h-44 flex items-center justify-center bg-muted/40 rounded-xl">
            <div className="text-center">
              <TrendingUp size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-xs">Invest to see your growth chart</p>
            </div>
          </div>
        ) : (
          <div className="px-1 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPortfolioUp ? "#16a34a" : "#dc2626"} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={isPortfolioUp ? "#16a34a" : "#dc2626"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "hsl(220 9% 46%)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "hsl(220 9% 46%)" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[chartMin, chartMax]}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={summary.totalInvested}
                  stroke="hsl(220 9% 46%)"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  label={{ value: "Invested", position: "insideTopRight", fontSize: 8, fill: "hsl(220 9% 46%)" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isPortfolioUp ? "#16a34a" : "#dc2626"}
                  strokeWidth={2}
                  fill="url(#perfGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: isPortfolioUp ? "#16a34a" : "#dc2626", strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Stats row */}
            <div className="flex justify-between px-4 pt-1">
              {[
                { label: "Overall Return", val: `${formatChange(summary.overallGainLossPercent)}`, color: isPortfolioUp ? "text-green-600" : "text-red-500" },
                { label: "Today", val: formatChange(summary.todayReturnPercent), color: "text-green-600" },
                { label: "This Week", val: formatChange(summary.weekReturnPercent), color: "text-green-600" },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-xs font-bold ${color}`}>{val}</p>
                  <p className="text-muted-foreground text-[9px] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Return info banner */}
      <div className="mx-4 mt-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-3">
        <p className="text-green-700 text-xs font-semibold mb-2">Exit Options & Payouts</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/70 rounded-xl p-2">
            <div className="flex items-center gap-1.5">
              <span>⚡</span>
              <p className="text-xs font-semibold text-orange-700">Mid-Season</p>
            </div>
            <p className="text-orange-600 font-bold text-sm mt-0.5">+10% base</p>
            <p className="text-muted-foreground text-[10px]">30–60 days</p>
          </div>
          <div className="bg-white/70 rounded-xl p-2">
            <div className="flex items-center gap-1.5">
              <span>🌾</span>
              <p className="text-xs font-semibold text-green-700">Full Season</p>
            </div>
            <p className="text-green-600 font-bold text-sm mt-0.5">Up to +22%</p>
            <p className="text-muted-foreground text-[10px]">~6 months</p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mx-4 mt-3">
        <div className="flex bg-muted rounded-2xl p-1 gap-1">
          <button onClick={() => setActiveTab("holdings")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === "holdings" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
            📊 My Holdings
          </button>
          <button onClick={() => setActiveTab("broker")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${activeTab === "broker" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
            <Users size={12} /> Broker Profile
          </button>
        </div>
      </div>

      {/* Broker tab */}
      {activeTab === "broker" && (
        <div className="px-4 pt-4 space-y-4">
          {/* Broker enable toggle */}
          <div className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Globe size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-foreground font-bold text-sm">Public Broker Profile</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Let others follow your investment picks</p>
                </div>
              </div>
              <button
                onClick={handleBrokerToggle}
                className={`relative w-12 h-6 rounded-full transition-colors ${brokerEnabled ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${brokerEnabled ? "left-6" : "left-0.5"}`} />
              </button>
            </div>
            {brokerEnabled && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BadgeCheck size={14} className="text-green-600 flex-shrink-0" />
                  <p className="text-green-700 font-semibold text-xs">Broker Profile Active</p>
                </div>
                <p className="text-green-600 text-[10px] leading-relaxed">Your portfolio picks are now visible to followers. Others can copy your investment strategy.</p>
              </div>
            )}
          </div>

          {/* Shareable link */}
          <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
            <p className="text-foreground font-semibold text-sm flex items-center gap-2">
              <Share2 size={14} className="text-primary" /> Your Broker Link
            </p>
            {brokerEnabled ? (
              <>
                <div className="bg-muted/50 border border-border rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <Globe size={12} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-foreground text-xs font-mono flex-1 truncate">{brokerLink}</p>
                </div>
                <button
                  onClick={handleCopyLink}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 ${copied ? "bg-green-600 text-white" : "bg-primary text-white"}`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy Broker Link"}
                </button>
              </>
            ) : (
              <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-2">
                <Lock size={14} className="text-muted-foreground" />
                <p className="text-muted-foreground text-xs">Enable your broker profile to get a shareable link</p>
              </div>
            )}
          </div>

          {/* Portfolio snapshot */}
          <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
            <p className="text-foreground font-semibold text-sm">Portfolio Snapshot</p>
            {summary && (holdings?.length ?? 0) > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Total Holdings", val: String(summary.holdings), icon: "🌾" },
                    { label: "Total Value", val: formatKES(summary.totalValue), icon: "💰" },
                    { label: "Overall Return", val: formatChange(summary.overallGainLossPercent), icon: "📈" },
                    { label: "Avg per Farm", val: summary.holdings > 0 ? formatKES(summary.totalValue / summary.holdings) : "—", icon: "📊" },
                  ].map(({ label, val, icon }) => (
                    <div key={label} className="bg-muted/40 rounded-xl p-2.5 text-center">
                      <p className="text-base mb-1">{icon}</p>
                      <p className="text-foreground font-bold text-sm">{val}</p>
                      <p className="text-muted-foreground text-[9px]">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Top Holdings</p>
                  {(holdings as Holding[])?.slice(0, 3).map((h) => (
                    <div key={h.id} className="flex items-center gap-2">
                      <img src={getCropImage(h.cropType, h.imageUrl)} alt={h.farmName} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-medium text-xs truncate">{h.farmName}</p>
                        <p className="text-muted-foreground text-[10px]">{h.cropType} · {h.quantity} shares</p>
                      </div>
                      <span className={`text-xs font-bold ${h.gainLoss >= 0 ? "text-green-600" : "text-red-500"}`}>{formatChange(h.gainLossPercent)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <TrendingUp size={24} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-xs">Invest in farms to build your broker profile</p>
              </div>
            )}
          </div>

          {/* Followers placeholder */}
          <div className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-foreground font-semibold text-sm">Followers</p>
              <span className="text-muted-foreground text-xs">0 followers</span>
            </div>
            <div className="text-center py-4">
              <Users size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-xs">Share your broker link to gain followers</p>
              <p className="text-muted-foreground text-[10px] mt-0.5">Followers can see your picks and copy your strategy</p>
            </div>
          </div>
        </div>
      )}

      {/* Holdings tab */}
      {activeTab === "holdings" && (
      <div className="px-4 pt-4 space-y-3">
        <h2 className="font-semibold text-foreground text-sm">My Holdings</h2>
        {isLoading
          ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          : holdings?.length === 0
            ? (
              <div className="text-center py-12">
                <TrendingUp size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No holdings yet.</p>
                <p className="text-muted-foreground text-xs mt-1">Browse the market to buy your first farm shares.</p>
              </div>
            )
            : (holdings as Holding[])?.map((h) => {
                const isUp = h.gainLoss >= 0;
                const isExited = h.status === "exit_requested";
                const invested = h.purchasePrice * h.quantity;
                const midPayout = invested * 1.10;
                const fullPayout = invested * 1.22;
                const farmImg = getCropImage(h.cropType, h.imageUrl);

                return (
                  <div key={h.id} data-testid={`holding-${h.id}`} className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="relative h-20">
                      <img src={farmImg} alt={h.farmName} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                      <div className="absolute inset-0 p-3 flex items-end">
                        <div>
                          <p className="text-white font-bold text-sm">{h.farmName}</p>
                          <p className="text-white/70 text-[11px]">{h.cropType} · {h.location}</p>
                        </div>
                      </div>
                      {isExited && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Exit Pending
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-muted/50 rounded-xl p-2 text-center">
                          <p className="text-muted-foreground text-[9px]">Shares</p>
                          <p className="text-foreground font-bold text-xs">{h.quantity}</p>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-2 text-center">
                          <p className="text-muted-foreground text-[9px]">Value</p>
                          <p className="text-foreground font-bold text-xs">{formatKES(h.totalValue)}</p>
                        </div>
                        <div className={`rounded-xl p-2 text-center ${isUp ? "bg-green-50" : "bg-red-50"}`}>
                          <p className="text-muted-foreground text-[9px]">Gain/Loss</p>
                          <p className={`font-bold text-xs ${isUp ? "text-green-600" : "text-red-500"}`}>{formatChange(h.gainLossPercent)}</p>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-2.5">
                        <p className="text-green-700 text-[10px] font-semibold mb-1.5">Estimated Payout on Exit</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-muted-foreground text-[9px]">⚡ Mid-Season (+10%)</p>
                            <p className="text-orange-600 font-bold text-xs">{formatKES(midPayout)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[9px]">🌾 Full Season (+22%)</p>
                            <p className="text-green-600 font-bold text-xs">{formatKES(fullPayout)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          onClick={() => setShareHolding(h)}
                          className="py-2 px-2.5 rounded-xl border border-border text-muted-foreground text-xs font-medium active:scale-95 transition-all flex items-center gap-1"
                        >
                          <Share2 size={12} /> Share
                        </button>
                                        <Link
                          to={`/market/${h.farmId}`}
                          className="py-2 px-2.5 rounded-xl border border-border text-muted-foreground text-xs font-medium active:scale-95 transition-all flex items-center gap-1"
                        >
                          <ExternalLink size={12} /> View Farm
                        </Link>
                        {h.status === "active" && (
                          <>
                            <button
                              onClick={() => handleSellClick(h)}
                              className="flex-1 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1"
                            >
                              <Tag size={12} /> Sell
                            </button>
                            <button
                              onClick={() => handleExitClick(h)}
                              className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold active:scale-95 transition-all"
                            >
                              Exit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
        }
      </div>
      )}

      <ExitModal open={exitOpen} onClose={() => setExitOpen(false)} holding={selectedHolding} />
      <SellSharesModal open={sellOpen} onClose={() => setSellOpen(false)} holding={selectedHolding} />
      <ShareModal
        open={!!shareHolding}
        onClose={() => setShareHolding(null)}
        title={shareHolding?.farmName ?? ""}
        text={shareHolding ? `🌱 I'm invested in ${shareHolding.farmName} on Investa Farm! ${shareHolding.cropType} · ${shareHolding.location} · Earn up to +22% returns` : ""}
        url="https://investafarm.co.ke"
      />
      <BottomNav role="investor" />
    </div>
  );
}
