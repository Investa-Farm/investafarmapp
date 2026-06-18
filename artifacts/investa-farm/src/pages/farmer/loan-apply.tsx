import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, DollarSign, CheckCircle2, Loader2, Clock, FileText, ChevronRight, ScrollText, Shield, BarChart3, Users, AlertCircle, Sprout, MapPin, CalendarDays, X, Sparkles, ChevronLeft, Zap } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { getToken, formatKES } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RepayModal } from "@/components/repay-modal";
import { AnimatePresence, motion } from "framer-motion";

type LoanApp = {
  id: number; amount: number; purpose: string; purposeDetails: string;
  repaymentPeriodMonths: number; status: string; submittedAt?: string; createdAt: string;
};

const PURPOSES = [
  { value: "seeds",      label: "🌱 Seeds & Planting" },
  { value: "fertilizer", label: "🧪 Fertilizer" },
  { value: "equipment",  label: "🚜 Equipment" },
  { value: "irrigation", label: "💧 Irrigation" },
  { value: "labour",     label: "👷 Labour" },
  { value: "other",      label: "📋 Other" },
];

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:        { label: "Draft",        cls: "badge-pending" },
  submitted:    { label: "Submitted",    cls: "badge-submitted" },
  under_review: { label: "Under Review", cls: "badge-submitted" },
  approved:     { label: "Approved",     cls: "badge-approved" },
  rejected:     { label: "Rejected",     cls: "badge-rejected" },
  disbursed:    { label: "Disbursed",    cls: "badge-approved" },
};

const GUIDE_STEPS = [
  { icon: Shield,    title: "1. Get Verified",     body: "Upload National ID & Farm Report for KYC approval.",                           color: "text-blue-600",  bg: "bg-blue-50" },
  { icon: DollarSign, title: "2. Apply for Funding", body: "Choose how much you need and what it's for.",                                color: "text-primary",   bg: "bg-primary/5" },
  { icon: Users,      title: "3. Investors Fund You", body: "Your farm is listed on the market. Investors buy shares.",                   color: "text-amber-600", bg: "bg-amber-50" },
  { icon: BarChart3,  title: "4. Earn Your 55%",    body: "After harvest, you keep 55% of gross revenue. No upfront interest.",          color: "text-green-600", bg: "bg-green-50" },
];

const CROP_OPTIONS = ["Maize","Beans","Coffee","Tea","Avocado","Tomatoes","Kale","Dairy","Poultry","Rice","Wheat","Sunflower","Cabbage","Greenhouse Vegetables","Other"];

const CONTRACT_TEXT = `INVESTA FARM PRODUCTION FUNDING AGREEMENT

This Production Funding Agreement ("Agreement") is entered into between Investa Farm Platform ("Platform") and the applicant Farmer or Farmer Group ("Farmer") upon submission of a funding application.

1. PLATFORM OBLIGATIONS
The Platform agrees to:
• Review and process the funding application within 2 business days
• List the farm on the Investa Farm investor exchange upon approval
• Manage investor relations and share certificates on behalf of the Farmer
• Disburse approved funds within 5 business days of full funding
• Provide a digital Funding Voucher upon disbursement

2. FARMER OBLIGATIONS
The Farmer agrees to:
• Provide all labour, management, and operational oversight of the farm
• Follow recommended agricultural best practices for the declared crop
• Post at least ONE (1) field update per month with a photo on the platform
• Allow Platform inspection visits with 48-hour advance notice
• Report any crop failure, pest outbreak, or force majeure within 24 hours
• Not divert disbursed funds to non-declared purposes

3. REVENUE SHARING
Upon harvest and sale of produce:
• Farmer receives: 55% of gross harvest revenue
• Investor pool receives: 45% of gross harvest revenue
• Platform service fee: 1.5% deducted from the investor pool only
The Farmer is not charged a platform fee on their 55% share.

4. REPAYMENT TERMS
• Principal repayment from harvest proceeds via M-Pesa or bank transfer
• Simple interest rate: 8% per annum on the principal
• Repayment schedule as indicated in the application
• No penalty for early repayment
• In case of crop failure due to proven natural disaster, the Platform will work with the Farmer to restructure repayment

5. COVENANTS
• The Farmer warrants that the farm exists, is operational, and all KYC documents are genuine
• The Farmer shall not list the same farm on any other crowdfunding or funding platform during the term
• The Farmer shall maintain crop insurance where available

6. TERM AND TERMINATION
This Agreement is valid from the date of funding application approval until full repayment. The Platform may terminate in case of fraud or material misrepresentation.

7. GOVERNING LAW
This Agreement is governed by the laws of the Republic of Kenya.`;

function computeCreditScore(kycApproved: number, cropType: string, acreage: string, amount: string, description: string): number {
  let score = 600;
  score += Math.min(kycApproved * 45, 130);
  if (cropType && cropType !== "Other") score += 25;
  if (parseFloat(acreage) >= 2) score += 20;
  if (parseFloat(amount) > 0 && parseFloat(amount) <= 200000) score += 15;
  if (parseFloat(amount) > 500000) score -= 25;
  if (description.length > 80) score += 15;
  return Math.min(Math.max(score, 500), 780);
}

function ScoreGauge({ score }: { score: number }) {
  const pct = ((score - 300) / (850 - 300)) * 100;
  const color = score >= 700 ? "#16a34a" : score >= 620 ? "#f59e0b" : "#ef4444";
  const label = score >= 700 ? "Excellent" : score >= 620 ? "Good" : "Fair";
  return (
    <div className="text-center space-y-3">
      <div className="relative w-40 h-20 mx-auto">
        <svg viewBox="0 0 120 60" className="w-full h-full">
          <path d="M10,55 A50,50 0 0,1 110,55" fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round"/>
          <path d="M10,55 A50,50 0 0,1 110,55" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${Math.PI * 50 * pct / 100} ${Math.PI * 50}`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0.5">
          <span className="font-black text-2xl leading-none" style={{ color }}>{score}</span>
          <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center">
        {["Fair\n500–619","Good\n620–699","Excellent\n700+"].map((t, i) => {
          const [l, r] = t.split("\n");
          const active = i === (score >= 700 ? 2 : score >= 620 ? 1 : 0);
          return (
            <div key={i} className={`rounded-xl py-1.5 px-1 border ${active ? "border-current font-bold" : "border-border text-muted-foreground"}`}
              style={active ? { borderColor: color, color } : {}}>
              <p>{l}</p><p className="opacity-70">{r}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LoanApply() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const token = getToken();

  const [repayLoan, setRepayLoan] = useState<LoanApp | null>(null);
  const [repayOpen, setRepayOpen] = useState(false);

  const [propCropType, setPropCropType] = useState("");
  const [propAcreage, setPropAcreage]   = useState("");
  const [propLocation, setPropLocation] = useState("");
  const [propHarvest, setPropHarvest]   = useState("");
  const [propDesc, setPropDesc]         = useState("");

  const [amount, setAmount]               = useState("");
  const [purpose, setPurpose]             = useState("seeds");
  const [purposeDetails, setPurposeDetails] = useState("");
  const [repayment, setRepayment]         = useState(6);

  const [agreedToContract, setAgreedToContract] = useState(false);
  const [contractScrolled, setContractScrolled] = useState(false);
  const contractRef = useRef<HTMLDivElement>(null);

  const [kycWarning, setKycWarning] = useState(false);

  const [showModal, setShowModal]   = useState(false);
  const [modalStep, setModalStep]   = useState(1);
  const [aiScore, setAiScore]       = useState(0);
  const [aiScoring, setAiScoring]   = useState(false);
  const [submitDone, setSubmitDone] = useState(false);

  const { data: apps = [], isLoading } = useQuery<LoanApp[]>({
    queryKey: ["loan-apps"],
    queryFn: async () => {
      const r = await fetch("/api/loans/applications", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const { data: kycDocs = [] } = useQuery<any[]>({
    queryKey: ["kyc-docs"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const kycApproved = (kycDocs as any[]).filter(d => d.status === "approved").length;
  const kycOk = kycApproved >= 1;

  const propMutation = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/farmer/market/crop-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? "Proposal failed"); }
      return r.json();
    },
  });

  const apply = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/loans/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message ?? e.error ?? "Submission failed"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loan-apps"] });
      qc.invalidateQueries({ queryKey: ["farms"] });
      setSubmitDone(true);
      setModalStep(5);
    },
  });

  const handleOpenModal = () => {
    if (!kycOk) { setKycWarning(true); return; }
    setKycWarning(false);
    setModalStep(1);
    setSubmitDone(false);
    setAgreedToContract(false);
    setContractScrolled(false);
    setShowModal(true);
  };

  const handleContractScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) setContractScrolled(true);
  };

  const canGoNext: Record<number, boolean> = {
    1: !!propCropType && !!propLocation,
    2: !!amount && parseFloat(amount) >= 10000 && !!purposeDetails,
    3: !aiScoring,
    4: agreedToContract,
  };

  const handleNext = async () => {
    if (modalStep === 2) {
      setModalStep(3);
      setAiScoring(true);
      await new Promise(r => setTimeout(r, 2200));
      setAiScore(computeCreditScore(kycApproved, propCropType, propAcreage, amount, propDesc));
      setAiScoring(false);
      return;
    }
    if (modalStep === 4) {
      await propMutation.mutateAsync({ cropType: propCropType, acreage: parseFloat(propAcreage) || 1, location: propLocation, expectedHarvestDate: propHarvest, description: propDesc || `${propCropType} farm in ${propLocation}` }).catch(() => {});
      apply.mutate({ amount: parseFloat(amount), purpose, purposeDetails, repaymentPeriodMonths: repayment });
      return;
    }
    setModalStep(s => s + 1);
  };

  const handleBack = () => setModalStep(s => Math.max(1, s - 1));

  const closeModal = () => {
    setShowModal(false);
    setModalStep(1);
  };

  const monthlyRepayment = amount ? (parseFloat(amount) * 1.08 / repayment) : 0;

  const STEP_LABELS = ["Crop Details", "Funding", "AI Score", "Agreement", "Done!"];

  return (
    <div className="app-shell pb-20 page-enter" data-testid="loan-apply">
      {/* Header */}
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/farmer")} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-white/70 text-xs">Farm Financing</p>
            <h1 className="text-white text-lg font-bold">Apply for Funding</h1>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* KYC warning */}
        {kycWarning && !kycOk && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-orange-700 font-semibold text-sm">KYC Required</p>
              <p className="text-orange-600 text-xs mt-0.5">You need at least 1 approved KYC document before applying.</p>
              <button onClick={() => setLocation("/farmer/kyc")} className="mt-2 text-xs font-bold text-orange-700 underline">Upload documents →</button>
            </div>
          </div>
        )}

        {/* Main CTA banner */}
        <div className="bg-gradient-to-br from-primary to-emerald-700 rounded-3xl p-5 text-white shadow-lg shadow-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-emerald-200" />
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">AI-Powered Credit</p>
          </div>
          <h2 className="font-black text-xl mb-1">Get Your Farm Funded</h2>
          <p className="text-white/70 text-xs leading-relaxed mb-4">Propose your crop, get an AI credit score, and raise capital from investors in one seamless flow.</p>
          <div className="flex gap-2 mb-4">
            {["KES 10K–2M","AI Scoring","5-Step Process"].map(t => (
              <span key={t} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/15">{t}</span>
            ))}
          </div>
          <button onClick={handleOpenModal}
            className="w-full bg-white text-primary font-bold py-3.5 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 text-sm shadow-sm">
            <Zap size={16} /> Apply for Farm Funding
          </button>
        </div>

        {/* How it works */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">How it Works</p>
          <div className="grid grid-cols-2 gap-2">
            {GUIDE_STEPS.map(step => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="bg-card border border-border rounded-2xl p-3">
                  <div className={`w-8 h-8 rounded-xl ${step.bg} flex items-center justify-center mb-2`}>
                    <Icon size={16} className={step.color} />
                  </div>
                  <p className="text-foreground font-semibold text-xs leading-tight mb-1">{step.title}</p>
                  <p className="text-muted-foreground text-[10px] leading-snug">{step.body}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue split */}
        <div className="bg-card border border-border rounded-2xl p-3.5">
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <BarChart3 size={13} className="text-primary" /> Revenue Split
          </p>
          <div className="flex h-3 rounded-full overflow-hidden mb-2 gap-0.5">
            <div className="bg-primary rounded-l-full" style={{ width: "55%" }} />
            <div className="bg-amber-400" style={{ width: "44%" }} />
            <div className="bg-muted-foreground/30 rounded-r-full" style={{ width: "1%" }} />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-primary rounded-sm" /><span className="font-semibold">55% You</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-400 rounded-sm" /><span className="font-semibold">44% Investors</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-muted-foreground/30 rounded-sm" /><span className="text-muted-foreground">1% Fee</span></div>
          </div>
        </div>

        {/* Applications list */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">My Applications ({apps.length})</p>
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
          ) : apps.length === 0 ? (
            <div className="bg-muted/50 rounded-2xl p-6 text-center">
              <FileText size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No applications yet. Start your first application above.</p>
            </div>
          ) : apps.map(app => {
            const cfg = statusConfig[app.status] ?? statusConfig.draft!;
            const canRepay = ["approved","disbursed"].includes(app.status);
            return (
              <div key={app.id} data-testid={`loan-app-${app.id}`} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-foreground font-bold text-base">{formatKES(app.amount)}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {PURPOSES.find(p => p.value === app.purpose)?.label ?? app.purpose} · {app.repaymentPeriodMonths}mo
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                </div>
                <p className="text-muted-foreground text-xs mt-2 line-clamp-2">{app.purposeDetails}</p>
                <div className="mt-2.5 bg-muted/50 rounded-xl p-2.5 flex justify-between text-xs">
                  <div><p className="text-muted-foreground">Total owed</p><p className="font-bold">{formatKES(app.amount * 1.08)}</p></div>
                  <div className="text-right"><p className="text-muted-foreground">Monthly</p><p className="font-bold">{formatKES(app.amount * 1.08 / app.repaymentPeriodMonths)}</p></div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <Clock size={10} className="text-muted-foreground" />
                    <span className="text-muted-foreground text-[10px]">
                      {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString("en-KE") : new Date(app.createdAt).toLocaleDateString("en-KE")}
                    </span>
                  </div>
                  {canRepay && (
                    <button onClick={() => { setRepayLoan(app); setRepayOpen(true); }}
                      className="text-[11px] font-bold text-white bg-primary px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                      Make Repayment
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <RepayModal open={repayOpen} onClose={() => setRepayOpen(false)} loan={repayLoan} />
      <BottomNav role="farmer" />

      {/* ─────────────────────────────────────────────────────
          UNIFIED 5-STEP BOTTOM SHEET MODAL
      ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-card w-full max-w-[430px] rounded-t-3xl overflow-hidden flex flex-col"
              style={{ maxHeight: "92dvh" }}>

              {/* Modal header */}
              <div className="px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {modalStep > 1 && modalStep < 5 && (
                      <button onClick={handleBack} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center -ml-1 mr-0.5">
                        <ChevronLeft size={15} className="text-foreground" />
                      </button>
                    )}
                    <div>
                      <p className="font-bold text-foreground text-sm">{STEP_LABELS[modalStep - 1]}</p>
                      <p className="text-muted-foreground text-[10px]">Step {modalStep} of 5</p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <X size={15} className="text-foreground" />
                  </button>
                </div>
                {/* Step progress bar */}
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${s <= modalStep ? "bg-primary" : "bg-muted"}`} />
                  ))}
                </div>
              </div>

              {/* Modal body — scrollable */}
              <div className="overflow-y-auto flex-1 px-5 py-5">

                {/* ── STEP 1: Crop Details ── */}
                {modalStep === 1 && (
                  <div className="space-y-4">
                    <div className="text-center mb-2">
                      <div className="text-3xl mb-1">🌾</div>
                      <h3 className="font-bold text-foreground text-base">Tell us about your farm</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">This creates your farm listing on the investor market</p>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Crop Type *</label>
                      <select value={propCropType} onChange={e => setPropCropType(e.target.value)}
                        className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary">
                        <option value="">Select a crop…</option>
                        {CROP_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Acreage</label>
                        <input type="number" value={propAcreage} onChange={e => setPropAcreage(e.target.value)}
                          placeholder="e.g. 5" min={0.1} step={0.1}
                          className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          <CalendarDays size={10} className="inline mr-0.5" /> Harvest Date
                        </label>
                        <input type="month" value={propHarvest} onChange={e => setPropHarvest(e.target.value)}
                          className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        <MapPin size={10} className="inline mr-0.5" /> Farm Location *
                      </label>
                      <input type="text" value={propLocation} onChange={e => setPropLocation(e.target.value)}
                        placeholder="e.g. Nakuru County, Kenya"
                        className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary" />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Farm Description</label>
                      <textarea value={propDesc} onChange={e => setPropDesc(e.target.value)} rows={3}
                        placeholder="Describe your farm, soil, irrigation setup, experience…"
                        className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary resize-none" />
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3">
                      <p className="text-primary font-semibold text-xs mb-1.5">📋 What you're doing here</p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        <li className="flex gap-1.5"><CheckCircle2 size={11} className="text-primary mt-0.5 flex-shrink-0" />Creating your farm listing for investors</li>
                        <li className="flex gap-1.5"><CheckCircle2 size={11} className="text-primary mt-0.5 flex-shrink-0" />Admin reviews and publishes within 1 business day</li>
                        <li className="flex gap-1.5"><CheckCircle2 size={11} className="text-primary mt-0.5 flex-shrink-0" />You get notified when investors start funding</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* ── STEP 2: Funding Amount ── */}
                {modalStep === 2 && (
                  <div className="space-y-4">
                    <div className="text-center mb-2">
                      <div className="text-3xl mb-1">💰</div>
                      <h3 className="font-bold text-foreground text-base">How much do you need?</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">KES 10,000 to KES 2,000,000</p>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Loan Amount (KES) *</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={10000} placeholder="e.g. 120,000" required
                          className="w-full border border-border rounded-xl px-4 py-3 pl-12 text-foreground font-bold text-sm focus:outline-none focus:border-primary bg-background" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Primary Purpose</label>
                      <div className="grid grid-cols-3 gap-2">
                        {PURPOSES.map(p => (
                          <button key={p.value} type="button" onClick={() => setPurpose(p.value)}
                            className={`py-2.5 px-2 rounded-xl border text-[11px] font-medium transition-all text-center ${purpose === p.value ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground bg-background"}`}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">How will you use it? *</label>
                      <textarea value={purposeDetails} onChange={e => setPurposeDetails(e.target.value)} rows={3} required minLength={10}
                        placeholder="Describe how you'll use the funds…"
                        className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary resize-none" />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Repayment Period</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[3,6,9,12].map(m => (
                          <button key={m} type="button" onClick={() => setRepayment(m)}
                            className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${repayment === m ? "border-primary bg-primary text-white" : "border-border text-foreground bg-background"}`}>
                            {m}mo
                          </button>
                        ))}
                      </div>
                    </div>

                    {amount && parseFloat(amount) > 0 && (
                      <div className="bg-muted/50 border border-border rounded-2xl p-3.5 space-y-2">
                        <p className="text-foreground text-xs font-bold">Loan Summary</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><p className="text-muted-foreground">Principal</p><p className="font-bold text-foreground">{formatKES(parseFloat(amount)||0)}</p></div>
                          <div><p className="text-muted-foreground">Interest (8% p.a.)</p><p className="font-bold text-foreground">{formatKES((parseFloat(amount)||0)*0.08)}</p></div>
                          <div><p className="text-muted-foreground">Total Owed</p><p className="font-bold text-foreground">{formatKES((parseFloat(amount)||0)*1.08)}</p></div>
                          <div><p className="text-muted-foreground">Monthly (est.)</p><p className="font-bold text-primary">{formatKES(monthlyRepayment)}</p></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 3: AI Credit Score ── */}
                {modalStep === 3 && (
                  <div className="space-y-5">
                    <div className="text-center">
                      <div className="text-3xl mb-1">🤖</div>
                      <h3 className="font-bold text-foreground text-base">AI Credit Assessment</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">Analysing your KYC, crop data, and application details…</p>
                    </div>

                    {aiScoring ? (
                      <div className="space-y-4">
                        <div className="bg-muted/50 border border-border rounded-2xl p-6 text-center">
                          <Loader2 size={28} className="text-primary animate-spin mx-auto mb-3" />
                          <p className="text-foreground font-semibold text-sm">Running credit analysis…</p>
                          <p className="text-muted-foreground text-xs mt-1">Checking KYC documents, crop viability, and market conditions</p>
                        </div>
                        <div className="space-y-2">
                          {["KYC document verification","Crop risk assessment","Market price analysis","Repayment capacity check"].map((item, i) => (
                            <div key={i} className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3.5 py-2.5">
                              <Loader2 size={12} className="text-primary animate-spin flex-shrink-0" />
                              <p className="text-foreground text-xs font-medium">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-card border border-border rounded-3xl p-5">
                          <ScoreGauge score={aiScore} />
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-bold text-foreground">Score Breakdown</p>
                          {[
                            { label: "KYC Documents", val: Math.min(kycApproved * 45, 130), max: 130, color: "bg-blue-500" },
                            { label: "Crop Viability", val: propCropType && propCropType !== "Other" ? 25 : 0, max: 25, color: "bg-green-500" },
                            { label: "Farm Size", val: parseFloat(propAcreage) >= 2 ? 20 : 5, max: 20, color: "bg-emerald-400" },
                            { label: "Application Quality", val: propDesc.length > 80 ? 15 : 5, max: 15, color: "bg-amber-400" },
                          ].map(item => (
                            <div key={item.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-foreground">{item.label}</span>
                                <span className="text-xs font-bold text-foreground">+{item.val}</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.val / item.max) * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className={`rounded-2xl border p-3.5 ${aiScore >= 700 ? "bg-green-50 border-green-200" : aiScore >= 620 ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
                          <p className={`text-xs font-bold mb-1 ${aiScore >= 700 ? "text-green-700" : aiScore >= 620 ? "text-amber-700" : "text-blue-700"}`}>
                            {aiScore >= 700 ? "✅ Strong Application" : aiScore >= 620 ? "👍 Good Application" : "💪 Approved — Room to Improve"}
                          </p>
                          <p className={`text-[11px] leading-relaxed ${aiScore >= 700 ? "text-green-600" : aiScore >= 620 ? "text-amber-600" : "text-blue-600"}`}>
                            {aiScore >= 700
                              ? `Your credit score of ${aiScore} is excellent. Investors are more likely to fund your farm quickly. You may also qualify for a lower platform fee.`
                              : aiScore >= 620
                              ? `Your score of ${aiScore} is solid. Upload more KYC documents and add a detailed farm description to strengthen your profile.`
                              : `Your score of ${aiScore} qualifies you. Improve by adding more approved KYC documents and providing detailed farm information.`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 4: Contract ── */}
                {modalStep === 4 && (
                  <div className="space-y-3">
                    <div className="text-center mb-1">
                      <div className="text-3xl mb-1">📜</div>
                      <h3 className="font-bold text-foreground text-base">Production Funding Agreement</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">Read and accept to continue</p>
                    </div>

                    {apply.isError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                        <AlertCircle size={13} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-red-700 text-xs">{(apply.error as Error)?.message}</p>
                      </div>
                    )}

                    {/* Key terms summary */}
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5">
                      <p className="text-primary font-bold text-xs mb-2">Key Terms at a Glance</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div className="bg-white rounded-xl p-2 border border-border">
                          <p className="font-black text-primary text-sm">55%</p>
                          <p className="text-muted-foreground">Your share</p>
                        </div>
                        <div className="bg-white rounded-xl p-2 border border-border">
                          <p className="font-black text-amber-600 text-sm">8%</p>
                          <p className="text-muted-foreground">Annual interest</p>
                        </div>
                        <div className="bg-white rounded-xl p-2 border border-border">
                          <p className="font-black text-blue-600 text-sm">1×/mo</p>
                          <p className="text-muted-foreground">Update required</p>
                        </div>
                      </div>
                    </div>

                    {/* Scrollable contract */}
                    <div ref={contractRef} onScroll={handleContractScroll}
                      className="border border-border rounded-2xl overflow-y-auto px-4 py-3.5 bg-background"
                      style={{ maxHeight: 200 }}>
                      <pre className="text-[11px] text-foreground font-sans whitespace-pre-wrap leading-relaxed">{CONTRACT_TEXT}</pre>
                      {!contractScrolled && (
                        <div className="sticky bottom-0 flex items-center justify-center gap-1 py-2 text-muted-foreground text-[10px] bg-gradient-to-t from-background to-transparent">
                          <ChevronRight size={11} className="rotate-90" /> Scroll to read full agreement
                        </div>
                      )}
                    </div>

                    <label className={`flex items-start gap-3 cursor-pointer ${contractScrolled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                      <input type="checkbox" checked={agreedToContract} onChange={e => setAgreedToContract(e.target.checked)}
                        className="w-4 h-4 accent-primary cursor-pointer mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-foreground leading-snug">
                        I have read and agree to the Investa Farm Production Funding Agreement, including the 55/45 revenue split and monthly reporting obligations.
                      </p>
                    </label>
                  </div>
                )}

                {/* ── STEP 5: Success ── */}
                {modalStep === 5 && (
                  <div className="text-center space-y-5 py-4">
                    <div className="text-6xl animate-bounce">🎉</div>
                    <div>
                      <h3 className="font-black text-foreground text-xl mb-1">Application Submitted!</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">Your farm listing and funding application have been submitted. We'll review within 2 business days.</p>
                    </div>

                    <div className="bg-card border border-border rounded-3xl p-5 space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">AI Credit Score</p>
                      <ScoreGauge score={aiScore} />
                    </div>

                    <div className="space-y-2.5">
                      {["Admin reviews your application","Farm listing goes live on the market","Investors start buying shares","Funds disbursed once fully funded"].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3.5 py-2.5">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary text-[10px] font-black">{i+1}</span>
                          </div>
                          <p className="text-foreground text-xs font-medium">{item}</p>
                        </div>
                      ))}
                    </div>

                    <button onClick={closeModal}
                      className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all">
                      View My Applications
                    </button>
                  </div>
                )}
              </div>

              {/* Modal footer — action button */}
              {modalStep < 5 && (
                <div className="px-5 py-4 border-t border-border flex-shrink-0">
                  <button
                    onClick={handleNext}
                    disabled={!canGoNext[modalStep] || apply.isPending || aiScoring}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100">
                    {apply.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                    {apply.isPending ? "Submitting…"
                      : aiScoring ? "Scoring…"
                      : modalStep === 4 ? "Submit Application 🚀"
                      : modalStep === 3 ? "Next: Review Agreement →"
                      : "Next →"}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
