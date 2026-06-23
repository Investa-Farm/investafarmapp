import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { BottomNav } from "@/components/bottom-nav";
import { getToken } from "@/lib/auth";
import { ArrowLeft, Sprout, DollarSign, MapPin, Calendar, ChevronRight, CheckCircle2, Loader2, Leaf, TrendingUp, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CROP_OPTIONS = [
  "Maize", "Wheat", "Barley", "Sorghum", "Millet",
  "Tomatoes", "Onions", "Capsicum", "French Beans", "Kales",
  "Avocado", "Mango", "Coffee", "Tea", "Macadamia",
  "Sunflower", "Soybeans", "Chickpeas", "Pigeon Peas",
];

const COUNTIES = [
  "Nairobi", "Kiambu", "Nakuru", "Meru", "Eldoret / Uasin Gishu", "Trans Nzoia",
  "Kisumu", "Kitale", "Nyeri", "Nandi", "Bungoma", "Kakamega",
  "Murang'a", "Embu", "Machakos", "Kajiado", "Laikipia", "Nyandarua",
];

const COST_BREAKDOWN = [
  { label: "Seeds & Inputs", pct: 0.30 },
  { label: "Labour", pct: 0.22 },
  { label: "Land Preparation", pct: 0.18 },
  { label: "Irrigation", pct: 0.12 },
  { label: "Pest & Disease Control", pct: 0.10 },
  { label: "Transport & Logistics", pct: 0.08 },
];

const inputClass = "w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";
const labelClass = "text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5";

export default function CropProposal() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    cropType: "",
    acreage: "",
    location: "",
    season: "",
    expectedYield: "",
    fundingAmount: "",
    description: "",
  });

  const fundingAmt = parseFloat(form.fundingAmount) || 0;
  const projectedRevenue = fundingAmt * 2.4;
  const farmerShare = Math.round(projectedRevenue * 0.55);
  const investorShare = Math.round(projectedRevenue * 0.40);
  const platformFee = Math.round(projectedRevenue * 0.05);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/loans/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: fundingAmt,
          purpose: "other",
          purposeDetails: `${form.cropType} crop production — ${form.acreage} acres in ${form.location}. Expected yield: ${form.expectedYield} tons. Season: ${form.season}. ${form.description || ""}`.trim(),
          repaymentPeriodMonths: 6,
          cropType: form.cropType,
          location: form.location,
          farmName: `${form.cropType} Farm — ${form.location}`,
          acreage: form.acreage,
          expectedYieldKg: form.expectedYield,
          expectedRevenue: Math.round(fundingAmt * 2.4),
          farmerShare: farmerShare,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (data.error === "KYC_REQUIRED") throw new Error("Please complete KYC verification first. Go to Profile → KYC Documents to upload your ID and farm documents.");
        throw new Error(data.message ?? data.error ?? "Submission failed");
      }
      return data;
    },
    onSuccess: () => setSubmitted(true),
  });

  const canAdvance1 = form.cropType && form.acreage && form.location && form.season;
  const canAdvance2 = form.expectedYield && form.fundingAmount && parseFloat(form.fundingAmount) >= 10000;

  if (submitted) {
    return (
      <div className="app-shell pb-20 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 size={36} className="text-green-600" />
        </div>
        <h2 className="text-foreground font-bold text-xl mb-2">Proposal Submitted!</h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          Your crop funding proposal has been sent to the admin team. You'll receive a review within 2–3 business days.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 w-full mb-6 text-left space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Crop</span>
            <span className="text-foreground text-xs font-semibold">{form.cropType}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Funding Requested</span>
            <span className="text-foreground text-xs font-semibold">KES {Number(form.fundingAmount).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Location</span>
            <span className="text-foreground text-xs font-semibold">{form.location}</span>
          </div>
        </div>
        <button onClick={() => setLocation("/farmer/market")}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-sm active:scale-95 transition-transform">
          Back to Market
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell pb-20 page-enter">
      {/* Header */}
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => step === 1 ? setLocation("/farmer/market") : setStep(step === 3 ? 2 : 1)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center border border-white/30 active:scale-90 transition-transform flex-shrink-0">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex-1">
            <p className="text-white/70 text-xs font-medium">Crop Funding</p>
            <h1 className="text-white font-bold text-lg">New Proposal</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s <= step ? "bg-white w-8" : "bg-white/30 w-4"}`} />
            ))}
          </div>
        </div>
        <p className="text-white/60 text-xs">
          {step === 1 ? "Step 1 — Crop & Farm Details" : step === 2 ? "Step 2 — Yield & Funding" : "Step 3 — Revenue Projection"}
        </p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <AnimatePresence mode="wait">

          {/* Step 1 — Crop Details */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div>
                <label className={labelClass}><Sprout size={12} className="text-primary" />Crop Type *</label>
                <select value={form.cropType} onChange={e => setForm(f => ({ ...f, cropType: e.target.value }))} className={inputClass}>
                  <option value="">Select crop…</option>
                  {CROP_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}><Leaf size={12} className="text-primary" />Farm Size (Acres) *</label>
                <input type="number" placeholder="e.g. 5" min="0.5" step="0.5"
                  value={form.acreage} onChange={e => setForm(f => ({ ...f, acreage: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}><MapPin size={12} className="text-primary" />County / Location *</label>
                <select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputClass}>
                  <option value="">Select county…</option>
                  {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}><Calendar size={12} className="text-primary" />Planting Season *</label>
                <select value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))} className={inputClass}>
                  <option value="">Select season…</option>
                  <option value="Long Rains (Mar–Jun)">Long Rains (Mar–Jun)</option>
                  <option value="Short Rains (Oct–Jan)">Short Rains (Oct–Jan)</option>
                  <option value="Irrigation (Year-round)">Irrigation (Year-round)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Additional Notes (optional)</label>
                <textarea placeholder="e.g. I have water access, certified seeds ready…" rows={3}
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={inputClass + " resize-none"} />
              </div>
              <button onClick={() => setStep(2)} disabled={!canAdvance1}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40">
                Continue <ChevronRight size={16} />
              </button>
            </motion.div>
          )}

          {/* Step 2 — Yield & Funding */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div>
                <label className={labelClass}><TrendingUp size={12} className="text-primary" />Expected Yield (Tons) *</label>
                <input type="number" placeholder="e.g. 10" min="1"
                  value={form.expectedYield} onChange={e => setForm(f => ({ ...f, expectedYield: e.target.value }))} className={inputClass} />
                <p className="text-muted-foreground text-[11px] mt-1.5">Average {form.acreage ? `${(parseFloat(form.expectedYield || "0") / parseFloat(form.acreage || "1")).toFixed(1)} tons/acre` : "—"}</p>
              </div>
              <div>
                <label className={labelClass}><DollarSign size={12} className="text-primary" />Funding Requested (KES) *</label>
                <input type="number" placeholder="Min 10,000" min="10000" step="5000"
                  value={form.fundingAmount} onChange={e => setForm(f => ({ ...f, fundingAmount: e.target.value }))} className={inputClass} />
                <p className="text-muted-foreground text-[11px] mt-1.5">Minimum KES 10,000 · Maximum KES 2,000,000</p>
              </div>

              {fundingAmt >= 10000 && (
                <div className="bg-muted/50 rounded-2xl border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground mb-2">Budget Breakdown</p>
                  {COST_BREAKDOWN.map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-1.5 bg-primary rounded-full" style={{ width: `${item.pct * 100}%` }} />
                        </div>
                        <span className="text-foreground text-xs font-semibold w-16 text-right">
                          KES {Math.round(fundingAmt * item.pct).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => setStep(3)} disabled={!canAdvance2}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40">
                View Projection <ChevronRight size={16} />
              </button>
            </motion.div>
          )}

          {/* Step 3 — Revenue Projection */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {/* Proposal summary */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 space-y-2">
                <p className="text-green-800 text-xs font-bold uppercase tracking-wider mb-3">Proposal Summary</p>
                {[
                  { label: "Crop", value: form.cropType },
                  { label: "Acreage", value: `${form.acreage} acres` },
                  { label: "Location", value: form.location },
                  { label: "Season", value: form.season },
                  { label: "Expected Yield", value: `${form.expectedYield} tons` },
                  { label: "Funding Requested", value: `KES ${Number(form.fundingAmount).toLocaleString()}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">{label}</span>
                    <span className="text-foreground text-xs font-semibold">{value}</span>
                  </div>
                ))}
              </div>

              {/* Revenue projection */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-primary" />
                  Projected Revenue at Harvest
                </p>
                <p className="text-primary font-black text-3xl mb-3">KES {projectedRevenue.toLocaleString()}</p>
                <p className="text-muted-foreground text-[10px] mb-3">Based on 2.4× average return on investment for {form.cropType || "selected crop"}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: <Leaf size={13} />, label: "Your Share (55%)", value: `KES ${farmerShare.toLocaleString()}`, color: "text-green-700 bg-green-50 border-green-200" },
                    { icon: <Users size={13} />, label: "Investor (40%)", value: `KES ${investorShare.toLocaleString()}`, color: "text-blue-700 bg-blue-50 border-blue-200" },
                    { icon: <DollarSign size={13} />, label: "Platform (5%)", value: `KES ${platformFee.toLocaleString()}`, color: "text-amber-700 bg-amber-50 border-amber-200" },
                  ].map(item => (
                    <div key={item.label} className={`rounded-xl border p-2.5 text-center ${item.color}`}>
                      <div className="flex justify-center mb-1 opacity-80">{item.icon}</div>
                      <p className="text-[8px] font-semibold opacity-70">{item.label}</p>
                      <p className="text-[10px] font-bold mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-amber-700 text-xs leading-relaxed">
                  ⚠️ Projections are estimates based on average market conditions. Actual returns depend on yield, market prices, and weather.
                </p>
              </div>

              <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-lg shadow-primary/20">
                {submitMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Sprout size={18} />}
                {submitMutation.isPending ? "Submitting…" : "Submit Crop Proposal"}
              </button>
              {submitMutation.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-700 text-xs font-medium">{(submitMutation.error as Error).message}</p>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <BottomNav role="farmer" />
    </div>
  );
}
