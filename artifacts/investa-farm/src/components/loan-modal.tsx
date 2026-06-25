import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Loader2, Clock, FileText, QrCode, Copy, Check, AlertCircle, ShieldAlert, Sprout, Zap, ChevronRight, ChevronLeft, Leaf, DollarSign } from "lucide-react";
import { getToken, formatKES } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RepayModal } from "@/components/repay-modal";

type LoanApp = {
  id: number; amount: number; purpose: string; purposeDetails: string;
  repaymentPeriodMonths: number; status: string; submittedAt?: string; createdAt: string;
  voucherCode?: string; voucherExpiry?: string; cropType?: string;
};

const CROPS = [
  "Maize","Coffee","Tea","Avocado","Wheat","Potatoes","Tomatoes","Rice",
  "Sunflower","Beans","Dairy","Poultry","Cassava","Kale","Sorghum","Other",
];

const FUND_USES = [
  { value: "seeds",       label: "🌱 Seeds & Planting Material" },
  { value: "fertilizer",  label: "🧪 Fertilizer & Soil" },
  { value: "irrigation",  label: "💧 Irrigation" },
  { value: "labour",      label: "👷 Labour Costs" },
  { value: "equipment",   label: "🚜 Equipment & Tools" },
  { value: "pesticides",  label: "🛡️ Pesticides & Chemicals" },
  { value: "transport",   label: "🚛 Transport & Storage" },
  { value: "other",       label: "📋 Other" },
];

const SEASONS = ["Long Rains (Mar–Jul)", "Short Rains (Oct–Dec)", "Dry Season (Irrigation)", "Year-round"];
const LAND_SIZES = ["< 1 acre", "1–2 acres", "2–5 acres", "5–10 acres", "10–50 acres", "> 50 acres"];

const statusConfig: Record<string, { label: string; color: string }> = {
  draft:        { label: "Draft",        color: "text-gray-600 bg-gray-100" },
  submitted:    { label: "Submitted",    color: "text-blue-600 bg-blue-100" },
  under_review: { label: "Under Review", color: "text-amber-600 bg-amber-100" },
  approved:     { label: "Approved",     color: "text-green-600 bg-green-100" },
  rejected:     { label: "Rejected",     color: "text-red-600 bg-red-100" },
  disbursed:    { label: "Disbursed",    color: "text-purple-600 bg-purple-100" },
};

type ProposalType = "investment" | "shortloan" | null;

interface LoanModalProps { open: boolean; onClose: () => void; }

export function LoanModal({ open, onClose }: LoanModalProps) {
  const qc = useQueryClient();
  const token = getToken();

  const [proposalType, setProposalType] = useState<ProposalType>(null);
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [repayLoan, setRepayLoan] = useState<LoanApp | null>(null);
  const [repayOpen, setRepayOpen] = useState(false);

  // Investment proposal fields
  const [cropType, setCropType] = useState("Maize");
  const [landSize, setLandSize] = useState("1–2 acres");
  const [season, setSeason] = useState(SEASONS[0]!);
  const [targetAmount, setTargetAmount] = useState("");
  const [selectedUses, setSelectedUses] = useState<string[]>(["seeds", "fertilizer"]);
  const [expectedYield, setExpectedYield] = useState("");
  const [expectedRevenue, setExpectedRevenue] = useState("");
  const [farmDescription, setFarmDescription] = useState("");
  const [repaymentMonths, setRepaymentMonths] = useState(6);
  const [marketOutlet, setMarketOutlet] = useState("");
  const [experience, setExperience] = useState("");

  // Short loan fields
  const [loanAmount, setLoanAmount] = useState("");
  const [loanPurpose, setLoanPurpose] = useState("seeds");
  const [loanDetails, setLoanDetails] = useState("");
  const [loanRepayment, setLoanRepayment] = useState(3);

  const { data: apps = [], isLoading } = useQuery<LoanApp[]>({
    queryKey: ["loan-apps"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/loans/applications", { headers: { Authorization: `Bearer ${token}` } });
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
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.message ?? d.error ?? "Submission failed. Please try again.");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loan-apps"] });
      setSuccess(true);
      setProposalType(null);
      setStep(1);
      setTargetAmount(""); setLoanAmount("");
      setTimeout(() => setSuccess(false), 6000);
    },
  });

  const resetForm = () => {
    setProposalType(null);
    setStep(1);
    apply.reset();
  };

  const submitInvestment = () => {
    apply.mutate({
      amount: parseFloat(targetAmount),
      purpose: "other",
      purposeDetails: [
        `Crop: ${cropType}`,
        `Land: ${landSize}`,
        `Season: ${season}`,
        `Fund uses: ${selectedUses.join(", ")}`,
        `Expected yield: ${expectedYield}`,
        `Expected revenue: KES ${expectedRevenue}`,
        `Market outlet: ${marketOutlet}`,
        `Experience: ${experience} years`,
        `Description: ${farmDescription}`,
      ].join(" | "),
      cropType,
      repaymentPeriodMonths: repaymentMonths,
    });
  };

  const submitShortLoan = () => {
    apply.mutate({
      amount: parseFloat(loanAmount),
      purpose: loanPurpose,
      purposeDetails: loanDetails,
      cropType,
      repaymentPeriodMonths: loanRepayment,
    });
  };

  const copyCode = async (code: string, id: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleUse = (v: string) => {
    setSelectedUses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  };

  const monthlyLoan = loanAmount ? (parseFloat(loanAmount) * 1.08 / loanRepayment) : 0;
  const totalInvestment = targetAmount ? (parseFloat(targetAmount) * 1.08) : 0;

  const investStep1Valid = cropType && landSize && season && targetAmount && parseFloat(targetAmount) >= 10000;
  const investStep2Valid = selectedUses.length > 0 && farmDescription.length >= 20;
  const investStep3Valid = expectedYield && expectedRevenue;

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl flex flex-col"
              style={{ maxHeight: "93vh" }}>

              {/* Header */}
              <div className="hero-header rounded-t-3xl px-5 pt-5 pb-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    {proposalType === "investment" ? (
                      <>
                        <h2 className="text-white font-bold text-lg">Crop Investment Proposal</h2>
                        <p className="text-white/70 text-xs">Step {step} of 3 — {["Crop & Funding", "Use of Funds", "Yield & Market"][step - 1]}</p>
                      </>
                    ) : proposalType === "shortloan" ? (
                      <>
                        <h2 className="text-white font-bold text-lg">Short-Term Loan</h2>
                        <p className="text-white/70 text-xs">Quick financing · Repay within 3 months</p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-white font-bold text-lg">Apply for Funding</h2>
                        <p className="text-white/70 text-xs">Choose how you'd like to raise capital</p>
                      </>
                    )}
                  </div>
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <X size={16} className="text-white" />
                  </button>
                </div>
                {proposalType === "investment" && (
                  <div className="flex gap-1.5 mt-3">
                    {[1, 2, 3].map(s => (
                      <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? "bg-white" : "bg-white/25"}`} />
                    ))}
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4">

                {/* Success banner */}
                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-green-700 text-sm font-semibold">Proposal Submitted!</p>
                      <p className="text-green-600 text-xs mt-0.5">Our team reviews within 2 business days. We'll notify you by email and SMS.</p>
                    </div>
                  </div>
                )}

                {/* ── TYPE SELECTION ── */}
                {!proposalType && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Select the type of funding you need:</p>

                    <button
                      onClick={() => { setProposalType("investment"); setStep(1); apply.reset(); }}
                      className="w-full text-left border-2 border-primary/30 bg-primary/5 rounded-2xl p-4 space-y-2 active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                            <Sprout size={20} className="text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-sm">Crop Investment Proposal</p>
                            <p className="text-muted-foreground text-[11px]">Full-season investor-backed funding</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-primary mt-1" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {["KES 50K–5M", "6–12 mo repay", "No collateral"].map(t => (
                          <div key={t} className="bg-primary/10 rounded-lg px-2 py-1 text-center">
                            <p className="text-primary text-[10px] font-semibold">{t}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Your farm is listed on the Investa Farm marketplace. Investors buy shares and fund your season. You repay from harvest proceeds.
                      </p>
                    </button>

                    <button
                      onClick={() => { setProposalType("shortloan"); apply.reset(); }}
                      className="w-full text-left border-2 border-amber-200 bg-amber-50 rounded-2xl p-4 space-y-2 active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Zap size={20} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-sm">Short-Term Loan</p>
                            <p className="text-muted-foreground text-[11px]">Quick cash for urgent farm needs</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-amber-600 mt-1" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {["KES 5K–100K", "1–3 mo repay", "Fast approval"].map(t => (
                          <div key={t} className="bg-amber-100 rounded-lg px-2 py-1 text-center">
                            <p className="text-amber-700 text-[10px] font-semibold">{t}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Instant bridging finance for seeds, fertilizer, or labour. Repay within 1–3 months — ideal for cash flow gaps between seasons.
                      </p>
                    </button>
                  </div>
                )}

                {/* ── INVESTMENT PROPOSAL ── */}
                {proposalType === "investment" && (
                  <AnimatePresence mode="wait">
                    {step === 1 && (
                      <motion.div key="step1"
                        initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }} className="space-y-4">

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Crop Type *</label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {CROPS.map(c => (
                              <button key={c} type="button" onClick={() => setCropType(c)}
                                className={`py-2 rounded-xl border text-[11px] font-medium transition-all ${cropType === c ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground"}`}>
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Farm Size *</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {LAND_SIZES.map(s => (
                              <button key={s} type="button" onClick={() => setLandSize(s)}
                                className={`py-2 rounded-xl border text-[11px] font-medium transition-all ${landSize === s ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground"}`}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Growing Season *</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {SEASONS.map(s => (
                              <button key={s} type="button" onClick={() => setSeason(s)}
                                className={`py-2 px-2 rounded-xl border text-[11px] font-medium text-left transition-all ${season === s ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground"}`}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Funding Target (KES) *</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
                            <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)}
                              min={10000} placeholder="150,000"
                              className="w-full border border-border rounded-xl px-4 py-3 pl-14 text-foreground font-bold text-sm focus:outline-none focus:border-primary bg-white" />
                          </div>
                          <p className="text-[10px] text-muted-foreground">Minimum KES 10,000 · Maximum KES 5,000,000</p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Repayment Period *</label>
                          <div className="grid grid-cols-4 gap-2">
                            {[6, 9, 12, 18].map(m => (
                              <button key={m} type="button" onClick={() => setRepaymentMonths(m)}
                                className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${repaymentMonths === m ? "border-primary bg-primary text-white" : "border-border text-foreground bg-white"}`}>
                                {m} mo
                              </button>
                            ))}
                          </div>
                        </div>

                        {targetAmount && parseFloat(targetAmount) >= 10000 && (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                            <div><p className="text-muted-foreground">Funding Target</p><p className="font-bold text-foreground">{formatKES(parseFloat(targetAmount))}</p></div>
                            <div><p className="text-muted-foreground">Total Repayment (8%)</p><p className="font-bold text-foreground">{formatKES(totalInvestment)}</p></div>
                            <div><p className="text-muted-foreground">Monthly Instalment</p><p className="font-bold text-foreground">{formatKES(totalInvestment / repaymentMonths)}</p></div>
                            <div><p className="text-muted-foreground">Investor Return</p><p className="font-bold text-primary">8% p.a.</p></div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button onClick={resetForm}
                            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground flex items-center justify-center gap-1">
                            <ChevronLeft size={14} /> Back
                          </button>
                          <button onClick={() => setStep(2)} disabled={!investStep1Valid}
                            className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-40 active:scale-95 transition-transform">
                            Next <ChevronRight size={14} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {step === 2 && (
                      <motion.div key="step2"
                        initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }} className="space-y-4">

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Use of Funds * (select all that apply)</label>
                          <div className="grid grid-cols-2 gap-2">
                            {FUND_USES.map(u => (
                              <button key={u.value} type="button" onClick={() => toggleUse(u.value)}
                                className={`text-left p-2.5 rounded-xl border text-[11px] transition-all ${selectedUses.includes(u.value) ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border bg-white text-foreground"}`}>
                                {u.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Farm Description & Plan *</label>
                          <textarea value={farmDescription} onChange={e => setFarmDescription(e.target.value)}
                            rows={4} minLength={20}
                            placeholder="Describe your farm, what you plan to grow, how you'll manage the crop, and why investors should fund you…"
                            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary resize-none" />
                          <p className="text-[10px] text-muted-foreground">{farmDescription.length}/20 min characters</p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Years of Farming Experience</label>
                          <input value={experience} onChange={e => setExperience(e.target.value)}
                            type="number" min={0} placeholder="e.g. 5"
                            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => setStep(1)}
                            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground flex items-center justify-center gap-1">
                            <ChevronLeft size={14} /> Back
                          </button>
                          <button onClick={() => setStep(3)} disabled={!investStep2Valid}
                            className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-40 active:scale-95 transition-transform">
                            Next <ChevronRight size={14} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {step === 3 && (
                      <motion.div key="step3"
                        initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }} className="space-y-4">

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Expected Yield *</label>
                          <input value={expectedYield} onChange={e => setExpectedYield(e.target.value)}
                            placeholder="e.g. 30 bags of 90kg maize"
                            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Expected Revenue (KES) *</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">KES</span>
                            <input value={expectedRevenue} onChange={e => setExpectedRevenue(e.target.value)}
                              type="number" placeholder="250,000"
                              className="w-full border border-border rounded-xl px-4 py-3 pl-14 text-sm font-bold bg-white focus:outline-none focus:border-primary" />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Market Outlet / Buyer</label>
                          <input value={marketOutlet} onChange={e => setMarketOutlet(e.target.value)}
                            placeholder="e.g. Local NCPB depot, Nakumatt, Direct market, Cooperative…"
                            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                        </div>

                        {expectedRevenue && targetAmount && (
                          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
                            <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                              <Leaf size={12} className="text-primary" /> Proposal Summary
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div><p className="text-muted-foreground">Crop</p><p className="font-bold">{cropType} · {landSize}</p></div>
                              <div><p className="text-muted-foreground">Season</p><p className="font-bold">{season.split("(")[0]?.trim()}</p></div>
                              <div><p className="text-muted-foreground">Funding</p><p className="font-bold text-primary">{formatKES(parseFloat(targetAmount))}</p></div>
                              <div><p className="text-muted-foreground">Expected Revenue</p><p className="font-bold text-green-600">{formatKES(parseFloat(expectedRevenue))}</p></div>
                              <div className="col-span-2"><p className="text-muted-foreground">Fund Uses</p><p className="font-bold">{selectedUses.map(v => FUND_USES.find(u => u.value === v)?.label.split(" ").slice(1).join(" ")).join(", ")}</p></div>
                            </div>
                          </div>
                        )}

                        {apply.isError && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                            <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-red-700 text-xs font-semibold">{(apply.error as Error).message}</p>
                              {(apply.error as Error).message?.includes("KYC") && (
                                <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                                  <ShieldAlert size={11} className="flex-shrink-0" />
                                  Complete your <strong>KYC verification</strong> first before applying.
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button onClick={() => setStep(2)}
                            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground flex items-center justify-center gap-1">
                            <ChevronLeft size={14} /> Back
                          </button>
                          <button onClick={submitInvestment} disabled={!investStep3Valid || apply.isPending}
                            className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-transform">
                            {apply.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sprout size={16} />}
                            {apply.isPending ? "Submitting…" : "Submit Proposal"}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}

                {/* ── SHORT TERM LOAN ── */}
                {proposalType === "shortloan" && (
                  <motion.div
                    initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }} className="space-y-4">

                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                      <p className="text-amber-700 text-[11px] leading-relaxed flex items-start gap-2">
                        <Zap size={12} className="flex-shrink-0 mt-0.5 text-amber-600" />
                        Short-term loans are for urgent farm expenses only. Maximum KES 100,000 · Max 3 months repayment. 8% flat interest applied.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Loan Amount (KES) *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">KES</span>
                        <input type="number" value={loanAmount} onChange={e => setLoanAmount(e.target.value)}
                          min={5000} max={100000} placeholder="30,000"
                          className="w-full border border-border rounded-xl px-4 py-3 pl-14 text-foreground font-bold text-sm focus:outline-none focus:border-primary bg-white" />
                      </div>
                      <p className="text-[10px] text-muted-foreground">KES 5,000 – 100,000</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Crop (for this loan) *</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {CROPS.slice(0, 8).map(c => (
                          <button key={c} type="button" onClick={() => setCropType(c)}
                            className={`py-2 rounded-xl border text-[11px] font-medium transition-all ${cropType === c ? "border-amber-500 bg-amber-500 text-white" : "border-border bg-white text-foreground"}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Purpose *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {FUND_USES.slice(0, 6).map(u => (
                          <button key={u.value} type="button" onClick={() => setLoanPurpose(u.value)}
                            className={`text-left p-2.5 rounded-xl border text-[11px] transition-all ${loanPurpose === u.value ? "border-amber-500 bg-amber-50 text-amber-700 font-semibold" : "border-border bg-white text-foreground"}`}>
                            {u.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Details *</label>
                      <textarea value={loanDetails} onChange={e => setLoanDetails(e.target.value)}
                        rows={3} minLength={10}
                        placeholder="Briefly explain how you'll use this loan and how you plan to repay it…"
                        className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary resize-none" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Repayment Period *</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map(m => (
                          <button key={m} type="button" onClick={() => setLoanRepayment(m)}
                            className={`py-3 rounded-xl border text-xs font-bold transition-all ${loanRepayment === m ? "border-amber-500 bg-amber-500 text-white" : "border-border text-foreground bg-white"}`}>
                            {m} Month{m > 1 ? "s" : ""}
                          </button>
                        ))}
                      </div>
                    </div>

                    {loanAmount && parseFloat(loanAmount) >= 5000 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                        <div><p className="text-muted-foreground">Loan Amount</p><p className="font-bold">{formatKES(parseFloat(loanAmount))}</p></div>
                        <div><p className="text-muted-foreground">Interest (8%)</p><p className="font-bold">{formatKES(parseFloat(loanAmount) * 0.08)}</p></div>
                        <div><p className="text-muted-foreground">Total Owed</p><p className="font-bold">{formatKES(parseFloat(loanAmount) * 1.08)}</p></div>
                        <div><p className="text-muted-foreground">Monthly Est.</p><p className="font-bold text-amber-700">{formatKES(monthlyLoan)}</p></div>
                      </div>
                    )}

                    {apply.isError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                        <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-red-700 text-xs font-semibold">{(apply.error as Error).message}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button onClick={resetForm}
                        className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground flex items-center justify-center gap-1">
                        <ChevronLeft size={14} /> Back
                      </button>
                      <button
                        onClick={submitShortLoan}
                        disabled={!loanAmount || parseFloat(loanAmount) < 5000 || !loanDetails || loanDetails.length < 10 || apply.isPending}
                        className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-transform">
                        {apply.isPending ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                        {apply.isPending ? "Submitting…" : "Apply for Loan"}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── PAST APPLICATIONS ── */}
                {!proposalType && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <DollarSign size={12} /> My Applications ({apps.length})
                    </p>
                    {isLoading ? (
                      <div className="text-center py-6"><Loader2 size={18} className="animate-spin text-primary mx-auto" /></div>
                    ) : apps.length === 0 ? (
                      <div className="bg-muted/50 rounded-2xl p-6 text-center">
                        <FileText size={28} className="text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">No applications yet.</p>
                        <p className="text-muted-foreground/60 text-xs mt-1">Choose a funding type above to get started.</p>
                      </div>
                    ) : apps.map(app => {
                      const cfg = statusConfig[app.status] ?? statusConfig.draft!;
                      const canRepay = ["approved", "disbursed"].includes(app.status);
                      const isInvestment = app.purpose === "investment_proposal";
                      return (
                        <div key={app.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                {isInvestment
                                  ? <Sprout size={12} className="text-primary" />
                                  : <Zap size={12} className="text-amber-500" />}
                                <p className="text-foreground font-bold text-base">{formatKES(app.amount)}</p>
                              </div>
                              <p className="text-muted-foreground text-xs">
                                {isInvestment ? "Crop Investment Proposal" : "Short-Term Loan"} · {app.repaymentPeriodMonths}mo
                              </p>
                              {app.cropType && <p className="text-green-600 text-[10px] font-medium mt-0.5">🌱 {app.cropType}</p>}
                            </div>
                            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                          </div>

                          {app.voucherCode && (
                            <div className="bg-gradient-to-r from-green-700 to-green-500 rounded-xl p-3 text-white">
                              <div className="flex items-center gap-2 mb-2">
                                <QrCode size={14} className="text-white/80" />
                                <p className="text-xs font-bold uppercase tracking-wider">Input Voucher</p>
                              </div>
                              <p className="font-mono text-lg font-bold tracking-widest">{app.voucherCode}</p>
                              <p className="text-white/70 text-[10px] mt-1">
                                Crop: {app.cropType} · Expires: {app.voucherExpiry ? new Date(app.voucherExpiry).toLocaleDateString("en-KE") : "—"}
                              </p>
                              <button onClick={() => copyCode(app.voucherCode!, app.id)}
                                className="mt-2 flex items-center gap-1.5 text-[10px] font-medium bg-white/20 px-2.5 py-1 rounded-lg">
                                {copiedId === app.id ? <Check size={10} /> : <Copy size={10} />}
                                {copiedId === app.id ? "Copied!" : "Copy Code"}
                              </button>
                            </div>
                          )}

                          <div className="bg-muted/50 rounded-xl p-2.5 flex justify-between text-xs">
                            <div><p className="text-muted-foreground">Total + 8% Interest</p><p className="font-bold">{formatKES(app.amount * 1.08)}</p></div>
                            <div className="text-right"><p className="text-muted-foreground">Monthly est.</p><p className="font-bold">{formatKES(app.amount * 1.08 / app.repaymentPeriodMonths)}</p></div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
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
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <RepayModal open={repayOpen} onClose={() => setRepayOpen(false)} loan={repayLoan} />
    </>
  );
}
