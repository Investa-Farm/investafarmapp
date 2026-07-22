import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Users, Plus, TrendingUp, MapPin, Leaf, X, Loader2, CheckCircle2, ChevronRight, Shield } from "lucide-react";
import { getToken, getStoredUser, formatKES } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import { motion, AnimatePresence } from "framer-motion";

type Syndicate = {
  id: number; name: string; description?: string; location: string; county: string;
  cropFocus: string; memberCount: number; minMembers: number; maxMembers: number;
  fundingGoalKES: number; raisedKES: number; riskScore: number; isOpen: boolean;
  status: string; imageUrl?: string; agroDealer?: string; discountPct: number;
  leaderName: string; createdAt: string; fundingPct: number;
};

type MyMembership = { syndicateId: number; name: string; role: string; status: string; cropFocus: string; joinedAt: string };
type MyInvestment = { syndicateId: number; name: string; amountKES: number; sharesEquivalent: number; status: string; cropFocus: string; riskScore: number; createdAt: string };

const CROP_EMOJI: Record<string, string> = {
  coffee: "☕", maize: "🌽", tea: "🍵", avocado: "🥑", macadamia: "🌰",
  tomatoes: "🍅", rice: "🌾", sunflower: "🌻", beans: "🫘", wheat: "🌾", dairy: "🐄", poultry: "🐔",
};
function cropEmoji(c: string) {
  const k = c.toLowerCase();
  for (const [key, v] of Object.entries(CROP_EMOJI)) if (k.includes(key)) return v;
  return "🌱";
}

const COUNTIES = [
  "Nairobi","Kiambu","Nakuru","Meru","Kirinyaga","Laikipia","Kisumu","Uasin Gishu",
  "Trans Nzoia","Nyandarua","Nyeri","Murang'a","Embu","Machakos","Kajiado","Narok",
];

export default function SyndicatesPage() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const user  = getStoredUser() as any;
  const qc    = useQueryClient();
  const isFarmer = user?.role === "farmer" || user?.role === "cooperative";

  const [tab, setTab]           = useState<"browse" | "mine" | "invested">("browse");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [investModal, setInvestModal] = useState<Syndicate | null>(null);
  const [investAmount, setInvestAmount] = useState("");
  const [investError, setInvestError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", description: "", location: "", county: COUNTIES[0]!, cropFocus: "Maize",
    fundingGoalKES: "", minMembers: "5", maxMembers: "20", agroDealer: "", discountPct: "0",
  });

  const { data: syndicates = [], isLoading } = useQuery<Syndicate[]>({
    queryKey: ["syndicates"],
    queryFn: async () => {
      const r = await fetch("/api/syndicates", { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : [];
    },
    staleTime: 60_000,
  });

  const { data: myMemberships = [] } = useQuery<MyMembership[]>({
    queryKey: ["syndicates-my-memberships"],
    enabled: tab === "mine" && isFarmer,
    queryFn: async () => {
      const r = await fetch("/api/syndicates/my/memberships", { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : [];
    },
  });

  const { data: myInvestments = [] } = useQuery<MyInvestment[]>({
    queryKey: ["syndicates-my-investments"],
    enabled: tab === "invested" && !isFarmer,
    queryFn: async () => {
      const r = await fetch("/api/syndicates/my/investments", { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : [];
    },
  });

  const { data: detail } = useQuery({
    queryKey: ["syndicate-detail", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const r = await fetch(`/api/syndicates/${selectedId}`, { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : null;
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/syndicates/${id}/join`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to join");
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["syndicates"] });
      qc.invalidateQueries({ queryKey: ["syndicates-my-memberships"] });
      qc.invalidateQueries({ queryKey: ["syndicate-detail", selectedId] });
    },
  });

  const investMutation = useMutation({
    mutationFn: async ({ id, amountKES }: { id: number; amountKES: number }) => {
      const r = await fetch(`/api/syndicates/${id}/invest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountKES }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Investment failed");
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["syndicates"] });
      qc.invalidateQueries({ queryKey: ["syndicates-my-investments"] });
      setInvestModal(null);
      setInvestAmount("");
      setInvestError(null);
    },
    onError: (e: any) => setInvestError(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch("/api/syndicates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to create syndicate");
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["syndicates"] });
      setCreateOpen(false);
    },
  });

  const selected = selectedId ? syndicates.find(s => s.id === selectedId) : null;
  const isMember = detail?.members?.some((m: any) => m.userId === user?.id) ?? false;
  const isInvestor = detail?.investments?.some((i: any) => i.investorId === user?.id) ?? false;

  return (
    <div className="flex flex-col min-h-dvh bg-background max-w-[430px] mx-auto pb-24">

      {/* Header */}
      <div className="hero-header px-5 pt-12 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setLocation(isFarmer ? "/farmer" : "/market")}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-black text-xl tracking-tight">🤝 Farm Syndicates</h1>
            <p className="text-white/70 text-xs">Farmers unite · Investors fund · Everyone wins</p>
          </div>
          {isFarmer && (
            <button onClick={() => setCreateOpen(true)}
              className="bg-white/20 border border-white/30 rounded-xl px-3 py-2 flex items-center gap-1.5">
              <Plus size={14} className="text-white" />
              <span className="text-white text-xs font-bold">Create</span>
            </button>
          )}
        </div>
        <div className="bg-white/10 rounded-2xl p-3 grid grid-cols-3 gap-3 text-center">
          <div><p className="text-white/60 text-[10px]">Syndicates</p><p className="text-white font-black text-lg">{syndicates.length}</p></div>
          <div><p className="text-white/60 text-[10px]">Total Raised</p><p className="text-white font-black text-lg">{formatKES(syndicates.reduce((s,x) => s + x.raisedKES, 0))}</p></div>
          <div><p className="text-white/60 text-[10px]">Open</p><p className="text-white font-black text-lg">{syndicates.filter(s => s.isOpen).length}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mx-4 mb-4 mt-2">
        <button onClick={() => setTab("browse")}
          className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${tab === "browse" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
          Browse
        </button>
        {isFarmer && (
          <button onClick={() => setTab("mine")}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${tab === "mine" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            My Groups
          </button>
        )}
        {!isFarmer && (
          <button onClick={() => setTab("invested")}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all ${tab === "invested" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            My Investments
          </button>
        )}
      </div>

      <div className="px-4 space-y-3">

        {/* Browse */}
        {tab === "browse" && (
          isLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
          ) : syndicates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🤝</div>
              <p className="font-bold text-foreground mb-1">No syndicates yet</p>
              <p className="text-sm text-muted-foreground">
                {isFarmer ? "Create the first farmer syndicate to pool resources!" : "Check back soon — farmers are forming syndicates."}
              </p>
              {isFarmer && (
                <button onClick={() => setCreateOpen(true)} className="mt-4 bg-primary text-white rounded-xl px-6 py-2.5 text-sm font-bold">
                  Create Syndicate
                </button>
              )}
            </div>
          ) : syndicates.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3.5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
                    {cropEmoji(s.cropFocus)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <p className="font-bold text-foreground text-sm">{s.name}</p>
                      {!s.isOpen && <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Full</span>}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MapPin size={9} /><span>{s.county}</span>
                      <span className="mx-1">·</span>
                      <Users size={9} /><span>{s.memberCount}/{s.maxMembers} farmers</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Risk</p>
                    <p className={`text-xs font-black ${s.riskScore <= 3 ? "text-green-600" : s.riskScore <= 6 ? "text-amber-600" : "text-red-500"}`}>
                      {s.riskScore <= 3 ? "Low" : s.riskScore <= 6 ? "Med" : "High"}
                    </p>
                  </div>
                </div>

                {/* Funding bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>{formatKES(s.raisedKES)} raised</span>
                    <span className="font-bold text-foreground">{s.fundingPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${s.fundingPct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Goal: {formatKES(s.fundingGoalKES)}</p>
                </div>

                {s.agroDealer && (
                  <div className="flex items-center gap-1.5 text-[10px] text-green-700 bg-green-50 rounded-lg px-2 py-1.5 mb-3">
                    <Shield size={10} /><span>Partner Agro-dealer: <strong>{s.agroDealer}</strong></span>
                    {s.discountPct > 0 && <span className="ml-auto font-bold">{s.discountPct}% off inputs</span>}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setSelectedId(s.id)}
                    className="flex-1 border border-border rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1">
                    <ChevronRight size={12} />Details
                  </button>
                  {!isFarmer && (
                    <button onClick={() => { setInvestModal(s); setInvestError(null); }}
                      disabled={!s.isOpen}
                      className="flex-1 bg-primary text-white rounded-xl py-2 text-xs font-bold disabled:opacity-40">
                      Fund Syndicate
                    </button>
                  )}
                  {isFarmer && s.isOpen && (
                    <button onClick={() => joinMutation.mutate(s.id)}
                      disabled={joinMutation.isPending}
                      className="flex-1 bg-primary text-white rounded-xl py-2 text-xs font-bold">
                      Join Syndicate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* My Groups (farmer) */}
        {tab === "mine" && isFarmer && (
          myMemberships.length === 0 ? (
            <div className="text-center py-12">
              <Users size={40} className="text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-bold text-foreground mb-1">Not in any syndicates</p>
              <p className="text-sm text-muted-foreground">Create or join a syndicate to pool inputs and access bulk pricing</p>
              <button onClick={() => setCreateOpen(true)} className="mt-4 bg-primary text-white rounded-xl px-6 py-2.5 text-sm font-bold">
                Create Syndicate
              </button>
            </div>
          ) : myMemberships.map(m => (
            <div key={m.syndicateId} className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-xl">{cropEmoji(m.cropFocus)}</div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-sm">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{m.role} · {m.cropFocus}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  m.status === "active" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {m.status}
                </span>
              </div>
            </div>
          ))
        )}

        {/* My Investments (investor) */}
        {tab === "invested" && !isFarmer && (
          myInvestments.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp size={40} className="text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-bold text-foreground mb-1">No syndicate investments yet</p>
              <p className="text-sm text-muted-foreground">Browse and fund a farmer syndicate to diversify your portfolio</p>
            </div>
          ) : myInvestments.map(inv => (
            <div key={inv.syndicateId} className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-xl">{cropEmoji(inv.cropFocus)}</div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-sm">{inv.name}</p>
                  <p className="text-[10px] text-muted-foreground">{inv.cropFocus}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  inv.status === "active" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {inv.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-muted rounded-xl p-2.5 text-center">
                  <p className="text-[9px] text-muted-foreground">Invested</p>
                  <p className="text-xs font-black text-foreground">{formatKES(inv.amountKES)}</p>
                </div>
                <div className="bg-muted rounded-xl p-2.5 text-center">
                  <p className="text-[9px] text-muted-foreground">Shares</p>
                  <p className="text-xs font-black text-foreground">{inv.sharesEquivalent}</p>
                </div>
                <div className="bg-muted rounded-xl p-2.5 text-center">
                  <p className="text-[9px] text-muted-foreground">Risk</p>
                  <p className={`text-xs font-black ${inv.riskScore <= 3 ? "text-green-600" : inv.riskScore <= 6 ? "text-amber-600" : "text-red-500"}`}>
                    {inv.riskScore <= 3 ? "Low" : inv.riskScore <= 6 ? "Med" : "High"}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Syndicate Detail Sheet */}
      <AnimatePresence>
        {selectedId && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedId(null)} />
            <motion.div className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl" style={{ maxHeight: "85vh" }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
                <h3 className="font-black text-lg text-foreground">{selected?.name}</h3>
                <button onClick={() => setSelectedId(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-4 space-y-4">
                {selected && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["Funding Goal", formatKES(selected.fundingGoalKES)],
                        ["Raised", formatKES(selected.raisedKES)],
                        ["Members", `${selected.memberCount}/${selected.maxMembers}`],
                        ["Min Members", selected.minMembers.toString()],
                        ["Crop Focus", selected.cropFocus],
                        ["Location", selected.county],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-muted rounded-xl p-3">
                          <p className="text-[9px] text-muted-foreground font-semibold">{label}</p>
                          <p className="text-sm font-black text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                    {selected.description && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">About</p>
                        <p className="text-sm text-foreground leading-relaxed">{selected.description}</p>
                      </div>
                    )}
                    {detail?.members?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Members ({detail.members.length})</p>
                        {detail.members.slice(0, 5).map((m: any) => (
                          <div key={m.userId} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm">{m.name[0]?.toUpperCase()}</div>
                            <p className="text-sm text-foreground flex-1">{m.name}</p>
                            <span className="text-[9px] font-semibold text-muted-foreground capitalize">{m.role}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {isFarmer && selected.isOpen && !isMember && (
                        <button onClick={() => { joinMutation.mutate(selected.id); setSelectedId(null); }}
                          disabled={joinMutation.isPending}
                          className="flex-1 bg-primary text-white rounded-2xl py-3 font-bold text-sm">
                          Join Syndicate
                        </button>
                      )}
                      {isMember && (
                        <div className="flex-1 bg-green-50 border border-green-200 rounded-2xl py-3 flex items-center justify-center gap-1.5">
                          <CheckCircle2 size={14} className="text-green-600" />
                          <span className="text-green-700 font-bold text-sm">You're a Member</span>
                        </div>
                      )}
                      {!isFarmer && selected.isOpen && !isInvestor && (
                        <button onClick={() => { setInvestModal(selected); setSelectedId(null); setInvestError(null); }}
                          className="flex-1 bg-primary text-white rounded-2xl py-3 font-bold text-sm">
                          Fund Syndicate
                        </button>
                      )}
                      {!isFarmer && isInvestor && (
                        <div className="flex-1 bg-green-50 border border-green-200 rounded-2xl py-3 flex items-center justify-center gap-1.5">
                          <CheckCircle2 size={14} className="text-green-600" />
                          <span className="text-green-700 font-bold text-sm">You've Invested</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invest Modal */}
      <AnimatePresence>
        {investModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setInvestModal(null)} />
            <motion.div className="relative w-full max-w-[430px] bg-white rounded-t-3xl p-6 shadow-2xl"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-lg text-foreground">Fund Syndicate</h3>
                  <p className="text-xs text-muted-foreground">{investModal.name} · {investModal.cropFocus}</p>
                </div>
                <button onClick={() => setInvestModal(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X size={14} /></button>
              </div>

              <div className="bg-muted rounded-2xl p-3 mb-4 grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-muted-foreground">Raised so far</p><p className="font-bold text-foreground">{formatKES(investModal.raisedKES)}</p></div>
                <div><p className="text-muted-foreground">Goal</p><p className="font-bold text-foreground">{formatKES(investModal.fundingGoalKES)}</p></div>
                <div><p className="text-muted-foreground">Farmers</p><p className="font-bold text-foreground">{investModal.memberCount}</p></div>
                {investModal.discountPct > 0 && (
                  <div><p className="text-muted-foreground">Input discount</p><p className="font-bold text-green-600">{investModal.discountPct}% off</p></div>
                )}
              </div>

              <div className="space-y-1.5 mb-4">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Investment Amount (KES)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">KES</span>
                  <input type="number" value={investAmount} onChange={e => setInvestAmount(e.target.value)}
                    placeholder="e.g. 10,000"
                    className="w-full border border-border rounded-xl px-4 py-3 pl-12 font-bold text-sm focus:outline-none focus:border-primary" />
                </div>
                <p className="text-[10px] text-muted-foreground">Minimum KES 1,000 · You receive 1 share per KES 100</p>
              </div>

              {investAmount && parseFloat(investAmount) >= 1000 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-muted-foreground">You invest</p><p className="font-bold text-foreground">{formatKES(parseFloat(investAmount))}</p></div>
                  <div><p className="text-muted-foreground">Shares received</p><p className="font-bold text-primary">{Math.floor(parseFloat(investAmount) / 100)}</p></div>
                </div>
              )}

              {investError && <p className="text-red-500 text-xs text-center mb-3">{investError}</p>}

              <button
                onClick={() => {
                  const a = parseFloat(investAmount);
                  if (!a || a < 1000) { setInvestError("Minimum investment is KES 1,000"); return; }
                  investMutation.mutate({ id: investModal.id, amountKES: a });
                }}
                disabled={investMutation.isPending || !investAmount || parseFloat(investAmount) < 1000}
                className="w-full bg-primary text-white rounded-2xl py-3.5 font-black text-base disabled:opacity-40 flex items-center justify-center gap-2">
                {investMutation.isPending && <Loader2 size={18} className="animate-spin" />}
                Fund {investAmount && parseFloat(investAmount) >= 1000 ? formatKES(parseFloat(investAmount)) : "Syndicate"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Syndicate Modal (farmers only) */}
      <AnimatePresence>
        {createOpen && isFarmer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCreateOpen(false)} />
            <motion.div className="relative w-full max-w-[430px] bg-white rounded-3xl shadow-2xl flex flex-col" style={{ maxHeight: "90vh" }}
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}>
              <div className="hero-header rounded-t-3xl px-5 pt-5 pb-4 flex-shrink-0 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-black text-lg">Create Syndicate</h2>
                  <p className="text-white/70 text-xs">Form a farmer group for bulk inputs & joint funding</p>
                </div>
                <button onClick={() => setCreateOpen(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <X size={16} className="text-white" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Syndicate Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Kirinyaga Coffee Growers Alliance"
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Crop Focus *</label>
                  <select value={form.cropFocus} onChange={e => setForm(f => ({ ...f, cropFocus: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary">
                    {["Maize","Coffee","Tea","Avocado","Wheat","Tomatoes","Rice","Beans","Dairy","Poultry","Macadamia","Other"].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">County *</label>
                    <select value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary">
                      {COUNTIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Village/Area *</label>
                    <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Sagana"
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Funding Goal (KES) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">KES</span>
                    <input type="number" value={form.fundingGoalKES} onChange={e => setForm(f => ({ ...f, fundingGoalKES: e.target.value }))}
                      placeholder="500,000"
                      className="w-full border border-border rounded-xl px-4 py-3 pl-12 font-bold text-sm focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Min Members</label>
                    <input type="number" value={form.minMembers} onChange={e => setForm(f => ({ ...f, minMembers: e.target.value }))}
                      min={3} max={50}
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Max Members</label>
                    <input type="number" value={form.maxMembers} onChange={e => setForm(f => ({ ...f, maxMembers: e.target.value }))}
                      min={5} max={100}
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Partner Agro-dealer (optional)</label>
                  <input value={form.agroDealer} onChange={e => setForm(f => ({ ...f, agroDealer: e.target.value }))}
                    placeholder="e.g. Twiga Foods, MEA Fertilizers"
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Input Discount % (bulk purchase benefit)</label>
                  <input type="number" value={form.discountPct} onChange={e => setForm(f => ({ ...f, discountPct: e.target.value }))}
                    min={0} max={50}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3} placeholder="Describe your group's goals, farming region, and what you're looking to achieve…"
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary resize-none" />
                </div>
                <button
                  onClick={() => {
                    if (!form.name || !form.location || !form.fundingGoalKES) return;
                    createMutation.mutate({
                      name: form.name, description: form.description || undefined,
                      location: form.location, county: form.county, cropFocus: form.cropFocus,
                      fundingGoalKES: parseFloat(form.fundingGoalKES),
                      minMembers: parseInt(form.minMembers), maxMembers: parseInt(form.maxMembers),
                      agroDealer: form.agroDealer || undefined, discountPct: parseFloat(form.discountPct),
                    });
                  }}
                  disabled={createMutation.isPending || !form.name || !form.location || !form.fundingGoalKES}
                  className="w-full bg-primary text-white rounded-2xl py-3.5 font-black text-base disabled:opacity-40 flex items-center justify-center gap-2">
                  {createMutation.isPending && <Loader2 size={18} className="animate-spin" />}
                  Launch Syndicate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 z-30 max-w-[430px] mx-auto">
        <BottomNav role={isFarmer ? "farmer" : "investor"} />
      </div>
    </div>
  );
}
