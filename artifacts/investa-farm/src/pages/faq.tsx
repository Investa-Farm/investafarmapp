import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, HelpCircle, ChevronDown, ChevronUp, Search, Send, Loader2, CheckCircle2, Clock, X, FileText, AlertCircle, Ticket, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredUser, getToken } from "@/lib/auth";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

const SUPPORT_EMAIL = "investafarm@proton.me";

const FAQS = [
  {
    category: "Returns & Earnings",
    items: [
      { q: "How do I earn returns on my investment?", a: "When you buy farm shares, you earn returns when the farmer exits (sells produce). You can choose a Mid-Season exit for +10% in 30–60 days, or a Full Season exit for up to +28% at harvest (~6 months)." },
      { q: "What is the minimum investment?", a: "The minimum investment is KES 5,000 (approximately 50 shares at KES 100/share). There is no maximum limit. You can diversify across multiple farms from a single account." },
      { q: "Can I sell my shares to other investors?", a: "Yes! The Secondary Market allows you to sell your shares to other investors before the season ends. Prices fluctuate based on market demand. Access it from the Market tab." },
    ],
  },
  {
    category: "Safety & Risk",
    items: [
      { q: "Is my investment guaranteed?", a: "Agricultural investments carry inherent risks including crop failure, weather events, and price fluctuations. Investa Farm mitigates risk through farm diversification, weather insurance partnerships, and KYC-verified farmers. Returns shown are projections based on historical performance." },
      { q: "What happens if a farm fails?", a: "Investa Farm maintains a Farmer Protection Fund equivalent to 5% of all active investments. In the event of a total crop failure, investors receive partial compensation. Partial failures are covered proportionally by crop insurance." },
      { q: "How are farmers verified?", a: "All farmers go through a 3-step verification: group registration (with at least 5 members), KYC document review (National ID + land documents), and a field visit by our agronomist team. Only verified farms are listed on the exchange." },
    ],
  },
  {
    category: "KYC & Identity",
    items: [
      { q: "What is KYC and why do I need it?", a: "KYC (Know Your Customer) is identity verification required by Kenyan financial law. You'll need to upload a National ID and proof of address. Once verified, you can buy shares, request exits, and receive payouts." },
      { q: "What documents are required for KYC?", a: "For individuals: National ID (front & back) and a utility bill or bank statement as proof of address. For businesses: Certificate of Incorporation, KRA PIN, and director IDs. Documents are reviewed within 1–3 business days." },
    ],
  },
  {
    category: "Withdrawals & Wallet",
    items: [
      { q: "How do I withdraw my money?", a: "Request an exit from your Portfolio page. Choose Mid-Season (30–60 days) or Full Season (~6 months). Once approved, funds are sent to your M-Pesa or bank account within 5 business days." },
      { q: "How does the Investa Wallet work?", a: "Your Investa Wallet is an internal KES balance that you can top up via M-Pesa and use to buy shares instantly without re-entering payment details. Withdraw your balance to M-Pesa or bank at any time." },
      { q: "Are there withdrawal fees?", a: "Investa Farm charges a 1.5% withdrawal fee on returns (not principal). M-Pesa standard transaction fees apply on the receiving end. There is no fee for depositing into your wallet." },
    ],
  },
  {
    category: "For Farmers",
    items: [
      { q: "How does funding work for farmers?", a: "After KYC verification and group registration (minimum 5 members), your farm is listed on the primary market. Investors buy shares which fund your operations. Repay from harvest proceeds and retain 55% of revenue." },
      { q: "What crops are supported?", a: "Currently we support maize, wheat, avocado, tea, coffee, tomatoes, potatoes, beans, dairy cattle, and more. Contact our team if your crop type isn't listed — we expand regularly." },
    ],
  },
  {
    category: "Support",
    items: [
      { q: "How do I contact support?", a: `Email us at ${SUPPORT_EMAIL} (Mon–Fri, 8am–6pm). You can also submit an in-app query using the 'Submit Query' tab below.` },
      { q: "Is my data secure?", a: "Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We are compliant with Kenya's Data Protection Act 2019. We never share your personal data with third parties without your consent." },
    ],
  },
];

const CATEGORIES = [
  { value: "payment", label: "💳 Payment Issue", desc: "M-Pesa / Card not reflecting" },
  { value: "kyc", label: "🪪 KYC / Identity", desc: "Document verification" },
  { value: "investment", label: "📈 Investment", desc: "Shares, portfolios, exits" },
  { value: "withdrawal", label: "💸 Withdrawal", desc: "Wallet or M-Pesa payouts" },
  { value: "technical", label: "⚙️ Technical", desc: "App crash, login issues" },
  { value: "other", label: "❓ Other", desc: "Anything else" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: JSX.Element }> = {
  open:        { label: "Open",        color: "text-blue-700",  bg: "bg-blue-50 border-blue-200",   icon: <Clock size={12} /> },
  in_progress: { label: "In Progress", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: <Loader2 size={12} className="animate-spin" /> },
  resolved:    { label: "Resolved",    color: "text-green-700", bg: "bg-green-50 border-green-200", icon: <CheckCircle2 size={12} /> },
  closed:      { label: "Closed",      color: "text-gray-600",  bg: "bg-gray-50 border-gray-200",   icon: <X size={12} /> },
};

const EMPTY_FORM = { category: "other", subject: "", description: "", mpesaRef: "", amountClaimed: "", paymentMethod: "" };

export default function FaqPage() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const token = getToken();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"faqs" | "submit" | "tickets">("submit");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);

  const backPath = user?.role === "farmer" ? "/farmer/profile" : "/profile";

  const filtered = search.trim().length > 1
    ? FAQS.map(cat => ({ ...cat, items: cat.items.filter(item => item.q.toLowerCase().includes(search.toLowerCase()) || item.a.toLowerCase().includes(search.toLowerCase())) })).filter(cat => cat.items.length > 0)
    : FAQS;

  const { data: myTickets = [] } = useQuery<any[]>({
    queryKey: ["support-tickets-mine"],
    queryFn: async () => {
      if (!token) return [];
      const r = await fetch("/api/support/tickets/mine", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!token && activeTab === "tickets",
    staleTime: 30_000,
  });

  const submitTicket = async () => {
    if (!form.subject.trim() || !form.description.trim()) return;
    if (!token) { setSubmitError("You must be logged in to submit a query. Please log in and try again."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category: form.category,
          subject: form.subject.trim(),
          description: form.description.trim(),
          mpesaRef: form.mpesaRef.trim() || undefined,
          amountClaimed: form.amountClaimed.trim() || undefined,
          paymentMethod: form.paymentMethod.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setSubmitted(data.ticketId);
        setForm(EMPTY_FORM);
        qc.invalidateQueries({ queryKey: ["support-tickets-mine"] });
      } else {
        setSubmitError(data.error ?? "Submission failed. Please try again or email us directly.");
      }
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isPayment = form.category === "payment";

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background pb-10">
      {/* Header */}
      <div className="hero-header pt-12 pb-4 px-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setLocation(backPath)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex-1">
            <p className="text-white/70 text-xs">Help Centre</p>
            <h1 className="text-white text-xl font-bold">Help & Support</h1>
          </div>
          <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto opacity-60" style={{ filter: "brightness(0) invert(1)" }} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/10 rounded-2xl p-1">
          {([
            { id: "submit",  label: "Submit Query",  icon: <Send size={13} /> },
            { id: "tickets", label: "My Tickets",    icon: <Ticket size={13} />, badge: myTickets.filter((t: any) => t.adminReply && t.status !== "closed").length },
            { id: "faqs",    label: "FAQs",         icon: <HelpCircle size={13} /> },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all relative ${
                activeTab === t.id ? "bg-white text-primary shadow-sm" : "text-white/70 hover:text-white"
              }`}>
              {t.icon} {t.label}
              {"badge" in t && t.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── FAQS TAB ── */}
        {activeTab === "faqs" && (
          <>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search questions…"
                className="w-full bg-card border border-border rounded-2xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <HelpCircle size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-semibold">No results found</p>
                <p className="text-muted-foreground text-sm mt-1">Try different terms or submit a query below</p>
                <button onClick={() => setActiveTab("submit")} className="mt-3 text-primary text-sm font-semibold underline">Submit a Query →</button>
              </div>
            ) : filtered.map(cat => (
              <div key={cat.category}>
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2 px-1">{cat.category}</p>
                <div className="space-y-2">
                  {cat.items.map((item, i) => {
                    const key = `${cat.category}-${i}`;
                    const isOpen = openItem === key;
                    return (
                      <div key={key} className="bg-card border border-border rounded-2xl overflow-hidden">
                        <button onClick={() => setOpenItem(isOpen ? null : key)} className="w-full flex items-center justify-between p-4 text-left">
                          <p className={`text-sm font-medium leading-snug pr-3 ${isOpen ? "text-primary" : "text-foreground"}`}>{item.q}</p>
                          {isOpen ? <ChevronUp size={16} className="text-primary flex-shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />}
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                              <div className="px-4 pb-4 pt-0">
                                <div className="w-full h-px bg-border mb-3" />
                                <p className="text-muted-foreground text-sm leading-relaxed">{item.a}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Contact card */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
              <p className="text-green-800 font-semibold text-sm mb-1">Still have questions?</p>
              <p className="text-green-600 text-xs mb-3">Submit an in-app query or email us directly.</p>
              <div className="space-y-1.5 text-xs text-green-700 mb-3">
                <p>📧 <a href={`mailto:${SUPPORT_EMAIL}`} className="underline font-semibold">{SUPPORT_EMAIL}</a></p>
                <p>🕐 Mon–Fri, 8am–6pm EAT</p>
              </div>
              <button onClick={() => setActiveTab("submit")}
                className="w-full bg-primary text-white text-sm font-bold py-2.5 rounded-xl active:scale-95 transition-transform">
                Submit a Query →
              </button>
            </div>
          </>
        )}

        {/* ── SUBMIT QUERY TAB ── */}
        {activeTab === "submit" && (
          <>
            {submitted ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="text-center py-10 px-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <h2 className="text-foreground font-bold text-lg mb-1">Query Submitted!</h2>
                <p className="text-muted-foreground text-sm mb-1">Ticket <span className="font-bold text-foreground">#{submitted}</span> received</p>
                <p className="text-muted-foreground text-xs mb-6">We'll respond within 24 hours (Mon–Fri). You'll get an email + in-app notification when we reply.</p>
                <div className="flex gap-2">
                  <button onClick={() => { setSubmitted(null); setActiveTab("tickets"); }}
                    className="flex-1 bg-primary text-white text-sm font-bold py-2.5 rounded-xl active:scale-95">
                    View My Tickets
                  </button>
                  <button onClick={() => setSubmitted(null)}
                    className="flex-1 bg-muted text-foreground text-sm font-bold py-2.5 rounded-xl active:scale-95">
                    Submit Another
                  </button>
                </div>
              </motion.div>
            ) : (
              <>
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-sky-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sky-800 font-semibold text-xs">Payment not reflected?</p>
                    <p className="text-sky-600 text-[11px] leading-relaxed mt-0.5">If you paid via M-Pesa or card and your wallet wasn't credited, select <strong>Payment Issue</strong> and include the M-Pesa reference code (e.g. UFTAE9OYR3). Our team will validate and credit your wallet within 24 hours.</p>
                  </div>
                </div>

                {/* Category picker */}
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(c => (
                      <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                        className={`text-left p-3 rounded-xl border transition-all active:scale-95 ${form.category === c.value ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-foreground"}`}>
                        <p className="font-bold text-xs">{c.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{c.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment details — only for payment category */}
                {isPayment && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-3">
                    <p className="text-amber-800 font-bold text-xs flex items-center gap-1.5"><AlertCircle size={13} /> Payment Details (Required)</p>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">M-Pesa / Transaction Reference</label>
                      <input type="text" value={form.mpesaRef} onChange={e => setForm(f => ({ ...f, mpesaRef: e.target.value.toUpperCase() }))}
                        placeholder="e.g. UFTAE9OYR3"
                        className="w-full border border-amber-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold bg-white focus:outline-none focus:border-amber-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Amount (KES)</label>
                        <input type="number" value={form.amountClaimed} onChange={e => setForm(f => ({ ...f, amountClaimed: e.target.value }))}
                          placeholder="e.g. 1000"
                          className="w-full border border-amber-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:border-amber-500" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Method</label>
                        <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                          className="w-full border border-amber-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-amber-500">
                          <option value="">Select…</option>
                          <option value="M-Pesa STK">M-Pesa STK</option>
                          <option value="M-Pesa Manual">M-Pesa Manual</option>
                          <option value="Card">Card (Visa/MC)</option>
                          <option value="USDC">USDC</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Subject</label>
                  <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Brief description of your issue"
                    className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-card focus:outline-none focus:border-primary" />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Details</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe your issue in detail. Include the date, time, and any error messages you saw."
                    rows={5}
                    className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm bg-card focus:outline-none focus:border-primary resize-none" />
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
                    <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-xs leading-relaxed">{submitError}</p>
                  </div>
                )}

                <button onClick={submitTicket} disabled={submitting || !form.subject.trim() || !form.description.trim()}
                  className="w-full bg-primary text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {submitting ? "Submitting…" : "Submit Query"}
                </button>

                <div className="text-center">
                  <p className="text-muted-foreground text-xs">We reply within 24 hours · Mon–Fri</p>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary text-xs font-semibold">{SUPPORT_EMAIL}</a>
                </div>
              </>
            )}
          </>
        )}

        {/* ── MY TICKETS TAB ── */}
        {activeTab === "tickets" && (
          <>
            {myTickets.length === 0 ? (
              <div className="text-center py-12">
                <Ticket size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-semibold text-sm">No tickets yet</p>
                <p className="text-muted-foreground text-xs mt-1 mb-4">Submit a query and we'll get back to you within 24 hours</p>
                <button onClick={() => setActiveTab("submit")} className="bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-xl active:scale-95">
                  Submit a Query
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myTickets.map((t: any) => {
                  const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.open;
                  const isOpen = expandedTicket === t.id;
                  const hasNewReply = t.adminReply && t.status !== "closed";
                  return (
                    <div key={t.id} className={`bg-card border rounded-2xl overflow-hidden transition-all ${hasNewReply ? "border-primary/30 shadow-sm shadow-green-100" : "border-border"}`}>
                      <button className="w-full px-4 py-3 text-left" onClick={() => setExpandedTicket(isOpen ? null : t.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-foreground font-bold text-xs">#{t.id}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.bg} ${cfg.color}`}>
                                {cfg.icon} {cfg.label}
                              </span>
                              {hasNewReply && !isOpen && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Reply received</span>
                              )}
                            </div>
                            <p className="text-foreground text-xs font-semibold mt-0.5 truncate">{t.subject}</p>
                            <p className="text-muted-foreground text-[10px] mt-0.5 capitalize">{t.category?.replace("_", " ")} · {new Date(t.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</p>
                          </div>
                          {isOpen ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0 mt-1" /> : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0 mt-1" />}
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                              {/* Your query */}
                              <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Your Query</p>
                                <p className="text-foreground text-xs leading-relaxed bg-gray-50 rounded-xl px-3 py-2.5">{t.description}</p>
                              </div>

                              {/* Payment details */}
                              {t.mpesaRef && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs space-y-1">
                                  <p className="font-bold text-amber-800">Payment Details</p>
                                  <p className="text-amber-700">Ref: <span className="font-mono font-bold">{t.mpesaRef}</span></p>
                                  {t.amountClaimed && <p className="text-amber-700">Amount: <strong>KES {Number(t.amountClaimed).toLocaleString("en-KE")}</strong></p>}
                                  {t.paymentMethod && <p className="text-amber-700">Method: {t.paymentMethod}</p>}
                                </div>
                              )}

                              {/* Admin reply */}
                              {t.adminReply ? (
                                <div>
                                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Support Response</p>
                                  <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                                    <p className="text-green-800 text-xs leading-relaxed">{t.adminReply}</p>
                                    <p className="text-green-600 text-[10px] mt-1.5">{t.adminRepliedAt ? new Date(t.adminRepliedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</p>
                                  </div>
                                  {t.walletCredited > 0 && (
                                    <div className="mt-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 flex items-center gap-2">
                                      <CheckCircle2 size={14} className="text-primary" />
                                      <p className="text-primary font-bold text-xs">KES {Number(t.walletCredited).toLocaleString("en-KE")} credited to your wallet</p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-2">
                                  <p className="text-muted-foreground text-xs">Awaiting response · we'll email you within 24 hours</p>
                                  <a href={`mailto:${SUPPORT_EMAIL}?subject=Ticket %23${t.id} — ${encodeURIComponent(t.subject)}`}
                                    className="text-primary text-xs font-semibold mt-1 block">
                                    Follow up via email →
                                  </a>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
