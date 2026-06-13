import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, DollarSign, CheckCircle2, Loader2, Clock, FileText, QrCode, Copy, Check } from "lucide-react";
import { getToken, formatKES } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RepayModal } from "@/components/repay-modal";

type LoanApp = {
  id: number; amount: number; purpose: string; purposeDetails: string;
  repaymentPeriodMonths: number; status: string; submittedAt?: string; createdAt: string;
  voucherCode?: string; voucherExpiry?: string; cropType?: string;
};

const PURPOSES = [
  { value: "seeds",      label: "🌱 Seeds & Planting Material" },
  { value: "fertilizer", label: "🧪 Fertilizer & Soil Amendment" },
  { value: "equipment",  label: "🚜 Farm Equipment & Tools" },
  { value: "irrigation", label: "💧 Irrigation System" },
  { value: "labour",     label: "👷 Labour Costs" },
  { value: "other",      label: "📋 Other Farm Expenses" },
];

const CROPS = ["Maize", "Coffee", "Tea", "Avocado", "Wheat", "Potatoes", "Tomatoes", "Cassava", "Sunflower", "Dairy", "Other"];

const statusConfig: Record<string, { label: string; color: string }> = {
  draft:        { label: "Draft",        color: "text-gray-600 bg-gray-100" },
  submitted:    { label: "Submitted",    color: "text-blue-600 bg-blue-100" },
  under_review: { label: "Under Review", color: "text-amber-600 bg-amber-100" },
  approved:     { label: "Approved",     color: "text-green-600 bg-green-100" },
  rejected:     { label: "Rejected",     color: "text-red-600 bg-red-100" },
  disbursed:    { label: "Disbursed",    color: "text-purple-600 bg-purple-100" },
};

interface LoanModalProps { open: boolean; onClose: () => void; }

export function LoanModal({ open, onClose }: LoanModalProps) {
  const qc = useQueryClient();
  const token = getToken();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("seeds");
  const [cropType, setCropType] = useState("Maize");
  const [purposeDetails, setPurposeDetails] = useState("");
  const [repayment, setRepayment] = useState(6);
  const [success, setSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [repayLoan, setRepayLoan] = useState<LoanApp | null>(null);
  const [repayOpen, setRepayOpen] = useState(false);

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
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loan-apps"] });
      setSuccess(true); setShowForm(false); setAmount("");
      setTimeout(() => setSuccess(false), 5000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    apply.mutate({ amount: parseFloat(amount), purpose, purposeDetails, repaymentPeriodMonths: repayment, cropType });
  };

  const copyCode = async (code: string, id: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const monthlyRepayment = amount ? (parseFloat(amount) * 1.08 / repayment) : 0;

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
              style={{ maxHeight: "92vh" }}>

              {/* Fixed header */}
              <div className="hero-header rounded-t-3xl px-5 pt-5 pb-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-white font-bold text-lg">Investment Application</h2>
                    <p className="text-white/70 text-xs">Farm Financing · Powered by Investa Farm</p>
                  </div>
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <X size={16} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4">
                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-green-700 text-sm font-semibold">Application submitted!</p>
                      <p className="text-green-600 text-xs mt-0.5">Review takes 2 business days. You'll be notified by email.</p>
                    </div>
                  </div>
                )}

                {/* How it works */}
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <DollarSign size={15} className="text-primary" /> How Farm Investment Works
                  </p>
                  <div className="space-y-1.5">
                    {["Apply as a registered farmer group", "Investa Farm lists your farm on the investor market", "Investors fund your loan by buying shares", "Repay from harvest proceeds via M-Pesa or card"].map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                        <span className="text-muted-foreground text-xs">{step.replace("loan", "investment").replace("Loan", "Investment")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!showForm && (
                  <button onClick={() => setShowForm(true)}
                    className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20">
                    <DollarSign size={16} /> Request Investment Capital
                  </button>
                )}

                {showForm && (
                  <form onSubmit={handleSubmit} className="bg-muted/30 border border-border rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">New Application</p>
                      <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground text-xs">Cancel</button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Capital Amount (KES)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={10000} placeholder="120000" required
                          className="w-full border border-border rounded-xl px-4 py-3 pl-12 text-foreground font-bold text-sm focus:outline-none focus:border-primary bg-white" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Crop Type</label>
                      <select value={cropType} onChange={e => setCropType(e.target.value)}
                        className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary">
                        {CROPS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Primary Purpose</label>
                      <div className="grid grid-cols-2 gap-2">
                        {PURPOSES.map(p => (
                          <button key={p.value} type="button" onClick={() => setPurpose(p.value)}
                            className={`text-left p-2.5 rounded-xl border text-xs transition-all ${purpose === p.value ? "border-primary bg-primary/10" : "border-border bg-white"}`}>
                            <span className={purpose === p.value ? "text-primary font-medium" : "text-foreground"}>{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Details</label>
                      <textarea value={purposeDetails} onChange={e => setPurposeDetails(e.target.value)} rows={2} required minLength={10}
                        placeholder="Describe how you'll use the funds…"
                        className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary resize-none" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Repayment Period</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[3, 6, 9, 12].map(m => (
                          <button key={m} type="button" onClick={() => setRepayment(m)}
                            className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${repayment === m ? "border-primary bg-primary text-white" : "border-border text-foreground bg-white"}`}>
                            {m}mo
                          </button>
                        ))}
                      </div>
                    </div>

                    {amount && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                        <div><p className="text-muted-foreground">Loan Amount</p><p className="font-bold">{formatKES(parseFloat(amount) || 0)}</p></div>
                        <div><p className="text-muted-foreground">Interest (8%)</p><p className="font-bold">{formatKES((parseFloat(amount) || 0) * 0.08)}</p></div>
                        <div><p className="text-muted-foreground">Total Owed</p><p className="font-bold">{formatKES((parseFloat(amount) || 0) * 1.08)}</p></div>
                        <div><p className="text-muted-foreground">Monthly (est.)</p><p className="font-bold">{formatKES(monthlyRepayment)}</p></div>
                      </div>
                    )}

                    <button type="submit" disabled={apply.isPending}
                      className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
                      {apply.isPending ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                      {apply.isPending ? "Submitting…" : "Submit Application"}
                    </button>
                  </form>
                )}

                {/* Applications list */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Applications ({apps.length})</p>
                  {isLoading ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">Loading…</div>
                  ) : apps.length === 0 ? (
                    <div className="bg-muted/50 rounded-2xl p-6 text-center">
                      <FileText size={28} className="text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No applications yet.</p>
                    </div>
                  ) : apps.map(app => {
                    const cfg = statusConfig[app.status] ?? statusConfig.draft;
                    const canRepay = ["approved", "disbursed"].includes(app.status);
                    return (
                      <div key={app.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-foreground font-bold text-base">{formatKES(app.amount)}</p>
                            <p className="text-muted-foreground text-xs mt-0.5">
                              {PURPOSES.find(p => p.value === app.purpose)?.label ?? app.purpose} · {app.repaymentPeriodMonths}mo
                            </p>
                            {app.cropType && <p className="text-green-600 text-[10px] font-medium mt-0.5">🌱 {app.cropType}</p>}
                          </div>
                          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        </div>

                        {/* Voucher card (on approval) */}
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
                          <div><p className="text-muted-foreground">Total + Interest (8%)</p><p className="font-bold">{formatKES(app.amount * 1.08)}</p></div>
                          <div className="text-right"><p className="text-muted-foreground">Monthly</p><p className="font-bold">{formatKES(app.amount * 1.08 / app.repaymentPeriodMonths)}</p></div>
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <RepayModal open={repayOpen} onClose={() => setRepayOpen(false)} loan={repayLoan} />
    </>
  );
}
