import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, RefreshCw, Wallet, TrendingUp, ChevronRight, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { getToken } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";

const CROPS = ["any", "maize", "beans", "tomatoes", "rice", "dairy", "poultry", "coffee", "wheat", "sunflower", "kale"];
const CROP_LABELS: Record<string, string> = {
  any: "Any crop", maize: "🌽 Maize", beans: "🫘 Beans", tomatoes: "🍅 Tomatoes",
  rice: "🌾 Rice", dairy: "🐄 Dairy", poultry: "🐓 Poultry", coffee: "☕ Coffee",
  wheat: "🌾 Wheat", sunflower: "🌻 Sunflower", kale: "🥬 Kale",
};

type Rule = {
  enabled: boolean;
  reinvestPercent: number;
  walletPercent: number;
  cropPreference: string;
  minAmount: number;
  maxFarms: number;
  riskTolerance: string;
};

type SimResult = {
  enabled: boolean;
  payoutAmount: number;
  reinvestAmount: number;
  walletAmount: number;
  reinvestPercent: number;
  walletPercent: number;
  suggestedFarms: Array<{ id: number; name: string; cropType: string; location: string; riskScore: number; allotment: number; sharesAtCurrentPrice: number }>;
};

export function ReinvestmentSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const token = getToken();
  const { formatAmount } = useCurrency();
  const [rule, setRule] = useState<Rule>({
    enabled: false, reinvestPercent: 70, walletPercent: 30,
    cropPreference: "any", minAmount: 1000, maxFarms: 3, riskTolerance: "moderate",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [simAmount, setSimAmount] = useState("10000");
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [tab, setTab] = useState<"settings" | "simulate">("settings");

  useEffect(() => {
    if (!open) return;
    fetch("/api/reinvestment/rule", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error("fetch failed"); return r.json(); })
      .then(d => setRule({
        enabled: d.enabled ?? false,
        reinvestPercent: Number(d.reinvestPercent ?? 70),
        walletPercent: Number(d.walletPercent ?? 30),
        cropPreference: d.cropPreference ?? "any",
        minAmount: Number(d.minAmount ?? 1000),
        maxFarms: Number(d.maxFarms ?? 3),
        riskTolerance: d.riskTolerance ?? "moderate",
      }))
      .catch(() => {});
  }, [open]);

  const setReinvest = (val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    setRule(r => ({ ...r, reinvestPercent: clamped, walletPercent: 100 - clamped }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/reinvestment/rule", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(rule),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleSimulate = async () => {
    setSimLoading(true);
    try {
      const r = await fetch("/api/reinvestment/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payoutAmount: Number(simAmount) }),
      });
      setSimResult(await r.json());
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="sticky top-0 bg-background pt-4 pb-3 px-4 border-b border-border z-10">
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
                    <RefreshCw size={15} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">Reinvestment Automation</p>
                    <p className="text-muted-foreground text-[10px]">Auto-reinvest harvest payouts</p>
                  </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={15} />
                </button>
              </div>

              <div className="flex bg-muted rounded-xl p-0.5 gap-0.5 mt-3">
                {(["settings", "simulate"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${t === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >
                    {t === "settings" ? "⚙️ Rules" : "🔬 Simulate"}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 pb-8 pt-4 space-y-4">
              {tab === "settings" && (
                <>
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex items-start gap-3">
                    <Zap size={16} className="text-violet-600 flex-shrink-0 mt-0.5" />
                    <p className="text-violet-800 text-xs leading-relaxed">
                      When you receive a harvest payout or exit payment, Investa Farm will automatically split it between new farm investments and your wallet based on the rules you set here.
                    </p>
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-foreground">Enable Auto-Reinvest</p>
                        <p className="text-muted-foreground text-[10px] mt-0.5">Trigger on every exit payout</p>
                      </div>
                      <button
                        onClick={() => setRule(r => ({ ...r, enabled: !r.enabled }))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${rule.enabled ? "bg-violet-600" : "bg-muted-foreground/30"}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${rule.enabled ? "translate-x-6" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                  </div>

                  <div className={`space-y-4 transition-opacity ${rule.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                      <p className="font-bold text-sm text-foreground">Split Allocation</p>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <TrendingUp size={14} className="text-violet-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Reinvest into farms</span>
                            <span className="text-xs font-bold text-violet-600">{rule.reinvestPercent}%</span>
                          </div>
                          <input
                            type="range" min={0} max={100} step={5}
                            value={rule.reinvestPercent}
                            onChange={e => setReinvest(Number(e.target.value))}
                            className="w-full accent-violet-600 h-1.5"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1 bg-violet-50 rounded-xl p-2.5 text-center border border-violet-100">
                          <TrendingUp size={12} className="text-violet-600 mx-auto mb-1" />
                          <p className="text-violet-700 font-extrabold text-sm">{rule.reinvestPercent}%</p>
                          <p className="text-violet-500 text-[9px]">New farm shares</p>
                        </div>
                        <div className="flex-1 bg-green-50 rounded-xl p-2.5 text-center border border-green-100">
                          <Wallet size={12} className="text-green-600 mx-auto mb-1" />
                          <p className="text-green-700 font-extrabold text-sm">{rule.walletPercent}%</p>
                          <p className="text-green-500 text-[9px]">To wallet / M-Pesa</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                      <p className="font-bold text-sm text-foreground">Crop Preference</p>
                      <div className="flex flex-wrap gap-1.5">
                        {CROPS.map(c => (
                          <button
                            key={c}
                            onClick={() => setRule(r => ({ ...r, cropPreference: c }))}
                            className={`px-2.5 py-1.5 rounded-full text-[10px] font-semibold border transition-all ${rule.cropPreference === c ? "bg-violet-600 text-white border-violet-600" : "bg-muted border-border text-muted-foreground"}`}
                          >
                            {CROP_LABELS[c] ?? c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                      <p className="font-bold text-sm text-foreground">Risk Tolerance</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: "low", label: "🛡️ Low", desc: "Risk score 8–10" },
                          { key: "moderate", label: "⚖️ Moderate", desc: "Score 5–8" },
                          { key: "high", label: "🚀 High", desc: "Any score" },
                        ].map(({ key, label, desc }) => (
                          <button
                            key={key}
                            onClick={() => setRule(r => ({ ...r, riskTolerance: key }))}
                            className={`p-2.5 rounded-xl border text-center transition-all ${rule.riskTolerance === key ? "bg-violet-600 text-white border-violet-600" : "bg-muted border-border"}`}
                          >
                            <p className={`text-xs font-bold ${rule.riskTolerance === key ? "text-white" : "text-foreground"}`}>{label}</p>
                            <p className={`text-[9px] mt-0.5 ${rule.riskTolerance === key ? "text-white/70" : "text-muted-foreground"}`}>{desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-card border border-border rounded-2xl p-3 space-y-2">
                        <p className="text-xs font-bold text-foreground">Min payout to trigger</p>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-xs">KES</span>
                          <input
                            type="number"
                            value={rule.minAmount}
                            onChange={e => setRule(r => ({ ...r, minAmount: Number(e.target.value) }))}
                            className="flex-1 text-sm font-bold border-0 bg-transparent focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="bg-card border border-border rounded-2xl p-3 space-y-2">
                        <p className="text-xs font-bold text-foreground">Max farms per payout</p>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 5].map(n => (
                            <button
                              key={n}
                              onClick={() => setRule(r => ({ ...r, maxFarms: n }))}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${rule.maxFarms === n ? "bg-violet-600 text-white" : "bg-muted text-muted-foreground"}`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 bg-violet-600 text-white active:scale-95 shadow-lg shadow-violet-500/25"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <RefreshCw size={16} />}
                    {saving ? "Saving…" : saved ? "Saved!" : "Save Rule"}
                  </button>
                </>
              )}

              {tab === "simulate" && (
                <>
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <p className="font-bold text-sm text-foreground">Simulate a Payout</p>
                    <p className="text-muted-foreground text-xs">Enter a hypothetical exit payout and see exactly how your rule would split and invest it.</p>
                    <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                      <span className="text-muted-foreground text-sm font-semibold">KES</span>
                      <input
                        type="number"
                        value={simAmount}
                        onChange={e => setSimAmount(e.target.value)}
                        placeholder="10000"
                        className="flex-1 bg-transparent text-lg font-bold focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleSimulate}
                      disabled={simLoading}
                      className="w-full py-3 rounded-xl font-bold text-sm bg-violet-600 text-white active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {simLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      {simLoading ? "Simulating…" : "Run Simulation"}
                    </button>
                  </div>

                  {simResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      {!simResult.enabled ? (
                        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
                          <AlertCircle size={16} className="text-orange-500" />
                          <p className="text-orange-700 text-sm">Enable Auto-Reinvest in Settings first.</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3 text-center">
                              <TrendingUp size={16} className="text-violet-600 mx-auto mb-1" />
                              <p className="text-violet-700 font-extrabold text-base">{formatAmount(simResult.reinvestAmount)}</p>
                              <p className="text-violet-500 text-[10px]">{simResult.reinvestPercent}% → Farm shares</p>
                            </div>
                            <div className="bg-green-50 border border-green-100 rounded-2xl p-3 text-center">
                              <Wallet size={16} className="text-green-600 mx-auto mb-1" />
                              <p className="text-green-700 font-extrabold text-base">{formatAmount(simResult.walletAmount)}</p>
                              <p className="text-green-500 text-[10px]">{simResult.walletPercent}% → Wallet / M-Pesa</p>
                            </div>
                          </div>

                          {simResult.suggestedFarms.length > 0 ? (
                            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                              <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                <Zap size={14} className="text-violet-600" /> AI-Matched Farm Allocations
                              </p>
                              {simResult.suggestedFarms.map((f, i) => (
                                <div key={f.id} className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-violet-600">
                                    {i + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{f.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{f.cropType} · Risk {f.riskScore}/10</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs font-bold text-violet-600">{formatAmount(f.allotment)}</p>
                                    <p className="text-[9px] text-muted-foreground">{f.sharesAtCurrentPrice} shares</p>
                                  </div>
                                  <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-muted/40 rounded-2xl p-4 text-center">
                              <p className="text-muted-foreground text-xs">No farms match your current risk and crop preferences. Adjust your settings and try again.</p>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
