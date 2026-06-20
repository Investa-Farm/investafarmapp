/**
 * HarvestPaymentModal — lets a farmer record an offtaker payment and
 * trigger the full revenue-distribution engine (Farmer 55% / Investors 20% / Platform 25%).
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wheat, ChevronRight, CheckCircle2, AlertCircle, DollarSign, Users, Building2 } from "lucide-react";
import { getToken } from "@/lib/auth";
import { formatKES } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

const FARMER_PCT   = 55;
const INVESTOR_PCT = 20;
const PLATFORM_PCT = 25;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

interface Farm {
  id: number;
  name: string;
  cropType: string;
  location: string;
  loanAmount: number;
  status: string;
}

export function HarvestPaymentModal({ open, onClose, onSuccess }: Props) {
  const token = getToken();
  const [step, setStep] = useState<"form" | "confirm" | "success" | "error">("form");
  const [farmId, setFarmId] = useState<number | "">("");
  const [revenue, setRevenue] = useState("");
  const [offtakerName, setOfftakerName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { data: farms = [] } = useQuery<Farm[]>({
    queryKey: ["my-farms"],
    queryFn: async () => {
      const r = await fetch("/api/farmer/farms", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: open,
  });

  const totalRevNum = Number(revenue) || 0;
  const farmerAmt   = Math.round(totalRevNum * FARMER_PCT   / 100 * 100) / 100;
  const investorAmt = Math.round(totalRevNum * INVESTOR_PCT / 100 * 100) / 100;
  const platformAmt = Math.round(totalRevNum * PLATFORM_PCT / 100 * 100) / 100;

  const canSubmit = farmId !== "" && totalRevNum > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const r = await fetch("/api/harvest/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          farmId,
          totalRevenue: totalRevNum,
          offtakerName: offtakerName || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Payment failed");
      setResult(data);
      setStep("success");
      onSuccess?.(data);
      import("@/components/transaction-notification").then(({ showCompletedTransactionFlow }) => {
        showCompletedTransactionFlow({ type: "harvest", amount: investorAmt, label: "Harvest Payout", subtitle: "Investor returns distributed" });
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep("form");
    setFarmId("");
    setRevenue("");
    setOfftakerName("");
    setNotes("");
    setResult(null);
    setErrorMsg("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative bg-background rounded-t-3xl w-full max-w-[430px] overflow-y-auto max-h-[92vh] pb-8"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-muted rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <Wheat size={18} className="text-green-700" />
                </div>
                <div>
                  <p className="font-bold text-base text-foreground">Record Harvest Payment</p>
                  <p className="text-muted-foreground text-[11px]">Offtaker paid for your produce</p>
                </div>
              </div>
              <button onClick={handleClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={15} />
              </button>
            </div>

            <div className="px-5 space-y-4">
              {/* ── SUCCESS ── */}
              {step === "success" && result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex flex-col items-center py-6 gap-3">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 size={32} className="text-green-600" />
                    </div>
                    <p className="font-bold text-xl text-foreground">Payment Distributed!</p>
                    <p className="text-muted-foreground text-sm text-center leading-relaxed">
                      Revenue has been split and credited to all stakeholders.
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Distribution Summary</p>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-base">👨‍🌾</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-foreground">Your Earnings (55%)</p>
                          <p className="text-[10px] text-muted-foreground">Credited to your wallet</p>
                        </div>
                        <p className="text-green-600 font-bold text-sm">{formatKES(result.breakdown?.farmerAmount ?? result.farmerPaid)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Users size={14} className="text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-foreground">Investor Pool (20%)</p>
                          <p className="text-[10px] text-muted-foreground">{result.investorsPaid ?? 0} investors paid pro-rata</p>
                        </div>
                        <p className="text-blue-600 font-bold text-sm">{formatKES(result.breakdown?.investorPool ?? 0)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-foreground">Platform (25%)</p>
                          <p className="text-[10px] text-muted-foreground">Investa Farm service fee</p>
                        </div>
                        <p className="text-purple-600 font-bold text-sm">{formatKES(result.breakdown?.platformAmount ?? result.platformTaken)}</p>
                      </div>
                    </div>
                    <div className="border-t border-border pt-2.5 flex justify-between items-center">
                      <p className="text-xs font-semibold text-foreground">Total Revenue</p>
                      <p className="font-bold text-foreground">{formatKES(result.breakdown?.totalRevenue ?? 0)}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleClose}
                    className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl active:scale-[0.98] transition-transform text-sm"
                  >
                    Done
                  </button>
                </motion.div>
              )}

              {/* ── ERROR ── */}
              {step === "error" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex flex-col items-center py-6 gap-3">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertCircle size={32} className="text-red-500" />
                    </div>
                    <p className="font-bold text-lg text-foreground">Payment Failed</p>
                    <p className="text-muted-foreground text-sm text-center">{errorMsg}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleClose} className="flex-1 py-3 border border-border rounded-2xl text-sm font-medium">Cancel</button>
                    <button onClick={() => setStep("form")} className="flex-1 py-3 bg-primary text-white rounded-2xl text-sm font-bold">Try Again</button>
                  </div>
                </motion.div>
              )}

              {/* ── CONFIRM ── */}
              {step === "confirm" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-amber-800 font-bold text-sm mb-1">Confirm Distribution</p>
                    <p className="text-amber-700 text-xs leading-relaxed">
                      This will immediately distribute <strong>{formatKES(totalRevNum)}</strong> to all stakeholders.
                      This action cannot be undone.
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-2xl p-4 space-y-2.5">
                    {[
                      { icon: "👨‍🌾", label: `You (${FARMER_PCT}%)`, amount: farmerAmt, color: "text-green-600" },
                      { icon: "👥", label: `Investors (${INVESTOR_PCT}%)`, amount: investorAmt, color: "text-blue-600" },
                      { icon: "🏛️", label: `Platform (${PLATFORM_PCT}%)`, amount: platformAmt, color: "text-purple-600" },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center">
                        <span className="text-xs text-foreground">{row.icon} {row.label}</span>
                        <span className={`text-xs font-bold ${row.color}`}>{formatKES(row.amount)}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="text-xs font-semibold text-foreground">Total</span>
                      <span className="text-xs font-bold text-foreground">{formatKES(totalRevNum)}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep("form")} className="flex-1 py-3 border border-border rounded-2xl text-sm font-medium">Back</button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 py-3 bg-green-600 text-white rounded-2xl text-sm font-bold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Distributing…</>
                      ) : (
                        <>Confirm &amp; Distribute <ChevronRight size={14} /></>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── FORM ── */}
              {step === "form" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Farm selector */}
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Select Farm *</label>
                    <select
                      value={farmId}
                      onChange={e => setFarmId(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Choose your farm…</option>
                      {farms.map(f => (
                        <option key={f.id} value={f.id}>{f.name} — {f.cropType}</option>
                      ))}
                    </select>
                  </div>

                  {/* Revenue amount */}
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Offtaker Payment Amount (KES) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">KES</span>
                      <input
                        type="number"
                        min="1"
                        value={revenue}
                        onChange={e => setRevenue(e.target.value)}
                        placeholder="e.g. 500,000"
                        className="w-full pl-14 pr-4 py-3 rounded-2xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  {/* Live breakdown */}
                  {totalRevNum > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="bg-muted/50 rounded-2xl p-4 space-y-2"
                    >
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Live Split Preview</p>
                      {[
                        { label: `👨‍🌾 You (${FARMER_PCT}%)`, amount: farmerAmt, color: "text-green-600" },
                        { label: `👥 Investors (${INVESTOR_PCT}%)`, amount: investorAmt, color: "text-blue-600" },
                        { label: `🏛️ Platform (${PLATFORM_PCT}%)`, amount: platformAmt, color: "text-purple-600" },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">{row.label}</span>
                          <span className={`text-xs font-bold ${row.color}`}>{formatKES(row.amount)}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {/* Offtaker name */}
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Offtaker / Buyer Name (optional)</label>
                    <input
                      type="text"
                      value={offtakerName}
                      onChange={e => setOfftakerName(e.target.value)}
                      placeholder="e.g. Naivas Supermarkets"
                      className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. 2.5 tonnes tomatoes, quality grade A"
                      rows={2}
                      className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>

                  {/* Info box */}
                  <div className="flex gap-2.5 bg-blue-50 border border-blue-100 rounded-2xl p-3">
                    <DollarSign size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-blue-700 text-[11px] leading-relaxed">
                      Funds are distributed instantly: <strong>55%</strong> to your wallet, <strong>20%</strong> split pro-rata
                      to all active investors, and <strong>25%</strong> to Investa Farm.
                    </p>
                  </div>

                  <button
                    onClick={() => setStep("confirm")}
                    disabled={!canSubmit}
                    className="w-full py-3.5 bg-green-600 text-white font-bold rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40 text-sm flex items-center justify-center gap-2"
                  >
                    Preview Distribution <ChevronRight size={15} />
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
