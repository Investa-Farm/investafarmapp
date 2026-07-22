import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, CheckCircle2, Loader2, Clock, FileText, ChevronLeft,
  AlertCircle, BarChart3, Users, Shield, DollarSign, Zap, Sparkles,
  X, TrendingUp, Leaf, Droplets, Truck, Package, Calculator,
  ChevronRight, ScrollText, Download, Upload,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { getToken, formatKES } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { showCenterSuccess } from "@/components/center-success-modal";
import { Wallet, Award, CircleDot } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type StatusHistoryEntry = { stage: string; at: string; note?: string };

type LoanApp = {
  id: number; amount: number; purpose: string; purposeDetails: string;
  repaymentPeriodMonths: number; status: string; submittedAt?: string; createdAt: string;
  cropName?: string; acreage?: string; farmLocation?: string;
  expectedRevenue?: number; farmerShare?: number;
  costBreakdown?: CostBreakdown;
  aiScore?: number | null; interestRate?: string | number; amountRepaid?: string | number;
  nextRepaymentDueAt?: string | null; statusHistory?: StatusHistoryEntry[];
};

type CreditTier = { tier: "gold" | "silver" | "bronze"; interestRate: number; repaidCount: number; avgScore: number | null };

const TIER_META: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  gold:   { label: "Gold Tier",   color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",   emoji: "🥇" },
  silver: { label: "Silver Tier", color: "text-slate-600",   bg: "bg-slate-50 border-slate-200",   emoji: "🥈" },
  bronze: { label: "Bronze Tier", color: "text-orange-700",  bg: "bg-orange-50 border-orange-200", emoji: "🥉" },
};

const TIMELINE_STAGES: { key: string; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "ai_scored", label: "AI Scored" },
  { key: "under_review", label: "Reviewed" },
  { key: "approved", label: "Approved" },
  { key: "listed", label: "Listed" },
];

function LoanStatusTimeline({ app }: { app: LoanApp }) {
  const history = app.statusHistory ?? [];
  const historyMap = new Map(history.map(h => [h.stage, h]));
  const isRejected = app.status === "rejected";
  const rejectedEntry = historyMap.get("rejected");

  if (isRejected) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
        <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
        <p className="text-red-700 text-[10px] leading-snug">
          Rejected{rejectedEntry?.note ? ` — ${rejectedEntry.note}` : ""}
        </p>
      </div>
    );
  }

  const currentIdx = TIMELINE_STAGES.reduce((acc, s, i) => (historyMap.has(s.key) ? i : acc), 0);

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
      {TIMELINE_STAGES.map((stage, i) => {
        const reached = historyMap.has(stage.key) || i <= currentIdx;
        const isLast = i === TIMELINE_STAGES.length - 1;
        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-[52px]">
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${reached ? "bg-primary" : "bg-muted border border-border"}`}>
                {reached ? <CheckCircle2 size={10} className="text-white" /> : <CircleDot size={8} className="text-muted-foreground" />}
              </div>
              <span className={`text-[8px] font-semibold text-center leading-tight ${reached ? "text-foreground" : "text-muted-foreground/60"}`}>
                {stage.label}
              </span>
            </div>
            {!isLast && <div className={`h-0.5 flex-1 mx-0.5 mb-3.5 rounded-full ${i < currentIdx ? "bg-primary" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

type CostBreakdown = {
  landPrep: number; seeds: number; fertilizer: number; pesticides: number;
  labour: number; equipment: number; irrigation: number; transport: number;
  postHarvest: number; insurance: number; contingency: number; total: number;
};

// ── Constants ────────────────────────────────────────────────────────────────
const CROP_OPTIONS = [
  "Maize","Beans","Coffee","Tea","Avocado","Tomatoes","Kale","Dairy","Poultry",
  "Rice","Wheat","Sunflower","Cabbage","Greenhouse Vegetables","Potatoes","Onions","Sorghum","Other",
];

const COST_ITEMS: { key: keyof Omit<CostBreakdown, "contingency" | "total">; label: string; emoji: string; hint: string }[] = [
  { key: "landPrep",    label: "Land Preparation",           emoji: "🚜", hint: "Clearing, ploughing, harrowing, furrowing" },
  { key: "seeds",       label: "Seeds & Planting Material",  emoji: "🌱", hint: "Certified seeds, seedlings, cuttings" },
  { key: "fertilizer",  label: "Fertilizer & Amendments",    emoji: "🧪", hint: "DAP, CAN, organic compost, lime" },
  { key: "pesticides",  label: "Pesticides & Crop Protection",emoji: "🐛", hint: "Herbicides, fungicides, insecticides" },
  { key: "labour",      label: "Labour (full season)",        emoji: "👷", hint: "Planting, weeding, harvesting wages" },
  { key: "equipment",   label: "Equipment & Machinery",       emoji: "⚙️",  hint: "Pump hire, tractor rental, tools" },
  { key: "irrigation",  label: "Irrigation & Water",          emoji: "💧", hint: "Drip pipes, water pumping, canal fees" },
  { key: "transport",   label: "Transport & Logistics",        emoji: "🚛", hint: "Produce to market, input delivery" },
  { key: "postHarvest", label: "Post-Harvest Handling",       emoji: "📦", hint: "Drying, storage, packaging, grading" },
  { key: "insurance",   label: "Crop Insurance",               emoji: "🛡️",  hint: "Weather & crop failure cover" },
];

// Split the 10 cost items into two shorter steps
const LAND_INPUT_COST_ITEMS = COST_ITEMS.filter(i => ["landPrep","seeds","fertilizer","pesticides"].includes(i.key));
const LABOUR_LOGISTICS_COST_ITEMS = COST_ITEMS.filter(i => ["labour","equipment","irrigation","transport","postHarvest","insurance"].includes(i.key));

const GUIDE_STEPS = [
  { icon: Shield,     title: "1. Get Verified",      body: "Upload National ID & Farm docs for KYC approval.",                color: "text-blue-600",   bg: "bg-blue-50"   },
  { icon: DollarSign, title: "2. Submit Proposal",   body: "Itemise every cost from land prep to harvest.",                  color: "text-primary",    bg: "bg-primary/5" },
  { icon: Users,      title: "3. Investors Fund You", body: "Your farm is listed on the market. Investors buy shares.",       color: "text-amber-600",  bg: "bg-amber-50"  },
  { icon: BarChart3,  title: "4. Earn Your 55%",     body: "After harvest, you keep 55% of gross revenue. No upfront fee.",  color: "text-green-600",  bg: "bg-green-50"  },
];

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:        { label: "Draft",        cls: "badge-pending"   },
  submitted:    { label: "Submitted",    cls: "badge-submitted" },
  under_review: { label: "Under Review", cls: "badge-submitted" },
  approved:     { label: "Approved",     cls: "badge-approved"  },
  rejected:     { label: "Rejected",     cls: "badge-rejected"  },
  disbursed:    { label: "Disbursed",    cls: "badge-approved"  },
};

const CONTRACT_TEXT = `INVESTA FARM PRODUCTION FUNDING AGREEMENT

This Production Funding Agreement ("Agreement") is entered into between Investa Farm Platform ("Platform") and the applicant Farmer ("Farmer") upon submission of a funding proposal.

1. PLATFORM OBLIGATIONS
The Platform agrees to:
• Review and process the funding proposal within 2 business days
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
• Use disbursed funds ONLY for the declared cost items in the proposal
• Not divert disbursed funds to non-declared purposes

3. COST PROPOSAL COMMITMENT
The Farmer commits that the itemised budget submitted in the proposal reflects real, planned expenditures. Any material deviation (>20%) in a cost category must be reported to the Platform within 7 days.

4. REVENUE SHARING
Upon harvest and sale of produce:
• Farmer receives: 55% of gross harvest revenue
• Investor pool receives: 44.5% of gross harvest revenue
• Platform service fee: 0.5% deducted from the investor pool only
The Farmer is not charged a platform fee on their 55% share.

5. REPAYMENT TERMS
• Simple interest rate: 8% per annum on the principal
• Repayment from harvest proceeds or wallet within the agreed period
• No penalty for early repayment
• In case of proven natural disaster, repayment may be restructured

6. COVENANTS
• The Farmer warrants that the farm exists and all KYC documents are genuine
• The Farmer shall not list the same farm on any other crowdfunding platform during the term
• The Farmer shall maintain crop insurance where commercially available

7. GOVERNING LAW
This Agreement is governed by the laws of the Republic of Kenya.`;

// ── Credit score gauge ───────────────────────────────────────────────────────
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

function computeCreditScore(kycApproved: number, cropType: string, acreage: string, total: number, hasBreakdown: boolean, expectedRevenue: number): number {
  let score = 600;
  score += Math.min(kycApproved * 45, 130);
  if (cropType && cropType !== "Other") score += 25;
  if (parseFloat(acreage) >= 2) score += 20;
  if (total > 0 && total <= 200000) score += 15;
  if (total > 500000) score -= 25;
  if (hasBreakdown) score += 20;
  if (expectedRevenue > total * 1.5) score += 15;
  return Math.min(Math.max(score, 500), 780);
}

// ── KES input helper ─────────────────────────────────────────────────────────
function KesInput({ label, hint, emoji, value, onChange }: {
  label: string; hint: string; emoji: string; value: number; onChange: (v: number) => void;
}) {
  const [raw, setRaw] = useState(value > 0 ? String(value) : "");
  return (
    <div className="border border-border rounded-2xl p-3 bg-card">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-foreground font-semibold text-xs">{emoji} {label}</p>
          <p className="text-muted-foreground text-[10px] mt-0.5">{hint}</p>
        </div>
        {value > 0 && <span className="text-primary text-[10px] font-bold">{formatKES(value)}</span>}
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">KES</span>
        <input
          type="text" inputMode="numeric" value={raw}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9]/g, "");
            setRaw(v);
            onChange(v ? parseInt(v, 10) : 0);
          }}
          placeholder="0"
          className="w-full border border-border rounded-xl pl-10 pr-3 py-2.5 text-foreground text-sm font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
        />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function LoanApply() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const token = getToken();

  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [submitDone, setSubmitDone] = useState(false);
  const [aiScore, setAiScore] = useState(0);
  const [aiScoring, setAiScoring] = useState(false);
  const [kycWarning, setKycWarning] = useState(false);

  // Step 1: Farm details
  const [cropType, setCropType] = useState("");
  const [acreage, setAcreage] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [farmDesc, setFarmDesc] = useState("");

  // Step 2: Cost breakdown
  const [costs, setCosts] = useState<Record<string, number>>({
    landPrep: 0, seeds: 0, fertilizer: 0, pesticides: 0, labour: 0,
    equipment: 0, irrigation: 0, transport: 0, postHarvest: 0, insurance: 0,
  });

  // Step 3: Revenue projections
  const [yieldKg, setYieldKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [repaymentMonths, setRepaymentMonths] = useState(6);

  // Contract
  const [agreedToContract, setAgreedToContract] = useState(false);
  const [contractScrolled, setContractScrolled] = useState(false);
  const contractRef = useRef<HTMLDivElement>(null);

  // Template upload
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Auto-close fully on success (4s countdown) — closes modal, resets ALL state, and
  // navigates to the farm listing so the flow doesn't just dump the farmer back on a
  // half-reset form.
  useEffect(() => {
    if (modalStep === TOTAL_STEPS && submitDone) {
      const t = setTimeout(() => {
        closeModal();
        setLocation("/farmer/farm-profile");
      }, 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [modalStep, submitDone]);

  const handleDownloadTemplate = () => {
    const rows = [
      "INVESTA FARM PROPOSAL TEMPLATE",
      "Fill in each field and upload below or use as a reference when submitting.",
      "",
      "SECTION 1 - FARM DETAILS",
      "Field,Your Answer",
      "Crop Type,",
      "Farm Location,",
      "Acreage (acres),",
      "Expected Harvest Date (YYYY-MM-DD),",
      "Farm Description,",
      "",
      "SECTION 2 - COST BREAKDOWN (KES)",
      "Cost Item,Amount (KES)",
      "Land Preparation,",
      "Seeds & Planting Material,",
      "Fertilizer & Amendments,",
      "Pesticides & Crop Protection,",
      "Labour (full season),",
      "Equipment & Machinery,",
      "Irrigation & Water,",
      "Transport & Logistics,",
      "Post-Harvest Handling,",
      "Crop Insurance,",
      "",
      "SECTION 3 - REVENUE PROJECTIONS",
      "Field,Your Answer",
      "Expected Yield (kg),",
      "Market Price per kg (KES),",
      "Preferred Repayment Period (months),",
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "investa-farm-proposal-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
  };

  // Derived calculations
  const subtotal = Object.values(costs).reduce((a, b) => a + b, 0);
  const contingency = Math.round(subtotal * 0.10);
  const totalAmount = subtotal + contingency;
  const grossRevenue = (parseFloat(yieldKg) || 0) * (parseFloat(pricePerKg) || 0);
  const farmerShare = grossRevenue * 0.55;
  const investorShare = grossRevenue * 0.445;
  const roi = totalAmount > 0 ? ((farmerShare - totalAmount) / totalAmount) * 100 : 0;

  const { data: creditTier } = useQuery<CreditTier>({
    queryKey: ["credit-tier"],
    queryFn: async () => {
      const r = await fetch("/api/loans/credit-tier", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return undefined;
      return r.json();
    },
  });

  const { data: kycDocs = [] } = useQuery<any[]>({
    queryKey: ["kyc-docs"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const kycApproved = (kycDocs as any[]).filter(d => d.status === "approved").length;
  const kycOk = kycApproved >= 1;

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
      setModalStep(7);
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

  // 7 shorter steps: Farm Basics → Land & Inputs → Labour & Logistics → Revenue → AI Score → Agreement → Done
  const canGoNext: Record<number, boolean> = {
    1: !!cropType && !!farmLocation,
    2: true, // land & input costs — optional per item
    3: totalAmount >= 10000,
    4: (parseFloat(yieldKg) || 0) > 0 && (parseFloat(pricePerKg) || 0) > 0,
    5: !aiScoring,
    6: agreedToContract,
  };

  const handleNext = async () => {
    if (modalStep === 4) {
      setModalStep(5);
      setAiScoring(true);
      await new Promise(r => setTimeout(r, 2000));
      setAiScore(computeCreditScore(kycApproved, cropType, acreage, totalAmount, subtotal > 0, grossRevenue));
      setAiScoring(false);
      return;
    }
    if (modalStep === 6) {
      const costBreakdown = { ...costs, contingency, total: totalAmount };
      apply.mutate({
        amount: totalAmount,
        purpose: "other" as const,
        purposeDetails: farmDesc || `${cropType} farm in ${farmLocation} — ${acreage || "?"}ac`,
        repaymentPeriodMonths: repaymentMonths,
        cropType,
        location: farmLocation,
        acreage,
        harvestDate,
        costBreakdown,
        expectedYieldKg: yieldKg,
        expectedPricePerKg: pricePerKg,
        expectedRevenue: grossRevenue || undefined,
        farmerShare: farmerShare || undefined,
      });
      return;
    }
    setModalStep(s => s + 1);
  };

  const handleBack = () => setModalStep(s => Math.max(1, s - 1));
  const closeModal = () => { setShowModal(false); setModalStep(1); };

  const STEP_LABELS = ["Farm Details", "Land & Inputs", "Labour & Logistics", "Revenue Projections", "AI Score", "Agreement", "Done!"];
  const TOTAL_STEPS = 7;

  return (
    <div className="app-shell pb-20 page-enter">
      {/* Header */}
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/farmer")} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-white/70 text-xs">Farm Financing</p>
            <h1 className="text-white text-lg font-bold">Apply for Money</h1>
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

        {/* Main CTA */}
        <div className="bg-gradient-to-br from-primary to-emerald-700 rounded-3xl p-5 text-white shadow-lg shadow-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-emerald-200" />
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">AI-Powered Credit</p>
          </div>
          <h2 className="font-black text-xl mb-1">Full-Cost Farm Proposal</h2>
          <p className="text-white/70 text-xs leading-relaxed mb-3">Submit a detailed budget — every cost from land prep to harvest — get an AI credit score, and raise capital from investors.</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {["KES 10K–2M","Itemised Budget","AI Scoring","Revenue Forecast"].map(t => (
              <span key={t} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/15">{t}</span>
            ))}
          </div>
          <button onClick={handleOpenModal}
            className="w-full bg-white text-primary font-bold py-3.5 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 text-sm shadow-sm">
            <Zap size={16} /> Submit Farm Proposal
          </button>
        </div>

        {/* Proposal Template Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <FileText size={15} className="text-emerald-700" />
            <p className="text-emerald-800 font-bold text-sm">Proposal Template</p>
          </div>
          <p className="text-emerald-700 text-xs leading-relaxed mb-3">
            Download the cost-breakdown template, fill it in offline, and upload it here — or submit the form below directly.
          </p>
          <div className="flex gap-2">
            <button onClick={handleDownloadTemplate}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-all">
              <Download size={13} /> Download Template
            </button>
            <label className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-emerald-300 text-emerald-700 text-xs font-bold py-2.5 rounded-xl cursor-pointer active:scale-95 transition-all">
              <Upload size={13} /> Upload Filled
              <input type="file" accept=".csv,.xlsx,.xls,.pdf,.doc,.docx" className="hidden" onChange={handleUploadTemplate} />
            </label>
          </div>
          {uploadedFileName && (
            <p className="text-emerald-700 text-[10px] mt-2 flex items-center gap-1">
              <CheckCircle2 size={10} /> {uploadedFileName} attached
            </p>
          )}
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
            <BarChart3 size={13} className="text-primary" /> Revenue Split at Harvest
          </p>
          <div className="flex h-3 rounded-full overflow-hidden mb-2 gap-0.5">
            <div className="bg-primary rounded-l-full" style={{ width: "55%" }} />
            <div className="bg-amber-400" style={{ width: "44.5%" }} />
            <div className="bg-muted-foreground/30 rounded-r-full" style={{ width: "0.5%" }} />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-primary rounded-sm" /><span className="font-semibold">55% Farmer</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-400 rounded-sm" /><span className="font-semibold">44.5% Investors</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-muted-foreground/30 rounded-sm" /><span className="text-muted-foreground">0.5% Fee</span></div>
          </div>
        </div>

        {/* Credit tier badge */}
        {creditTier && (
          <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border ${TIER_META[creditTier.tier]!.bg}`}>
            <Award size={14} className={TIER_META[creditTier.tier]!.color} />
            <span className={`text-sm font-bold ${TIER_META[creditTier.tier]!.color}`}>
              {TIER_META[creditTier.tier]!.emoji} {TIER_META[creditTier.tier]!.label}
            </span>
            <span className={`text-xs ${TIER_META[creditTier.tier]!.color} opacity-70 ml-auto`}>{creditTier.interestRate}% p.a.</span>
          </div>
        )}

      </div>

      <BottomNav role="farmer" />

      {/* ── 6-STEP PROPOSAL MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={e => { if (e.target === e.currentTarget && modalStep < TOTAL_STEPS) closeModal(); }}>
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-card w-full max-w-[430px] rounded-t-3xl overflow-hidden flex flex-col"
              style={{ maxHeight: "92dvh" }}>

              {/* Header — gradient green */}
              <div className="flex-shrink-0 relative overflow-hidden"
                style={{ background: modalStep === TOTAL_STEPS
                  ? "linear-gradient(135deg,#052e16 0%,#15803d 60%,#22c55e 100%)"
                  : "linear-gradient(135deg,#14532d 0%,#16a34a 70%,#22c55e 100%)" }}>

                {/* Top row: back / title / close */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <div className="flex items-center gap-2.5">
                    {modalStep > 1 && modalStep < TOTAL_STEPS && (
                      <button onClick={handleBack}
                        className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                        <ChevronLeft size={14} className="text-white" />
                      </button>
                    )}
                    <div>
                      <p className="font-bold text-white text-sm leading-tight">{STEP_LABELS[modalStep - 1]}</p>
                      {modalStep < TOTAL_STEPS && (
                        <p className="text-white/60 text-[10px]">Step {modalStep} of {TOTAL_STEPS}</p>
                      )}
                    </div>
                  </div>
                  {modalStep < TOTAL_STEPS && (
                    <button onClick={closeModal}
                      className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <X size={14} className="text-white" />
                    </button>
                  )}
                </div>

                {/* Step indicator */}
                {modalStep < TOTAL_STEPS ? (
                  <div className="flex items-start justify-between px-5 pb-5">
                    {[
                      { n: 1, label: "Farm" },
                      { n: 2, label: "Land" },
                      { n: 3, label: "Labour" },
                      { n: 4, label: "Revenue" },
                      { n: 5, label: "AI Score" },
                      { n: 6, label: "Sign" },
                    ].map(({ n, label }, idx) => {
                      const done = n < modalStep;
                      const active = n === modalStep;
                      return (
                        <div key={n} className="flex flex-col items-center gap-1 flex-1">
                          <div className="relative flex items-center w-full justify-center">
                            {idx > 0 && (
                              <div className={`absolute top-1/2 -translate-y-1/2 h-0.5 w-full transition-colors ${done ? "bg-white" : "bg-white/25"}`}
                                style={{ right: "50%", left: 0 }} />
                            )}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 border-2 transition-all ${
                              done ? "bg-white border-white text-primary" :
                              active ? "bg-white/20 border-white text-white shadow-lg" :
                              "bg-white/10 border-white/30 text-white/50"
                            }`}>
                              {done ? "✓" : n}
                            </div>
                          </div>
                          <span className={`text-[9px] font-semibold leading-tight text-center ${
                            active ? "text-white" : done ? "text-white/70" : "text-white/40"
                          }`}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex gap-1 px-5 pb-5">
                    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                      <div key={i} className="flex-1 h-1.5 rounded-full bg-white/80" />
                    ))}
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 px-5 py-5">

                {/* ── STEP 1: Farm Details ── */}
                {modalStep === 1 && (
                  <div className="space-y-4">
                    <div className="text-center mb-2">
                      <div className="text-3xl mb-1">🌾</div>
                      <h3 className="font-bold text-foreground text-base">Tell us about your farm</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">This creates your farm listing for investors</p>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Crop Type *</label>
                      <select value={cropType} onChange={e => setCropType(e.target.value)}
                        className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary">
                        <option value="">Select a crop…</option>
                        {CROP_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Acreage</label>
                        <input type="number" value={acreage} onChange={e => setAcreage(e.target.value)}
                          placeholder="e.g. 5" min={0.1} step={0.1}
                          className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Harvest Date</label>
                        <input type="date" value={harvestDate} onChange={e => setHarvestDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Farm Location *</label>
                      <input type="text" value={farmLocation} onChange={e => setFarmLocation(e.target.value)}
                        placeholder="e.g. Nakuru County, Kenya"
                        className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary" />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Farm Description</label>
                      <textarea value={farmDesc} onChange={e => setFarmDesc(e.target.value)}
                        placeholder="Describe your farm, soil type, water source, experience…"
                        rows={3}
                        className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary resize-none" />
                    </div>
                  </div>
                )}

                {/* ── STEP 2: Land & Input Costs ── */}
                {modalStep === 2 && (
                  <div className="space-y-3">
                    <div className="text-center mb-1">
                      <div className="text-3xl mb-1">🌱</div>
                      <h3 className="font-bold text-foreground text-base">Land & Input Costs</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">Land prep, seeds & crop protection. Leave at 0 if not applicable.</p>
                    </div>

                    {LAND_INPUT_COST_ITEMS.map(item => (
                      <KesInput
                        key={item.key}
                        label={item.label}
                        hint={item.hint}
                        emoji={item.emoji}
                        value={costs[item.key] ?? 0}
                        onChange={v => setCosts(prev => ({ ...prev, [item.key]: v }))}
                      />
                    ))}

                    <div className="bg-muted/40 rounded-xl p-3 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Running subtotal</span>
                      <span className="font-bold text-foreground">
                        {formatKES(LAND_INPUT_COST_ITEMS.reduce((s, i) => s + (costs[i.key] ?? 0), 0))}
                      </span>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Labour & Logistics Costs ── */}
                {modalStep === 3 && (
                  <div className="space-y-3">
                    <div className="text-center mb-1">
                      <div className="text-3xl mb-1">🚛</div>
                      <h3 className="font-bold text-foreground text-base">Labour & Logistics Costs</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">Labour, equipment, transport & storage. Leave at 0 if not applicable.</p>
                    </div>

                    {LABOUR_LOGISTICS_COST_ITEMS.map(item => (
                      <KesInput
                        key={item.key}
                        label={item.label}
                        hint={item.hint}
                        emoji={item.emoji}
                        value={costs[item.key] ?? 0}
                        onChange={v => setCosts(prev => ({ ...prev, [item.key]: v }))}
                      />
                    ))}

                    {/* Auto totals */}
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2.5 mt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-bold">{formatKES(subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Contingency (10%)</span>
                        <span className="font-semibold text-amber-600">{formatKES(contingency)}</span>
                      </div>
                      <div className="border-t border-primary/20 pt-2 flex items-center justify-between">
                        <span className="text-foreground font-bold">Total Funding Required</span>
                        <span className="text-primary font-black text-lg">{formatKES(totalAmount)}</span>
                      </div>
                    </div>

                    {totalAmount > 0 && totalAmount < 10000 && (
                      <p className="text-red-600 text-xs text-center">Minimum funding request is KES 10,000</p>
                    )}
                  </div>
                )}

                {/* ── STEP 4: Revenue Projections ── */}
                {modalStep === 4 && (
                  <div className="space-y-4">
                    <div className="text-center mb-2">
                      <div className="text-3xl mb-1">📈</div>
                      <h3 className="font-bold text-foreground text-base">Revenue Projections</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">Help investors understand your expected returns</p>
                    </div>

                    <div className="bg-muted/40 rounded-2xl p-3.5 space-y-1">
                      <p className="text-xs font-semibold text-foreground">Funding requested</p>
                      <p className="text-primary font-black text-xl">{formatKES(totalAmount)}</p>
                      <p className="text-muted-foreground text-[10px]">{cropType} · {acreage ? acreage + " acres · " : ""}{farmLocation}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Expected Yield
                        </label>
                        <div className="relative">
                          <input type="number" value={yieldKg} onChange={e => setYieldKg(e.target.value)}
                            placeholder="kg / bags" min={0}
                            className="w-full border border-border rounded-xl px-3.5 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary pr-10" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kg</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Market Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">KES</span>
                          <input type="number" value={pricePerKg} onChange={e => setPricePerKg(e.target.value)}
                            placeholder="per kg" min={0}
                            className="w-full border border-border rounded-xl pl-11 pr-3 py-3 text-sm text-foreground bg-background focus:outline-none focus:border-primary" />
                        </div>
                      </div>
                    </div>

                    {/* Revenue summary */}
                    {grossRevenue > 0 && (
                      <div className="space-y-2">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 space-y-3">
                          <p className="text-green-800 font-bold text-sm flex items-center gap-1.5">
                            <TrendingUp size={14} /> Revenue Forecast
                          </p>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Gross Revenue</span>
                              <span className="font-bold text-green-800">{formatKES(grossRevenue)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Your 55% Share</span>
                              <span className="font-bold text-primary">{formatKES(farmerShare)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Investor 44.5% Share</span>
                              <span className="font-semibold text-amber-700">{formatKES(investorShare)}</span>
                            </div>
                            <div className="border-t border-green-200 pt-2 flex justify-between text-sm">
                              <span className="text-muted-foreground">Your Net Profit</span>
                              <span className={`font-black ${farmerShare - totalAmount >= 0 ? "text-green-700" : "text-red-600"}`}>
                                {formatKES(farmerShare - totalAmount)}
                              </span>
                            </div>
                            <div className="bg-white/60 rounded-xl p-2 flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Return on Investment</span>
                              <span className={`font-black text-sm ${roi >= 0 ? "text-green-700" : "text-red-600"}`}>
                                {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Repayment period */}
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Repayment Period: <span className="text-primary">{repaymentMonths} months</span>
                      </label>
                      <input type="range" min={1} max={24} step={1} value={repaymentMonths}
                        onChange={e => setRepaymentMonths(parseInt(e.target.value))}
                        className="w-full accent-primary" />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>1 month</span>
                        <span>Monthly: {formatKES((totalAmount * 1.08) / repaymentMonths)}</span>
                        <span>24 months</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 5: AI Score ── */}
                {modalStep === 5 && (
                  <div className="space-y-5">
                    <div className="text-center">
                      <div className="text-3xl mb-1">🤖</div>
                      <h3 className="font-bold text-foreground text-base">AI Credit Assessment</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">Our AI reviews your full proposal and assigns a credit score</p>
                    </div>

                    {aiScoring ? (
                      <div className="py-8 text-center space-y-3">
                        <Loader2 size={32} className="animate-spin text-primary mx-auto" />
                        <p className="text-sm text-muted-foreground">Analysing your proposal…</p>
                        <div className="flex justify-center gap-1">
                          {["Crop risk","Cost ratios","ROI check","KYC status"].map((l, i) => (
                            <span key={l} className="text-[9px] px-2 py-1 bg-primary/10 text-primary rounded-full animate-pulse"
                              style={{ animationDelay: `${i * 200}ms` }}>{l}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <ScoreGauge score={aiScore} />

                        <div className="space-y-2">
                          {[
                            { label: "Proposal Completeness", val: Object.values(costs).filter(v => v > 0).length * 10 + "%", good: true },
                            { label: "Cost-to-Revenue Ratio", val: grossRevenue > 0 ? ((totalAmount / grossRevenue) * 100).toFixed(0) + "%" : "N/A", good: grossRevenue > totalAmount },
                            { label: "KYC Documents", val: `${kycApproved} approved`, good: kycApproved >= 1 },
                            { label: "Crop Risk Level", val: ["maize","beans","kale","wheat"].some(c => cropType.toLowerCase().includes(c)) ? "Low" : "Moderate", good: true },
                          ].map(item => (
                            <div key={item.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                              <span className="text-sm text-muted-foreground">{item.label}</span>
                              <span className={`text-xs font-bold ${item.good ? "text-green-600" : "text-amber-600"}`}>{item.val}</span>
                            </div>
                          ))}
                        </div>

                        <div className="bg-muted/50 rounded-2xl p-3.5">
                          <p className="text-xs font-semibold text-foreground mb-1">📋 Proposal Summary</p>
                          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            <div><span className="text-muted-foreground">Crop: </span><span className="font-semibold">{cropType}</span></div>
                            <div><span className="text-muted-foreground">Acreage: </span><span className="font-semibold">{acreage || "—"} ac</span></div>
                            <div><span className="text-muted-foreground">Total Cost: </span><span className="font-semibold">{formatKES(totalAmount)}</span></div>
                            <div><span className="text-muted-foreground">Proj. Revenue: </span><span className="font-semibold">{grossRevenue > 0 ? formatKES(grossRevenue) : "—"}</span></div>
                            <div><span className="text-muted-foreground">Repayment: </span><span className="font-semibold">{repaymentMonths} months</span></div>
                            <div><span className="text-muted-foreground">ROI: </span><span className={`font-semibold ${roi >= 0 ? "text-green-600" : "text-red-500"}`}>{roi.toFixed(1)}%</span></div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── STEP 6: Agreement ── */}
                {modalStep === 6 && (
                  <div className="space-y-4">
                    <div className="text-center mb-2">
                      <div className="text-3xl mb-1"><ScrollText size={32} className="mx-auto text-primary" /></div>
                      <h3 className="font-bold text-foreground text-base">Production Funding Agreement</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">Read the full agreement, then confirm to submit your proposal</p>
                    </div>

                    <div ref={contractRef} onScroll={e => {
                      const el = e.currentTarget;
                      if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) setContractScrolled(true);
                    }}
                      className="bg-muted/50 rounded-2xl p-4 text-[11px] text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap overflow-y-auto"
                      style={{ maxHeight: "30vh" }}>
                      {CONTRACT_TEXT}
                    </div>

                    {!contractScrolled && (
                      <p className="text-amber-600 text-[11px] text-center animate-pulse">↓ Scroll to the bottom to accept</p>
                    )}

                    <label className={`flex items-start gap-3 cursor-pointer ${!contractScrolled ? "opacity-40" : ""}`}>
                      <input type="checkbox" checked={agreedToContract} disabled={!contractScrolled}
                        onChange={e => setAgreedToContract(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border-border accent-primary" />
                      <div>
                        <p className="text-foreground text-xs font-semibold">I agree to the Production Funding Agreement</p>
                        <p className="text-muted-foreground text-[10px] mt-0.5">
                          I commit to the {formatKES(totalAmount)} budget proposal for {cropType} farming in {farmLocation}. Revenue split: 55% Farmer / 44.5% Investors / 0.5% Platform.
                        </p>
                      </div>
                    </label>

                    {apply.error && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                        <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                        <p className="text-red-700 text-xs">{(apply.error as Error).message}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 7: Done ── */}
                {modalStep === 7 && (
                  <div className="space-y-5 py-2">
                    {/* Hero success banner */}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                      className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-6 text-center space-y-3">
                      <motion.div
                        initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", damping: 12, stiffness: 220, delay: 0.1 }}
                        className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/40 flex items-center justify-center mx-auto">
                        <CheckCircle2 size={42} className="text-white" />
                      </motion.div>
                      <div>
                        <motion.h3 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                          className="font-black text-white text-2xl tracking-tight">🎉 Proposal Live!</motion.h3>
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                          className="text-white/80 text-sm mt-1">Your farm is now open for investment</motion.p>
                      </div>
                      {/* Auto-close countdown bar */}
                      <div className="mx-auto max-w-[140px]">
                        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-white rounded-full"
                            initial={{ width: "100%" }} animate={{ width: "0%" }}
                            transition={{ duration: 4, ease: "linear" }} />
                        </div>
                        <p className="text-white/50 text-[9px] mt-1">Closing automatically…</p>
                      </div>
                    </motion.div>

                    {/* Proposal summary cards */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="grid grid-cols-2 gap-2">
                      {[
                        { icon: "🌾", label: "Crop", val: cropType, color: "text-foreground" },
                        { icon: "💰", label: "Funding", val: formatKES(totalAmount), color: "text-primary font-black" },
                        { icon: "📍", label: "Location", val: farmLocation || "—", color: "text-foreground" },
                        { icon: "💵", label: "Your 55% Share", val: grossRevenue > 0 ? formatKES(farmerShare) : "At harvest", color: "text-green-700 font-black" },
                      ].map(({ icon, label, val, color }) => (
                        <div key={label} className="bg-card border border-border rounded-2xl p-3">
                          <p className="text-lg mb-0.5">{icon}</p>
                          <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</p>
                          <p className={`text-xs mt-0.5 truncate ${color}`}>{val}</p>
                        </div>
                      ))}
                    </motion.div>

                    {/* What happens next */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                      className="bg-card border border-border rounded-2xl p-4 space-y-3">
                      <p className="text-xs font-bold text-foreground uppercase tracking-wider">What happens next?</p>
                      {[
                        { icon: "📊", step: "Farm listed on investor marketplace — visible to 15,000+ investors" },
                        { icon: "💸", step: "Investors buy shares to fund your proposal to 100%" },
                        { icon: "🏷️", step: "Once fully funded you receive a digital disbursement voucher" },
                        { icon: "🛒", step: "Redeem the voucher at certified agribusiness suppliers for inputs" },
                        { icon: "🌱", step: "Grow your crop and report harvest for revenue distribution" },
                      ].map(({ icon, step }, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.35 + i * 0.07 }}
                          className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
                            {icon}
                          </div>
                          <p className="text-muted-foreground text-xs leading-relaxed pt-1">{step}</p>
                        </motion.div>
                      ))}
                    </motion.div>

                    <div className="space-y-2 pb-2">
                      <button onClick={() => { closeModal(); setLocation("/farmer/farm-profile"); }}
                        className="w-full bg-primary text-white font-bold py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 text-sm">
                        <Leaf size={16} /> View My Farm on Market
                      </button>
                      <button onClick={closeModal}
                        className="w-full border border-border text-foreground font-semibold py-3 rounded-2xl active:scale-95 transition-all text-sm">
                        Back to Dashboard
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer — Next button */}
              {modalStep < TOTAL_STEPS && (
                <div className="px-5 py-4 border-t border-border flex-shrink-0">
                  <button
                    onClick={handleNext}
                    disabled={!canGoNext[modalStep] || apply.isPending}
                    className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40">
                    {apply.isPending ? (
                      <><Loader2 size={18} className="animate-spin" /> Submitting Proposal…</>
                    ) : modalStep === 6 ? (
                      <><CheckCircle2 size={18} /> Submit Proposal</>
                    ) : modalStep === 4 ? (
                      <><Calculator size={18} /> Run AI Assessment</>
                    ) : (
                      <>Continue <ChevronRight size={18} /></>
                    )}
                  </button>
                  {modalStep === 3 && totalAmount >= 10000 && (
                    <p className="text-center text-muted-foreground text-[10px] mt-2">
                      Requesting {formatKES(totalAmount)} · {COST_ITEMS.filter(i => (costs[i.key] ?? 0) > 0).length} cost items + 10% contingency
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
