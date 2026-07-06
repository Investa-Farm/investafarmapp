import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, Users, Award, BarChart2, Info, ExternalLink, Sprout, ShieldCheck } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { formatKES, getToken } from "@/lib/auth";
import { getCropImage } from "@/lib/crops";
import { Sparkline, generateSparkData } from "@/components/sparkline";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/lib/currency";
import { InvestModal } from "@/components/invest-modal";
import { motion } from "framer-motion";
import { AiYieldPredictor } from "@/components/ai-yield-predictor";

const CROP_FUNDAMENTALS: Record<string, { season: string; harvestMonths: string; keyMarkets: string; avgYield: string; outlook: string }> = {
  maize:    { season: "Long Rains (Mar–Aug)", harvestMonths: "Jul–Aug", keyMarkets: "Nairobi, Mombasa, Kisumu", avgYield: "2.5–4 t/ha", outlook: "Demand rising due to population growth and ethanol production." },
  coffee:   { season: "Main Crop (Oct–Jan)",  harvestMonths: "Oct–Dec", keyMarkets: "EU, US, Japan (export)",  avgYield: "0.5–1.2 t/ha", outlook: "Global arabica prices near 10-year highs. Strong export premiums." },
  avocado:  { season: "Hass (Apr–Aug)",        harvestMonths: "May–Jul", keyMarkets: "EU (Netherlands), UAE",  avgYield: "5–12 t/ha",   outlook: "EU demand surging. Kenya's window vs Mexico is highly favourable." },
  tea:      { season: "Year-round",            harvestMonths: "Ongoing", keyMarkets: "Pakistan, UK, Egypt",    avgYield: "1,500–2,500 kg/ha", outlook: "Mombasa auction prices steady. Weather risk from La Niña." },
  wheat:    { season: "Short Rains (Oct–Feb)", harvestMonths: "Jan–Feb", keyMarkets: "EAGA region",            avgYield: "2–3.5 t/ha",  outlook: "Import substitution policy boosting local demand." },
  tomatoes: { season: "Dry Season (Jun–Sep)",  harvestMonths: "Aug–Sep", keyMarkets: "Nairobi wholesale",      avgYield: "20–40 t/ha",  outlook: "High price volatility. Strong returns in off-peak periods." },
  beans:    { season: "Long Rains (Mar–Jun)",  harvestMonths: "Jun",     keyMarkets: "East Africa region",     avgYield: "0.8–1.5 t/ha", outlook: "Stable demand. Ideal for low-risk, short-season investors." },
  rice:     { season: "Short Rains",           harvestMonths: "Dec–Jan", keyMarkets: "Nairobi, Coast",         avgYield: "3–5 t/ha",    outlook: "Import competition from Asia. Local quality commands premium." },
  sunflower:{ season: "Dry Season",            harvestMonths: "Sep–Oct", keyMarkets: "Oil processors, Nakuru", avgYield: "1.2–2 t/ha",  outlook: "Rising edible oil demand. Good for diversified portfolios." },
  dairy:    { season: "Year-round",            harvestMonths: "Ongoing", keyMarkets: "KCC, local creameries",  avgYield: "10–25 L/cow/day", outlook: "Consistent demand. Good hedge against crop season risk." },
  poultry:  { season: "Year-round",            harvestMonths: "Ongoing", keyMarkets: "Nairobi restaurants",    avgYield: "Varies",      outlook: "Urban demand growing fast. Short cycles reduce risk." },
};

function getFundamentals(crop: string) {
  return CROP_FUNDAMENTALS[crop?.toLowerCase()] ?? {
    season: "Varies by region", harvestMonths: "Varies", keyMarkets: "East Africa",
    avgYield: "Varies", outlook: "Strong agricultural fundamentals in Kenya.",
  };
}

function buildDividendTable(sharePrice: number, alpha: number = 0.20) {
  const scenarios = [
    { label: "Bear Case",  rev: 1_500_000, prob: "20%", color: "text-red-600" },
    { label: "Base Case",  rev: 2_200_000, prob: "55%", color: "text-foreground" },
    { label: "Bull Case",  rev: 3_000_000, prob: "25%", color: "text-green-600" },
  ];
  return scenarios.map(s => ({
    ...s,
    dividendPerShare: (s.rev * alpha) / 10_000,
    returnPct: (((s.rev * alpha) / 10_000 - sharePrice) / sharePrice) * 100,
  }));
}

const LEADERBOARD = [
  { name: "David M.",   invested: 250_000, return: 18.4, badge: "🥇" },
  { name: "Grace W.",   invested: 185_000, return: 16.1, badge: "🥈" },
  { name: "Peter K.",   invested: 140_000, return: 14.8, badge: "🥉" },
  { name: "Amina S.",   invested: 98_000,  return: 12.3, badge: "4" },
  { name: "James O.",   invested: 72_000,  return: 11.7, badge: "5" },
];

export default function FarmExchange() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"overview" | "dividends" | "leaderboard" | "fundamentals">("overview");
  const [investOpen, setInvestOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const token = getToken();
  const { formatAmount } = useCurrency();

  const farmId = parseInt(params.id ?? "", 10);
  const isValidId = !isNaN(farmId) && farmId > 0;

  const { data: farm, isLoading, isError } = useQuery<any>({
    queryKey: ["farm-exchange", params.id],
    queryFn: async () => {
      const r = await fetch(`/api/farms/${params.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: isValidId,
    staleTime: 30_000,
    retry: false,
  });

  const isUp = (farm?.changePercent ?? 0) >= 0;
  const sparkData = farm ? generateSparkData(farm.currentPrice ?? farm.sharePrice, 20, (farm.changePercent ?? 0) / 100) : [];
  const dividends = farm ? buildDividendTable(Number(farm.currentPrice ?? farm.sharePrice)) : [];
  const fundamentals = farm ? getFundamentals(farm.cropType) : null;

  if (!isValidId || isError) {
    return (
      <div className="app-shell pb-20 flex flex-col items-center justify-center min-h-[60vh] px-8 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Info size={28} className="text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-foreground font-bold text-base">Farm not found</p>
          <p className="text-muted-foreground text-xs mt-1">This farm listing may have been removed or the link is invalid.</p>
        </div>
        <button onClick={() => setLocation("/market")}
          className="bg-primary text-white font-semibold px-6 py-2.5 rounded-xl text-sm active:scale-95 transition-transform">
          Back to Market
        </button>
        <BottomNav role="investor" />
      </div>
    );
  }

  return (
    <div className="app-shell pb-20 page-enter">
      {/* Hero header */}
      <div className="hero-header pt-12 pb-4 px-5 relative">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setLocation(-1 as any)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <p className="text-white/70 text-xs">Farm Exchange</p>
            <span className="inline-flex items-center gap-1 bg-green-400/30 border border-green-400/40 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-200 text-[9px] font-bold">LIVE</span>
            </span>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 rounded-2xl bg-white/20" />
        ) : farm ? (
          <>
            <div className="flex items-start gap-3">
              <img src={getCropImage(farm.cropType, farm.imageUrl)} alt={farm.name}
                className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 border-2 border-white/30" />
              <div className="flex-1 min-w-0">
                <h1 className="text-white text-lg font-extrabold leading-tight">{farm.name}</h1>
                <p className="text-white/70 text-xs mt-0.5">{farm.cropType} · {farm.location}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-white text-2xl font-black">{formatAmount(farm.currentPrice ?? farm.sharePrice)}</span>
                  <span className={`flex items-center gap-0.5 text-sm font-bold ${isUp ? "text-green-300" : "text-red-300"}`}>
                    {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {isUp ? "+" : ""}{(farm.changePercent ?? 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Mini chart */}
            <div className="mt-3 bg-white/10 rounded-xl p-2">
              <Sparkline data={sparkData} color={isUp ? "#86efac" : "#fca5a5"} height={40} />
            </div>

            <div className="grid grid-cols-4 gap-2 mt-3">
              {[
                { label: "Shares",   val: String(farm.totalShares ?? "—") },
                { label: "Available", val: String(farm.sharesAvailable ?? "—") },
                { label: "Volume",   val: String(farm.tradeCount ?? 0) },
                { label: "Status",   val: farm.status ?? "Active" },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white/15 rounded-xl p-2 text-center">
                  <p className="text-white text-xs font-bold capitalize truncate">{val}</p>
                  <p className="text-white/50 text-[9px] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Tab bar */}
      <div className="px-4 pt-3 sticky top-0 z-10 bg-background border-b border-border pb-2">
        <div className="flex bg-muted rounded-2xl p-1 gap-0.5">
          {(["overview","dividends","leaderboard","fundamentals"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold capitalize transition-all ${activeTab === t ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Overview Tab */}
        {activeTab === "overview" && !isLoading && farm && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
              <p className="text-foreground font-bold text-sm flex items-center gap-2">
                <Info size={14} className="text-primary" /> Farm Overview
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {farm.description ?? `${farm.name} is an active ${farm.cropType} farm listed on the Investa Farm Exchange. Investors earn a share of harvest revenue.`}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Funding Target", val: formatKES(farm.loanAmount ?? 0) },
                  { label: "Share Price",    val: formatAmount(farm.currentPrice ?? farm.sharePrice) },
                  { label: "Shares Issued",  val: String(farm.totalShares ?? "—") },
                  { label: "Investor Share", val: "20% of harvest" },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-muted/40 rounded-xl p-2.5">
                    <p className="text-muted-foreground text-[10px]">{label}</p>
                    <p className="text-foreground font-bold text-sm mt-0.5">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
              <p className="text-foreground font-bold text-sm flex items-center gap-2">
                <BarChart2 size={14} className="text-primary" /> Price History (20-day)
              </p>
              <div className="bg-muted/30 rounded-xl p-2">
                <Sparkline data={sparkData} color={isUp ? "#16a34a" : "#dc2626"} height={60} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div><p className="text-muted-foreground">7D High</p><p className="font-bold text-green-600">{formatAmount(Math.max(...(sparkData as number[])))}</p></div>
                <div><p className="text-muted-foreground">7D Low</p><p className="font-bold text-red-500">{formatAmount(Math.min(...(sparkData as number[])))}</p></div>
                <div><p className="text-muted-foreground">Change</p><p className={`font-bold ${isUp?"text-green-600":"text-red-500"}`}>{isUp?"+":""}{(farm.changePercent??0).toFixed(2)}%</p></div>
              </div>
            </div>

            <AiYieldPredictor
              farmId={farm.id}
              farmName={farm.name}
              cropType={farm.cropType}
              fundingPercent={farm.fundingPercent ?? 0}
              daysRemaining={farm.harvestDays ?? 120}
              riskScore={farm.riskScore ?? 7}
            />

            <button
              onClick={() => { setSelectedListing({ id: farm.id, farmId: farm.id, farmName: farm.name, cropType: farm.cropType, location: farm.location, pricePerShare: farm.currentPrice ?? farm.sharePrice, sharesAvailable: farm.sharesAvailable, changePercent: farm.changePercent }); setInvestOpen(true); }}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 text-base"
            >
              <Sprout size={18} /> Invest in {farm.cropType}
            </button>
          </motion.div>
        )}

        {/* Dividends Tab */}
        {activeTab === "dividends" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
              <p className="text-primary font-bold text-sm mb-1">Dividend Model</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Investors collectively receive <strong>20% of total harvest revenue</strong>. Dividends are distributed per share after harvest. Scenarios below are based on AI yield forecasts.
              </p>
            </div>

            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="bg-muted/50 grid grid-cols-4 px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                <span>Scenario</span><span className="text-right">Revenue</span><span className="text-right">Div/Share</span><span className="text-right">Return</span>
              </div>
              {dividends.map(d => (
                <div key={d.label} className="grid grid-cols-4 px-4 py-3 border-t border-border items-center">
                  <div>
                    <p className={`text-xs font-bold ${d.color}`}>{d.label}</p>
                    <p className="text-muted-foreground text-[9px]">{d.prob} prob.</p>
                  </div>
                  <p className="text-right text-xs font-semibold">{formatKES(d.rev)}</p>
                  <p className="text-right text-xs font-bold text-primary">{formatAmount(d.dividendPerShare)}</p>
                  <p className={`text-right text-xs font-bold ${d.returnPct >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {d.returnPct >= 0 ? "+" : ""}{d.returnPct.toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-border rounded-2xl p-4 space-y-2">
              <p className="text-foreground font-bold text-sm">Fee Structure</p>
              {[
                { label: "Primary Purchase Fee", val: "1.5% of investment" },
                { label: "Secondary Trade Fee",  val: "0.5% per side" },
                { label: "Withdrawal Fee",        val: "0.5% (max KES 260)" },
                { label: "Exit Penalty",          val: "5% if early exit" },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{val}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-primary/90 to-green-600 px-4 py-3 flex items-center gap-2">
                <Award size={16} className="text-white" />
                <p className="text-white font-bold text-sm">Top Investors in this Farm</p>
              </div>
              {LEADERBOARD.map((inv, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-t border-border">
                  <span className="text-lg w-6 text-center">{inv.badge}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-semibold text-sm">{inv.name}</p>
                    <p className="text-muted-foreground text-xs">{formatKES(inv.invested)} invested</p>
                  </div>
                  <span className="text-green-600 font-bold text-sm">+{inv.return}%</span>
                </div>
              ))}
            </div>

            <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
              <p className="text-foreground font-bold text-sm flex items-center gap-2">
                <TrendingUp size={14} className="text-primary" /> Crop Performance League
              </p>
              <p className="text-muted-foreground text-xs">How this crop compares to others this season:</p>
              {[
                { crop: "Coffee",   return: 24.1, pos: 1 },
                { crop: "Avocado",  return: 21.8, pos: 2 },
                { crop: "Maize",    return: 16.3, pos: 3 },
                { crop: "Tea",      return: 14.9, pos: 4 },
                { crop: "Beans",    return: 13.2, pos: 5 },
              ].map(c => (
                <div key={c.crop} className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs w-4 text-center">#{c.pos}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div className="bg-primary rounded-full h-2" style={{ width: `${(c.return / 25) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-16 text-right">{c.crop} +{c.return}%</span>
                </div>
              ))}
              <p className="text-muted-foreground text-[10px] italic">Source: Investa Farm Exchange season data</p>
            </div>
          </motion.div>
        )}

        {/* Fundamentals Tab */}
        {activeTab === "fundamentals" && fundamentals && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <img src={farm ? getCropImage(farm.cropType, farm.imageUrl) : ""} alt=""
                className="w-full h-40 object-cover" />
              <div className="p-4 space-y-3">
                <p className="text-foreground font-bold text-sm flex items-center gap-2">
                  <Sprout size={14} className="text-primary" /> {farm?.cropType} Crop Fundamentals
                </p>
                {[
                  { label: "Season",        val: fundamentals.season },
                  { label: "Harvest Period", val: fundamentals.harvestMonths },
                  { label: "Key Markets",   val: fundamentals.keyMarkets },
                  { label: "Avg Yield",     val: fundamentals.avgYield },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-right max-w-[55%]">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-800 font-bold text-sm mb-1">Market Outlook</p>
                  <p className="text-green-700 text-sm leading-relaxed">{fundamentals.outlook}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4 space-y-2">
              <p className="text-foreground font-bold text-sm">Why invest in {farm?.cropType}?</p>
              <ul className="space-y-2">
                {[
                  "Kenya is one of Africa's top 5 exporters for this crop",
                  "Investa Farm farms use AI-monitored NDVI for quality assurance",
                  "Farm managers have an average 3+ seasons track record",
                  "Exit options available mid-season or full season",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-primary font-bold mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </div>

      {investOpen && selectedListing && (
        <InvestModal
          open={investOpen}
          onClose={() => setInvestOpen(false)}
          listing={selectedListing}
        />
      )}

      <BottomNav role="investor" />
    </div>
  );
}
