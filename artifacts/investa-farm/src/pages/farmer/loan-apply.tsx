import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, DollarSign, CheckCircle2, Loader2, Clock, FileText, ChevronRight, ScrollText, Shield, BarChart3, Users, AlertCircle } from "lucide-react";
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
  { value: "seeds",      label: "🌱 Seeds & Planting Material" },
  { value: "fertilizer", label: "🧪 Fertilizer & Soil Amendment" },
  { value: "equipment",  label: "🚜 Farm Equipment & Tools" },
  { value: "irrigation", label: "💧 Irrigation System" },
  { value: "labour",     label: "👷 Labour Costs" },
  { value: "other",      label: "📋 Other Farm Expenses" },
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
  {
    icon: Shield,
    title: "1. Get Verified",
    body: "Upload your National ID and Farm Report for KYC approval. Takes 24–48 hours.",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: DollarSign,
    title: "2. Apply for Funding",
    body: "Choose how much you need (KES 10k–2M) and what it's for: seeds, equipment, irrigation, etc.",
    color: "text-primary",
    bg: "bg-primary/5",
  },
  {
    icon: Users,
    title: "3. Investors Fund Your Farm",
    body: "Your farm is listed on the investor market. Investors buy shares to fund your season.",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    icon: BarChart3,
    title: "4. Earn Your 55%",
    body: "After harvest, you keep 55% of gross revenue. Repay from proceeds, no upfront interest.",
    color: "text-green-600",
    bg: "bg-green-50",
  },
];

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

export default function LoanApply() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const token = getToken();

  const [showForm, setShowForm] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [agreedToContract, setAgreedToContract] = useState(false);
  const [contractScrolled, setContractScrolled] = useState(false);

  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("seeds");
  const [purposeDetails, setPurposeDetails] = useState("");
  const [repayment, setRepayment] = useState(6);
  const [success, setSuccess] = useState(false);
  const [repayLoan, setRepayLoan] = useState<LoanApp | null>(null);
  const [repayOpen, setRepayOpen] = useState(false);
  const [kycWarning, setKycWarning] = useState(false);

  const contractRef = useRef<HTMLDivElement>(null);

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
  const kycOk = kycApproved >= 2;

  const apply = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/loans/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loan-apps"] });
      setSuccess(true); setShowForm(false);
      setTimeout(() => setSuccess(false), 4000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    apply.mutate({ amount: parseFloat(amount), purpose, purposeDetails, repaymentPeriodMonths: repayment });
  };

  const monthlyRepayment = amount ? (parseFloat(amount) * 1.08 / repayment) : 0;

  const handleRepay = (loan: LoanApp) => {
    setRepayLoan(loan);
    setRepayOpen(true);
  };

  const handleApplyClick = () => {
    if (!kycOk) { setKycWarning(true); return; }
    setShowContract(true);
    setContractScrolled(false);
    setAgreedToContract(false);
  };

  const handleContractScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      setContractScrolled(true);
    }
  };

  const handleAgreeAndContinue = () => {
    setShowContract(false);
    setShowForm(true);
    setKycWarning(false);
  };

  return (
    <div className="app-shell pb-20 page-enter" data-testid="loan-apply">
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
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-600" />
            <p className="text-green-700 text-sm font-medium">Application submitted! We'll review within 2 business days.</p>
          </div>
        )}

        {/* How it Works — 4-step guide */}
        {!showForm && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">How it Works</p>
            <div className="grid grid-cols-2 gap-2">
              {GUIDE_STEPS.map((step) => {
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

            {/* Revenue split highlight */}
            <div className="bg-card border border-border rounded-2xl p-3.5">
              <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <BarChart3 size={13} className="text-primary" /> Revenue Split Preview
              </p>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-3 rounded-full overflow-hidden bg-muted flex">
                  <div className="h-full bg-primary rounded-l-full" style={{ width: "55%" }} />
                  <div className="h-full bg-amber-400" style={{ width: "44%" }} />
                  <div className="h-full bg-muted-foreground/30 rounded-r-full" style={{ width: "1%" }} />
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-primary rounded-sm" /><span className="text-foreground font-semibold">55% You</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-400 rounded-sm" /><span className="text-foreground font-semibold">44% Investors</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-muted-foreground/30 rounded-sm" /><span className="text-muted-foreground">1% Fee</span></div>
              </div>
              {amount && (
                <div className="mt-2.5 pt-2 border-t border-border flex justify-between text-xs">
                  <div>
                    <p className="text-muted-foreground">If you raise</p>
                    <p className="font-bold">{formatKES(parseFloat(amount)||0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Your 55% keeps</p>
                    <p className="font-bold text-primary">{formatKES(Math.round((parseFloat(amount)||0)*0.55))}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* KYC warning */}
        {kycWarning && !kycOk && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-orange-700 font-semibold text-sm">KYC Required</p>
              <p className="text-orange-600 text-xs mt-0.5">
                You need at least 2 approved KYC documents (Farm Report + National ID) before applying for funding.
              </p>
              <button onClick={() => setLocation("/farmer/kyc")} className="mt-2 text-xs font-bold text-orange-700 underline">
                Upload documents →
              </button>
            </div>
          </div>
        )}

        {!showForm && (
          <button onClick={handleApplyClick}
            data-testid="button-new-application"
            className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            <DollarSign size={16} /> Apply for Funding
          </button>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">New Application</p>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground text-xs">Cancel</button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Loan Amount (KES)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={10000} placeholder="e.g. 120000" required
                  className="w-full border border-border rounded-xl px-4 py-3 pl-12 text-foreground font-bold text-sm focus:outline-none focus:border-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary Purpose</label>
              <div className="grid grid-cols-2 gap-2">
                {PURPOSES.map(p => (
                  <button key={p.value} type="button" onClick={() => setPurpose(p.value)}
                    className={`text-left p-2.5 rounded-xl border text-xs transition-all ${purpose === p.value ? "border-primary bg-primary/10" : "border-border bg-background"}`}>
                    <span className={purpose === p.value ? "text-primary font-medium" : "text-foreground"}>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</label>
              <textarea value={purposeDetails} onChange={e => setPurposeDetails(e.target.value)} rows={3} required minLength={10}
                placeholder="Describe how you'll use the funds..."
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:border-primary resize-none" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Repayment Period</label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 6, 9, 12].map(m => (
                  <button key={m} type="button" onClick={() => setRepayment(m)}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${repayment === m ? "border-primary bg-primary text-white" : "border-border text-foreground"}`}>
                    {m}mo
                  </button>
                ))}
              </div>
            </div>

            {amount && (
              <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-1.5">
                <p className="text-foreground text-xs font-semibold">Loan Summary</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Loan Amount</p><p className="font-bold">{formatKES(parseFloat(amount)||0)}</p></div>
                  <div><p className="text-muted-foreground">Interest (8%)</p><p className="font-bold">{formatKES((parseFloat(amount)||0)*0.08)}</p></div>
                  <div><p className="text-muted-foreground">Total Owed</p><p className="font-bold">{formatKES((parseFloat(amount)||0)*1.08)}</p></div>
                  <div><p className="text-muted-foreground">Monthly (est.)</p><p className="font-bold">{formatKES(monthlyRepayment)}</p></div>
                </div>
              </div>
            )}

            {/* Contract agreed notice */}
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-2.5">
              <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
              <p className="text-green-700 text-[10px] font-medium">Production Agreement signed — 55% revenue split confirmed</p>
            </div>

            <button type="submit" disabled={apply.isPending}
              className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
              {apply.isPending ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
              {apply.isPending ? "Submitting..." : "Submit Application"}
            </button>
            {apply.isError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-red-600 flex-shrink-0" />
                <p className="text-red-700 text-xs font-medium">Submission failed. Check your details and try again.</p>
              </div>
            )}
          </form>
        )}

        {/* Applications list */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">My Applications ({apps.length})</p>
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
          ) : apps.length === 0 ? (
            <div className="bg-muted/50 rounded-2xl p-6 text-center">
              <FileText size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No applications yet.</p>
            </div>
          ) : apps.map(app => {
            const cfg = statusConfig[app.status] ?? statusConfig.draft;
            const canRepay = ["approved", "disbursed"].includes(app.status);
            return (
              <div key={app.id} data-testid={`loan-app-${app.id}`} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-foreground font-bold text-base">{formatKES(app.amount)}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {PURPOSES.find(p => p.value === app.purpose)?.label ?? app.purpose} · {app.repaymentPeriodMonths} months
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                </div>
                <p className="text-muted-foreground text-xs mt-2 line-clamp-2">{app.purposeDetails}</p>
                <div className="mt-2.5 bg-muted/50 rounded-xl p-2.5 flex justify-between text-xs">
                  <div>
                    <p className="text-muted-foreground">Principal + Interest (8%)</p>
                    <p className="font-bold text-foreground">{formatKES(app.amount * 1.08)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Monthly</p>
                    <p className="font-bold text-foreground">{formatKES(app.amount * 1.08 / app.repaymentPeriodMonths)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <Clock size={10} className="text-muted-foreground" />
                    <span className="text-muted-foreground text-[10px]">
                      {app.submittedAt ? `Submitted ${new Date(app.submittedAt).toLocaleDateString("en-KE")}` : new Date(app.createdAt).toLocaleDateString("en-KE")}
                    </span>
                  </div>
                  {canRepay && (
                    <button onClick={() => handleRepay(app)}
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

      {/* Contract Modal */}
      <AnimatePresence>
        {showContract && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowContract(false); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-card w-full max-w-[430px] rounded-t-3xl overflow-hidden"
              style={{ maxHeight: "90dvh" }}
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ScrollText size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">Production Funding Agreement</p>
                    <p className="text-muted-foreground text-[10px]">Read and accept before continuing</p>
                  </div>
                </div>
              </div>

              {/* Contract text — scrollable */}
              <div
                ref={contractRef}
                onScroll={handleContractScroll}
                className="overflow-y-auto px-5 py-4"
                style={{ maxHeight: "calc(90dvh - 200px)" }}
              >
                <pre className="text-xs text-foreground font-sans whitespace-pre-wrap leading-relaxed">
                  {CONTRACT_TEXT}
                </pre>
                {!contractScrolled && (
                  <div className="flex items-center justify-center gap-1.5 py-4 text-muted-foreground text-xs">
                    <ChevronRight size={12} className="rotate-90" /> Scroll to read full agreement
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-border space-y-3">
                <label className={`flex items-start gap-3 cursor-pointer ${contractScrolled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                  <div className="mt-0.5 flex-shrink-0">
                    <input type="checkbox" checked={agreedToContract} onChange={e => setAgreedToContract(e.target.checked)}
                      className="w-4 h-4 accent-primary cursor-pointer" />
                  </div>
                  <p className="text-xs text-foreground leading-snug">
                    I have read and agree to the Investa Farm Production Funding Agreement, including the 55/45 revenue split and monthly reporting obligations.
                  </p>
                </label>
                <button
                  onClick={handleAgreeAndContinue}
                  disabled={!agreedToContract}
                  className="w-full bg-primary text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
                >
                  <CheckCircle2 size={16} /> Accept & Continue to Application
                </button>
                <button onClick={() => setShowContract(false)} className="w-full text-muted-foreground text-xs py-1">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
