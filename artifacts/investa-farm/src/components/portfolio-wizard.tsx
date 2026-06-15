import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Sliders, Leaf, Star, Loader2, ChevronRight, Check, Pencil, TrendingUp } from "lucide-react";
import { formatKES, getToken } from "@/lib/auth";
import { getCropImage } from "@/lib/crops";

interface PortfolioWizardProps {
  onClose: () => void;
  onCreated?: () => void;
}

const STRATEGIES = [
  { key: "growth",            label: "High Growth",        icon: <Zap size={20} />,      color: "border-amber-300 bg-amber-50",   desc: "Max returns, higher risk. Maize, avocado, coffee exports." },
  { key: "balanced",          label: "Balanced",            icon: <Sliders size={20} />,  color: "border-blue-300 bg-blue-50",     desc: "Mix of crops & regions. Moderate risk & steady returns." },
  { key: "climate_resilient", label: "Climate Resilient",   icon: <Leaf size={20} />,     color: "border-green-300 bg-green-50",   desc: "High NDVI farms, low weather risk. Drought-resistant crops." },
  { key: "custom",            label: "Custom",              icon: <Star size={20} />,     color: "border-purple-300 bg-purple-50", desc: "Manual override – you pick your own mix." },
];

type Step = "name" | "strategy" | "risk" | "review" | "done";

export function PortfolioWizard({ onClose, onCreated }: PortfolioWizardProps) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [strategy, setStrategy] = useState<string | null>(null);
  const [risk, setRisk] = useState(5);
  const [fee, setFee] = useState(0);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editWeight, setEditWeight] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const token = getToken();

  const generateAI = async () => {
    setGenerating(true);
    try {
      const r = await fetch("/api/portfolio-manager/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetRisk: risk, strategy }),
      });
      const data = await r.json();
      setHoldings(data.holdings ?? []);
      setStep("review");
    } finally { setGenerating(false); }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/portfolio-manager/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name, description, strategy: strategy ?? "balanced",
          targetRisk: risk, managementFeePercent: fee,
          holdings: holdings.map(h => ({ farmId: h.farmId, weightPercent: h.weightPercent })),
        }),
      });
      if (r.ok) {
        setStep("done");
        onCreated?.();
      }
    } finally { setSaving(false); }
  };

  const applyEditWeight = (idx: number) => {
    const val = parseFloat(editVal);
    if (!isNaN(val) && val > 0 && val <= 100) {
      setHoldings(prev => prev.map((h, i) => i === idx ? { ...h, weightPercent: Math.round(val * 10) / 10 } : h));
    }
    setEditWeight(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp size={16} className="text-primary" />
              </div>
              <p className="text-foreground font-bold text-base">AI Portfolio Builder</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <X size={15} />
            </button>
          </div>
          {/* Step dots */}
          <div className="flex gap-1.5 mt-2">
            {(["name","strategy","risk","review"] as Step[]).map((s, i) => (
              <div key={s} className={`h-1 rounded-full flex-1 transition-all ${
                ["name","strategy","risk","review","done"].indexOf(step) >= i ? "bg-primary" : "bg-muted"
              }`} />
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pt-4 pb-8">
          <AnimatePresence mode="wait">
            {/* Step 1: Name */}
            {step === "name" && (
              <motion.div key="name" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <p className="text-foreground font-bold text-lg">Name your portfolio</p>
                  <p className="text-muted-foreground text-sm mt-1">Give it a memorable name that reflects your strategy.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Portfolio Name *</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Mega Maize Growth"
                    className="w-full border border-border rounded-xl px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description (optional)</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe your investment thesis..."
                    rows={3}
                    className="w-full border border-border rounded-xl px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Management Fee (0–2% / yr)</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={2} step={0.1} value={fee}
                      onChange={e => setFee(parseFloat(e.target.value))}
                      className="flex-1 accent-primary" />
                    <span className="text-foreground font-bold text-sm w-12 text-right">{fee.toFixed(1)}%</span>
                  </div>
                  <p className="text-muted-foreground text-[10px]">You earn 70% of this fee from followers daily. Platform takes 30%.</p>
                </div>
                <button
                  onClick={() => setStep("strategy")}
                  disabled={!name.trim()}
                  className="w-full bg-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  Next: Choose Strategy <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

            {/* Step 2: Strategy */}
            {step === "strategy" && (
              <motion.div key="strategy" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <p className="text-foreground font-bold text-lg">Select a Strategy</p>
                  <p className="text-muted-foreground text-sm mt-1">AI will pre-fill farm picks based on this.</p>
                </div>
                <div className="space-y-2">
                  {STRATEGIES.map(s => (
                    <button key={s.key} onClick={() => setStrategy(s.key)}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${strategy === s.key ? s.color : "border-border bg-white"}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${strategy === s.key ? "bg-white/60" : "bg-muted"}`}>
                        {s.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground">{s.label}</p>
                        <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{s.desc}</p>
                      </div>
                      {strategy === s.key && <Check size={18} className="text-primary flex-shrink-0 mt-0.5" />}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setStep("name")} className="py-3 rounded-xl border border-border text-foreground text-sm font-semibold">Back</button>
                  <button onClick={() => setStep("risk")} disabled={!strategy}
                    className="py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-40">
                    Next: Set Risk
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Risk */}
            {step === "risk" && (
              <motion.div key="risk" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div>
                  <p className="text-foreground font-bold text-lg">Set Target Risk</p>
                  <p className="text-muted-foreground text-sm mt-1">AI will optimise farm weights to match your risk appetite.</p>
                </div>
                <div className="bg-muted/40 rounded-2xl p-4 text-center">
                  <p className="text-6xl font-black text-primary mb-1">{risk}</p>
                  <p className="text-muted-foreground text-sm">{risk <= 3 ? "Conservative" : risk <= 6 ? "Moderate" : risk <= 8 ? "Aggressive" : "High Risk"}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 — Conservative</span>
                    <span>10 — High Risk</span>
                  </div>
                  <input type="range" min={1} max={10} step={1} value={risk}
                    onChange={e => setRisk(parseInt(e.target.value))}
                    className="w-full accent-primary h-2" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[{r:3,l:"Safe",c:"bg-green-50 text-green-700"},{r:6,l:"Balanced",c:"bg-blue-50 text-blue-700"},{r:9,l:"Growth",c:"bg-red-50 text-red-700"}].map(({r,l,c})=>(
                    <button key={r} onClick={() => setRisk(r)} className={`rounded-xl py-2 text-xs font-bold transition-all ${c}`}>{l} ({r})</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setStep("strategy")} className="py-3 rounded-xl border border-border text-foreground text-sm font-semibold">Back</button>
                  <button onClick={generateAI} disabled={generating}
                    className="py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-1.5">
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    {generating ? "AI Building…" : "Generate Portfolio"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Review */}
            {step === "review" && (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <p className="text-foreground font-bold text-lg">Review & Edit</p>
                  <p className="text-muted-foreground text-sm mt-1">AI selected {holdings.length} farms. Tap a weight to adjust it.</p>
                </div>
                <div className="space-y-2">
                  {holdings.map((h, i) => (
                    <div key={h.farmId} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                      <span className="text-muted-foreground text-xs font-bold w-5 text-center">{i + 1}</span>
                      <img src={getCropImage(h.cropType ?? "")} alt={h.cropType ?? ""}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-semibold text-xs truncate">{h.farmName}</p>
                        <p className="text-muted-foreground text-[10px]">{h.cropType} · Risk {h.riskScore}/10</p>
                        <p className="text-green-600 text-[10px] font-semibold">+{h.expectedReturn}% est.</p>
                      </div>
                      {editWeight === i ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="number" min={1} max={100} step={0.5}
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onBlur={() => applyEditWeight(i)}
                            onKeyDown={e => e.key === "Enter" && applyEditWeight(i)}
                            className="w-16 border border-primary rounded-lg px-2 py-1 text-xs text-right font-bold"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditWeight(i); setEditVal(String(h.weightPercent)); }}
                          className="flex items-center gap-1 bg-white border border-border rounded-lg px-2.5 py-1.5"
                        >
                          <span className="text-primary font-bold text-sm">{h.weightPercent}%</span>
                          <Pencil size={10} className="text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Weight</span>
                  <span className={`font-bold ${Math.abs(holdings.reduce((s, h) => s + h.weightPercent, 0) - 100) < 1 ? "text-green-600" : "text-red-500"}`}>
                    {holdings.reduce((s, h) => s + h.weightPercent, 0).toFixed(1)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setStep("risk")} className="py-3 rounded-xl border border-border text-foreground text-sm font-semibold">Regenerate</button>
                  <button onClick={handleCreate} disabled={saving}
                    className="py-3 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-1.5">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {saving ? "Creating…" : "Create Portfolio"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Done */}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <Check size={40} className="text-green-500" />
                </div>
                <div>
                  <p className="text-foreground font-bold text-xl">Portfolio Created!</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    <strong>"{name}"</strong> is ready. Publish it to share with the community.
                  </p>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 w-full text-left space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Farms</span>
                    <span className="font-bold">{holdings.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Strategy</span>
                    <span className="font-bold capitalize">{strategy?.replace("_"," ")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Risk Level</span>
                    <span className="font-bold">{risk}/10</span>
                  </div>
                  {fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Management Fee</span>
                      <span className="font-bold">{fee}%/yr</span>
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">Go to Portfolio Manager tab to publish and share your link.</p>
                <button onClick={onClose} className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all">
                  Done
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
