import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, DollarSign, CheckCircle2, Loader2, Clock, FileText } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { getToken, formatKES } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RepayModal } from "@/components/repay-modal";

type LoanApp = {
  id: number; amount: number; purpose: string; purposeDetails: string;
  repaymentPeriodMonths: number; status: string; submittedAt?: string; createdAt: string;
};

const PURPOSES = [
  { value: "seeds", label: "🌱 Seeds & Planting Material" },
  { value: "fertilizer", label: "🧪 Fertilizer & Soil Amendment" },
  { value: "equipment", label: "🚜 Farm Equipment & Tools" },
  { value: "irrigation", label: "💧 Irrigation System" },
  { value: "labour", label: "👷 Labour Costs" },
  { value: "other", label: "📋 Other Farm Expenses" },
];

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:        { label: "Draft",        cls: "badge-pending" },
  submitted:    { label: "Submitted",    cls: "badge-submitted" },
  under_review: { label: "Under Review", cls: "badge-submitted" },
  approved:     { label: "Approved",     cls: "badge-approved" },
  rejected:     { label: "Rejected",     cls: "badge-rejected" },
  disbursed:    { label: "Disbursed",    cls: "badge-approved" },
};

export default function LoanApply() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const token = getToken();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("seeds");
  const [purposeDetails, setPurposeDetails] = useState("");
  const [repayment, setRepayment] = useState(6);
  const [success, setSuccess] = useState(false);
  const [repayLoan, setRepayLoan] = useState<LoanApp | null>(null);
  const [repayOpen, setRepayOpen] = useState(false);
  const [kycWarning, setKycWarning] = useState(false);

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

  return (
    <div className="app-shell pb-20 page-enter" data-testid="loan-apply">
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/farmer")} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-white/80 text-xs">Farm Financing</p>
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

        {/* How it works */}
        <div className="green-card rounded-2xl p-4">
          <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <DollarSign size={16} className="text-primary" /> How Farm Funding Works
          </p>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            {[
              "Apply for funding as a registered farmer group",
              "Investa Farm lists your farm shares on the investor market",
              "Investors fund your farm by purchasing shares",
              "Repay from harvest proceeds via M-Pesa or card",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">{i+1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* KYC warning */}
        {kycWarning && !kycOk && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl flex-shrink-0">⚠️</span>
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
          <button onClick={() => { if (!kycOk) { setKycWarning(true); } else { setShowForm(true); setKycWarning(false); } }}
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
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1.5">
                <p className="text-green-700 text-xs font-semibold">Loan Summary</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Loan Amount</p><p className="font-bold">{formatKES(parseFloat(amount)||0)}</p></div>
                  <div><p className="text-muted-foreground">Interest (8%)</p><p className="font-bold">{formatKES((parseFloat(amount)||0)*0.08)}</p></div>
                  <div><p className="text-muted-foreground">Total Owed</p><p className="font-bold">{formatKES((parseFloat(amount)||0)*1.08)}</p></div>
                  <div><p className="text-muted-foreground">Monthly (est.)</p><p className="font-bold">{formatKES(monthlyRepayment)}</p></div>
                </div>
              </div>
            )}

            <button type="submit" disabled={apply.isPending}
              className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              {apply.isPending ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
              {apply.isPending ? "Submitting..." : "Submit Application"}
            </button>
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
                {/* Repayment breakdown */}
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
    </div>
  );
}
