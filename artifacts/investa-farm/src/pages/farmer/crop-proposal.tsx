import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { BottomNav } from "@/components/bottom-nav";
import { getToken } from "@/lib/auth";
import {
  ArrowLeft, Sprout, DollarSign, MapPin, Calendar, ChevronRight,
  CheckCircle2, Loader2, Leaf, TrendingUp, Users, Upload, FileText,
  X, Sparkles, ClipboardList, Image,
} from "lucide-react";
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
  { label: "Seeds & Inputs",       pct: 0.30, color: "bg-green-500" },
  { label: "Labour",               pct: 0.22, color: "bg-blue-500" },
  { label: "Land Preparation",     pct: 0.18, color: "bg-amber-500" },
  { label: "Irrigation",           pct: 0.12, color: "bg-cyan-500" },
  { label: "Pest & Disease Control", pct: 0.10, color: "bg-purple-500" },
  { label: "Transport & Logistics", pct: 0.08, color: "bg-orange-500" },
];

const inputClass = "w-full bg-white border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all shadow-sm";
const labelClass = "text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wide";

type Mode = "form" | "template";

export default function CropProposal() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const [mode, setMode] = useState<Mode>("form");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitted, setSubmitted] = useState(false);

  // Form mode state
  const [form, setForm] = useState({
    cropType: "",
    acreage: "",
    location: "",
    season: "",
    expectedYield: "",
    fundingAmount: "",
    description: "",
  });

  // Template mode state
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [templateImgUrl, setTemplateImgUrl] = useState<string | null>(null);
  const [templateNotes, setTemplateNotes] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);

  const fundingAmt = parseFloat(form.fundingAmount) || 0;
  const projectedRevenue = fundingAmt * 2.4;
  const farmerShare = Math.round(projectedRevenue * 0.55);
  const investorShare = Math.round(projectedRevenue * 0.40);
  const platformFee = Math.round(projectedRevenue * 0.05);

  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error ?? "File upload failed");
    }
    const { url } = await r.json();
    return url;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (mode === "template") {
        if (!templateFile) throw new Error("Please select a template file first.");
        const fileUrl = await uploadFile(templateFile);
        const r = await fetch("/api/loans/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            amount: 50000,
            purpose: "other",
            purposeDetails: `Template proposal uploaded. Notes: ${templateNotes || "None"}. Document: ${fileUrl}`,
            repaymentPeriodMonths: 6,
            farmName: "Template Proposal",
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (data.error === "KYC_REQUIRED") throw new Error("Please complete KYC verification first. Go to Profile → KYC Documents.");
          throw new Error(data.message ?? data.error ?? "Submission failed");
        }
        return data;
      }

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
        if (data.error === "KYC_REQUIRED") throw new Error("Please complete KYC verification first. Go to Profile → KYC Documents.");
        throw new Error(data.message ?? data.error ?? "Submission failed");
      }
      return data;
    },
    onSuccess: () => setSubmitted(true),
  });

  const canAdvance1 = form.cropType && form.acreage && form.location && form.season;
  const canAdvance2 = form.expectedYield && form.fundingAmount && parseFloat(form.fundingAmount) >= 10000;

  const handleTemplateFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTemplateFile(file);
    setTemplatePreview(file.name);
    setTemplateError(null);
    if (file.type.startsWith("image/")) {
      setTemplateImgUrl(URL.createObjectURL(file));
    } else {
      setTemplateImgUrl(null);
    }
  };

  if (submitted) {
    return (
      <div className="app-shell pb-20 flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
          <div className="w-24 h-24 rounded-full bg-green-100 border-4 border-green-200 flex items-center justify-center mb-5 mx-auto">
            <CheckCircle2 size={44} className="text-green-600" />
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="text-foreground font-black text-2xl mb-2">Proposal Submitted!</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6 max-w-xs mx-auto">
            Your crop funding proposal has been sent to the admin team. You'll receive a review within <strong>2–3 business days</strong>.
          </p>
        </motion.div>

        {mode === "form" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 w-full mb-6 text-left space-y-2.5">
            {[
              { label: "Crop", value: form.cropType },
              { label: "Funding Requested", value: `KES ${Number(form.fundingAmount).toLocaleString()}` },
              { label: "Location", value: form.location },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">{label}</span>
                <span className="text-green-800 text-xs font-bold">{value}</span>
              </div>
            ))}
          </motion.div>
        )}

        <motion.button
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          onClick={() => setLocation("/farmer/market")}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-sm active:scale-95 transition-transform shadow-lg shadow-primary/20">
          Back to Market
        </motion.button>
      </div>
    );
  }

  return (
    <div className="app-shell pb-20 page-enter">
      {/* Header */}
      <div className="hero-header pt-12 pb-6 px-5">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => {
              if (mode === "form" && step > 1) setStep(step === 3 ? 2 : 1);
              else setLocation("/farmer/market");
            }}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center border border-white/30 active:scale-90 transition-transform flex-shrink-0">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex-1">
            <p className="text-white/70 text-xs font-medium">Crop Funding</p>
            <h1 className="text-white font-black text-xl">New Proposal</h1>
          </div>
          {mode === "form" && (
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1.5 rounded-full transition-all ${s <= step ? "bg-white w-8" : "bg-white/30 w-4"}`} />
              ))}
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 bg-white/10 rounded-2xl p-1.5">
          <button
            onClick={() => { setMode("form"); setStep(1); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === "form" ? "bg-white text-green-800 shadow-sm" : "text-white/70"}`}
          >
            <ClipboardList size={15} />
            Fill Form
          </button>
          <button
            onClick={() => setMode("template")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === "template" ? "bg-white text-green-800 shadow-sm" : "text-white/70"}`}
          >
            <Upload size={15} />
            Upload Template
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        <AnimatePresence mode="wait">

          {/* ── TEMPLATE MODE ── */}
          {mode === "template" && (
            <motion.div key="template" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-4">
              {/* Info card */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={18} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-green-800 font-bold text-sm">Upload Your Own Proposal</p>
                    <p className="text-green-700 text-xs mt-0.5 leading-relaxed">
                      Already have a crop proposal document? Upload it directly — PDF, Word, or image formats are accepted. Our team will review it within 2–3 business days.
                    </p>
                  </div>
                </div>
              </div>

              {/* What to include */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-foreground font-bold text-xs mb-3 uppercase tracking-wider">Your proposal should include:</p>
                <div className="space-y-2">
                  {[
                    { icon: "🌱", text: "Crop type and expected yield" },
                    { icon: "📍", text: "Farm location and acreage" },
                    { icon: "📅", text: "Planting and harvest timeline" },
                    { icon: "💰", text: "Funding amount needed" },
                    { icon: "📊", text: "Cost breakdown (optional but helpful)" },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-2.5">
                      <span className="text-base flex-shrink-0">{icon}</span>
                      <span className="text-muted-foreground text-xs">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* File upload */}
              <div>
                <label className={labelClass}><Upload size={12} className="text-primary" />Proposal Document *</label>
                <label className={`w-full border-2 border-dashed rounded-2xl overflow-hidden cursor-pointer transition-all flex items-center justify-center min-h-[140px] ${templateFile ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40 bg-muted/20"}`}>
                  <input type="file" className="hidden"
                    accept="image/*,application/pdf,.pdf,.doc,.docx"
                    onChange={handleTemplateFile} />
                  {templateImgUrl ? (
                    <img src={templateImgUrl} alt="Preview" className="w-full h-48 object-cover rounded-2xl" />
                  ) : templateFile ? (
                    <div className="p-6 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <FileText size={28} className="text-primary" />
                      </div>
                      <p className="text-foreground text-sm font-bold break-all">{templatePreview}</p>
                      <p className="text-primary text-xs mt-1.5 font-semibold">✓ File ready to submit</p>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                        <Image size={30} className="text-muted-foreground" />
                      </div>
                      <p className="text-foreground font-bold text-sm">Tap to select your proposal</p>
                      <p className="text-muted-foreground text-xs mt-1">PDF, Word doc, JPG or PNG · max 10 MB</p>
                    </div>
                  )}
                </label>
              </div>

              {templateFile && (
                <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5 border border-border">
                  <FileText size={15} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground text-xs font-medium flex-1 truncate">{templateFile.name}</span>
                  <button onClick={() => { setTemplateFile(null); setTemplatePreview(null); setTemplateImgUrl(null); }}
                    className="w-6 h-6 rounded-full bg-muted-foreground/10 flex items-center justify-center">
                    <X size={12} className="text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={labelClass}>Additional Notes (optional)</label>
                <textarea
                  placeholder="e.g. I've been farming for 5 years, have irrigation access…"
                  rows={3} value={templateNotes} onChange={e => setTemplateNotes(e.target.value)}
                  className={inputClass + " resize-none"} />
              </div>

              {templateError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-700 text-xs font-medium">{templateError}</p>
                </div>
              )}

              {submitMutation.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-700 text-xs font-medium">{(submitMutation.error as Error).message}</p>
                </div>
              )}

              <button
                onClick={() => submitMutation.mutate()}
                disabled={!templateFile || submitMutation.isPending}
                className="w-full bg-primary text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 text-sm">
                {submitMutation.isPending ? <><Loader2 size={18} className="animate-spin" /> Submitting…</> : <><Upload size={18} /> Submit Proposal Document</>}
              </button>
            </motion.div>
          )}

          {/* ── FORM MODE ── */}
          {mode === "form" && (
            <>
              {/* Step label */}
              {mode === "form" && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-primary/10 rounded-xl px-3 py-1.5">
                    <Sprout size={12} className="text-primary" />
                    <span className="text-primary text-xs font-bold">
                      {step === 1 ? "Step 1 — Crop & Farm Details" : step === 2 ? "Step 2 — Yield & Funding" : "Step 3 — Revenue Projection"}
                    </span>
                  </div>
                </div>
              )}

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
                    className="w-full bg-primary text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-primary/20 text-sm">
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
                    <p className="text-muted-foreground text-[11px] mt-1.5 px-1">
                      Average: {form.acreage ? `${(parseFloat(form.expectedYield || "0") / parseFloat(form.acreage || "1")).toFixed(1)} tons/acre` : "—"}
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}><DollarSign size={12} className="text-primary" />Funding Requested (KES) *</label>
                    <input type="number" placeholder="Min 10,000" min="10000" step="5000"
                      value={form.fundingAmount} onChange={e => setForm(f => ({ ...f, fundingAmount: e.target.value }))} className={inputClass} />
                    <p className="text-muted-foreground text-[11px] mt-1.5 px-1">Minimum KES 10,000 · Maximum KES 2,000,000</p>
                  </div>

                  {fundingAmt >= 10000 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl border border-border shadow-sm p-4 space-y-3">
                      <p className="text-xs font-black text-foreground uppercase tracking-wide">Budget Breakdown</p>
                      {COST_BREAKDOWN.map(item => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground text-xs">{item.label}</span>
                            <span className="text-foreground text-xs font-bold">
                              KES {Math.round(fundingAmt * item.pct).toLocaleString()} <span className="text-muted-foreground font-normal">({Math.round(item.pct * 100)}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${item.pct * 100}%` }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                              className={`h-1.5 ${item.color} rounded-full`}
                            />
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  <button onClick={() => setStep(3)} disabled={!canAdvance2}
                    className="w-full bg-primary text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-primary/20 text-sm">
                    View Projection <ChevronRight size={16} />
                  </button>
                </motion.div>
              )}

              {/* Step 3 — Revenue Projection */}
              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  {/* Proposal summary */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-green-200 flex items-center justify-center">
                        <ClipboardList size={14} className="text-green-700" />
                      </div>
                      <p className="text-green-800 text-xs font-black uppercase tracking-wider">Proposal Summary</p>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "Crop", value: form.cropType },
                        { label: "Acreage", value: `${form.acreage} acres` },
                        { label: "Location", value: form.location },
                        { label: "Season", value: form.season },
                        { label: "Expected Yield", value: `${form.expectedYield} tons` },
                        { label: "Funding Requested", value: `KES ${Number(form.fundingAmount).toLocaleString()}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between py-0.5">
                          <span className="text-muted-foreground text-xs">{label}</span>
                          <span className="text-green-800 text-xs font-bold">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Revenue projection */}
                  <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp size={15} className="text-primary" />
                      <p className="text-xs font-black text-foreground uppercase tracking-wide">Projected Revenue at Harvest</p>
                    </div>
                    <p className="text-primary font-black text-4xl mb-1 mt-2">KES {projectedRevenue.toLocaleString()}</p>
                    <p className="text-muted-foreground text-[10px] mb-4">Based on 2.4× avg return for {form.cropType || "selected crop"}</p>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { icon: <Leaf size={14} />, label: "Your Share", sub: "55%", value: `KES ${farmerShare.toLocaleString()}`, bg: "bg-green-50 border-green-200", text: "text-green-700" },
                        { icon: <Users size={14} />, label: "Investors", sub: "40%", value: `KES ${investorShare.toLocaleString()}`, bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
                        { icon: <DollarSign size={14} />, label: "Platform", sub: "5%", value: `KES ${platformFee.toLocaleString()}`, bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
                      ].map(item => (
                        <div key={item.label} className={`rounded-2xl border p-3 text-center ${item.bg}`}>
                          <div className={`flex justify-center mb-1.5 ${item.text}`}>{item.icon}</div>
                          <p className={`text-[10px] font-bold ${item.text}`}>{item.label}</p>
                          <p className={`text-[9px] opacity-60 ${item.text}`}>{item.sub}</p>
                          <p className={`text-[11px] font-black mt-1 ${item.text}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2">
                    <span className="text-base flex-shrink-0">⚠️</span>
                    <p className="text-amber-700 text-xs leading-relaxed">
                      Projections are estimates based on average market conditions. Actual returns depend on yield, market prices, and weather.
                    </p>
                  </div>

                  <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}
                    className="w-full bg-primary text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-lg shadow-primary/20 text-sm">
                    {submitMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Sprout size={18} />}
                    {submitMutation.isPending ? "Submitting…" : "Submit Crop Proposal"}
                  </button>

                  {submitMutation.error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5">
                      <p className="text-red-700 text-xs font-medium">{(submitMutation.error as Error).message}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}

        </AnimatePresence>
      </div>

      <BottomNav role="farmer" />
    </div>
  );
}
