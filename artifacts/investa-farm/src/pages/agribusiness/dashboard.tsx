import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getStoredUser, getToken, clearToken, formatKES } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { Bell, LogOut, Package, Handshake, TrendingUp, Users, ShieldCheck, ChevronRight, MapPin, Star, Copy, Check, Plus, Trash2, ExternalLink, Home, Share2, DollarSign, UserCircle, Briefcase } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";
import { NotificationsPanel } from "@/components/notifications-panel";
import { AppTour } from "@/components/app-tour";
import { motion, AnimatePresence } from "framer-motion";

type Product = { id: string; name: string; unit: string; price: number; category: string };

export default function AgribusinessDashboard() {
  const user = getStoredUser();
  const token = getToken();
  const [, setLocation] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"home" | "catalogue" | "referral" | "commissions" | "network">("home");
  const agribizType = (user as any)?.agribizType ?? localStorage.getItem("investa_agribiz_type") ?? "farmer_connector";
  const isInputSupplier = agribizType === "input_supplier";
  const isSalesAgent = agribizType === "sales_agent";

  // Catalogue state (persisted in localStorage)
  const [products, setProducts] = useState<Product[]>(() => {
    try { return JSON.parse(localStorage.getItem("investa_catalogue") ?? "[]"); } catch { return []; }
  });
  const [newProduct, setNewProduct] = useState({ name: "", unit: "kg", price: "", category: "Seeds" });
  const [addingProduct, setAddingProduct] = useState(false);

  // Referral state
  const [refCopied, setRefCopied] = useState(false);
  const refLink = `${window.location.origin}/register?ref=${user?.id ?? 0}&type=farmer&via=agribiz&partner=${encodeURIComponent(user?.name ?? "")}`;

  const copyRef = async () => {
    await navigator.clipboard.writeText(refLink).catch(() => {});
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 2000);
  };

  const saveProduct = () => {
    if (!newProduct.name || !newProduct.price) return;
    const p: Product = { id: Date.now().toString(), name: newProduct.name, unit: newProduct.unit, price: parseFloat(newProduct.price), category: newProduct.category };
    const updated = [...products, p];
    setProducts(updated);
    localStorage.setItem("investa_catalogue", JSON.stringify(updated));
    setNewProduct({ name: "", unit: "kg", price: "", category: "Seeds" });
    setAddingProduct(false);
  };

  const removeProduct = (id: string) => {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    localStorage.setItem("investa_catalogue", JSON.stringify(updated));
  };

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const { data: kycDocs = [] } = useQuery<any[]>({
    queryKey: ["kyc-docs"],
    queryFn: async () => {
      const r = await fetch("/api/kyc/documents", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const kycPending = kycDocs.filter((d: any) => d.status === "pending").length;
  const kycApproved = kycDocs.filter((d: any) => d.status === "approved").length;

  const { data: agribizStats, refetch: refetchStats } = useQuery<{
    pendingOrders: number; totalRedeemedKes: number; farmersConnected: number; commissionEarned: number;
  }>({
    queryKey: ["agribiz-stats"],
    queryFn: async () => {
      const r = await fetch("/api/agribusiness/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return { pendingOrders: 0, totalRedeemedKes: 0, farmersConnected: 0, commissionEarned: 0 };
      return r.json();
    },
    staleTime: 60_000,
    enabled: !!token,
  });

  const { data: commissions = [] } = useQuery<any[]>({
    queryKey: ["agribiz-commissions"],
    queryFn: async () => {
      const r = await fetch("/api/agribusiness/commissions", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !isInputSupplier && !!token,
    staleTime: 60_000,
  });

  const { data: myNetwork = [] } = useQuery<any[]>({
    queryKey: ["agribiz-network"],
    queryFn: async () => {
      const r = await fetch("/api/agribusiness/my-network", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !isInputSupplier && !!token,
    staleTime: 60_000,
  });

  return (
    <div className="app-shell pb-10 page-enter">
      {/* Header */}
      <div className="relative overflow-hidden" style={{ minHeight: 200 }}>
        <div className={`absolute inset-0 ${isInputSupplier ? "bg-gradient-to-br from-amber-800 via-orange-700 to-amber-600" : ""}`}
          style={isInputSupplier ? {} : { background: "linear-gradient(135deg, #052e16 0%, #14532d 40%, #16a34a 80%, #22c55e 100%)" }} />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='20' cy='20' r='2'/%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative z-10 pt-12 px-5">
          <div className="flex items-center justify-between">
            <img src={logoSrc} alt="Investa Farm" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            <div className="flex items-center gap-2">
              <button onClick={() => setNotifOpen(true)} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center relative">
                <Bell size={16} className="text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">{Math.min(unreadCount, 9)}</span>
                )}
              </button>
              <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <span className="text-white text-sm font-bold">{user?.name?.charAt(0) ?? "A"}</span>
              </div>
              <button onClick={() => { clearToken(); setLocation("/"); }} className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <LogOut size={14} className="text-white" />
              </button>
            </div>
          </div>
          <div className="mt-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isInputSupplier ? "bg-orange-500 text-white" : "bg-emerald-500 text-white"}`}>
                {isInputSupplier ? "Input Supplier" : "Farmer Connector"}
              </span>
            </div>
            <h1 className="text-white text-2xl font-bold">Welcome, {user?.name?.split(" ")[0] ?? "Partner"} 👋</h1>
            <p className="text-white/70 text-xs mt-0.5">
              {isInputSupplier ? "Manage voucher orders and supply to local farmers" : "Connect farmers to investment and support their growth"}
            </p>
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto border-b border-border sticky top-0 bg-background z-10">
        {(isInputSupplier
          ? [["home","Home"],["catalogue","Catalogue"],["commissions","Earnings"]] as const
          : [["home","Home"],["referral","Referral"],["commissions","Commissions"]] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setActiveSection(id as any)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeSection === id ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
            {label}
          </button>
        ))}
        {!isInputSupplier && (
          <Link href="/agribusiness/network">
            <button className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all bg-muted text-muted-foreground">
              Network
            </button>
          </Link>
        )}
        <Link href="/agribusiness/profile">
          <button className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all bg-muted text-muted-foreground">
            Profile
          </button>
        </Link>
      </div>

      <div className="px-5 pt-4 space-y-4">

        {/* ── HOME SECTION ── */}
        {activeSection === "home" && (
          <>
            {/* KYC Status */}
            {kycApproved < 2 && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-amber-800 font-bold text-sm">Complete Business KYC</p>
                  <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                    {kycPending > 0 ? "Your documents are under review. Our team will notify you within 24–48 hours." : "Upload your business documents to get verified and start operating on the platform."}
                  </p>
                  {kycPending === 0 && (
                    <Link href="/agribusiness/kyc">
                      <button className="mt-2 bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl w-full flex items-center justify-center gap-1.5">
                        <ShieldCheck size={13} /> Upload Documents →
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {isInputSupplier ? (
                <>
                  <div className="bg-card rounded-2xl border border-border p-3.5">
                    <p className="text-muted-foreground text-[10px]">Pending Orders</p>
                    <p className="text-foreground font-bold text-2xl mt-1">{agribizStats ? String(agribizStats.pendingOrders) : "—"}</p>
                    <p className="text-orange-500 text-[10px] font-medium mt-0.5">{agribizStats?.pendingOrders === 0 ? "All up to date" : "Awaiting fulfilment"}</p>
                  </div>
                  <div className="bg-card rounded-2xl border border-border p-3.5">
                    <p className="text-muted-foreground text-[10px]">Total Redeemed</p>
                    <p className="text-foreground font-bold text-xl mt-1">{agribizStats ? formatKES(agribizStats.totalRedeemedKes) : "—"}</p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">This season</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-card rounded-2xl border border-border p-3.5">
                    <p className="text-muted-foreground text-[10px]">Farmers Connected</p>
                    <p className="text-foreground font-bold text-2xl mt-1">{agribizStats ? String(agribizStats.farmersConnected) : "—"}</p>
                    <p className="text-green-500 text-[10px] font-medium mt-0.5">Unique farmers</p>
                  </div>
                  <div className="bg-card rounded-2xl border border-border p-3.5">
                    <p className="text-muted-foreground text-[10px]">Commission Earned</p>
                    <p className="text-foreground font-bold text-xl mt-1">{agribizStats ? formatKES(agribizStats.commissionEarned) : "—"}</p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">This season</p>
                  </div>
                </>
              )}
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">KYC Status</p>
                <p className={`font-bold text-sm mt-1 ${kycApproved >= 2 ? "text-green-600" : kycPending > 0 ? "text-blue-500" : "text-amber-600"}`}>
                  {kycApproved >= 2 ? "✓ Verified" : kycPending > 0 ? "Under Review" : "Pending"}
                </p>
                <p className="text-muted-foreground text-[10px] mt-0.5">{kycApproved}/{kycDocs.length} docs approved</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-3.5">
                <p className="text-muted-foreground text-[10px]">Platform Status</p>
                <p className="text-green-600 font-bold text-sm mt-1">Active</p>
                <p className="text-muted-foreground text-[10px] mt-0.5">Partner account</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <p className="font-semibold text-sm">Quick Actions</p>
              {isInputSupplier ? (
                <>
                  <Link href="/agribusiness/orders">
                    <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-98 transition-transform">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <Package size={20} className="text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Voucher Orders</p>
                        <p className="text-muted-foreground text-xs">View and fulfil incoming farmer voucher orders</p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </Link>
                  <button onClick={() => setActiveSection("catalogue")}
                    className="w-full flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-98 transition-transform text-left">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <TrendingUp size={20} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Catalogue & Pricing</p>
                      <p className="text-muted-foreground text-xs">{products.length} product{products.length !== 1 ? "s" : ""} listed · tap to manage</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                  <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <MapPin size={20} className="text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">My Business Location</p>
                      <p className="text-muted-foreground text-xs">{(user as any)?.county ?? "County not set"} · Kenya</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                </>
              ) : (
                <>
                  <button onClick={() => setActiveSection("referral")}
                    className="w-full flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-98 transition-transform text-left">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Handshake size={20} className="text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Refer a Farmer</p>
                      <p className="text-muted-foreground text-xs">Generate & share your referral link</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                  <Link href="/agribusiness/network">
                    <div className="flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-98 transition-transform">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Users size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">My Farmer Network</p>
                        <p className="text-muted-foreground text-xs">{myNetwork.length} farmer{myNetwork.length !== 1 ? "s" : ""} onboarded</p>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </Link>
                  <button onClick={() => setActiveSection("commissions")}
                    className="w-full flex items-center gap-3 bg-card rounded-2xl border border-border p-4 cursor-pointer active:scale-98 transition-transform text-left">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Star size={20} className="text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Commission History</p>
                      <p className="text-muted-foreground text-xs">{commissions.length} record{commissions.length !== 1 ? "s" : ""} · total {formatKES(agribizStats?.commissionEarned ?? 0)}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                </>
              )}
            </div>

            {/* How it works */}
            <div className={`rounded-2xl p-4 border ${isInputSupplier ? "bg-orange-50 border-orange-200" : "bg-emerald-50 border-emerald-200"}`}>
              <p className={`font-semibold text-sm mb-2 ${isInputSupplier ? "text-orange-800" : "text-emerald-800"}`}>
                {isInputSupplier ? "📦 How Input Vouchers Work" : "🤝 How Farmer Connecting Works"}
              </p>
              {isInputSupplier ? (
                <ul className="text-xs text-orange-700 space-y-1">
                  <li>1. Farmer receives funding and a voucher code is generated</li>
                  <li>2. You're assigned as their nearest verified input supplier</li>
                  <li>3. Farmer presents their voucher code at your business</li>
                  <li>4. You fulfil the order and mark it as redeemed</li>
                  <li>5. Payment is processed directly to your account</li>
                </ul>
              ) : (
                <ul className="text-xs text-emerald-700 space-y-1">
                  <li>1. Refer farmers in your area to the Investa Farm platform</li>
                  <li>2. Support them through KYC and funding application</li>
                  <li>3. Earn a commission when their farm gets funded by investors</li>
                  <li>4. Get ongoing commissions on future funding rounds</li>
                </ul>
              )}
            </div>
          </>
        )}

        {/* ── CATALOGUE SECTION (Input Suppliers) ── */}
        {activeSection === "catalogue" && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-bold text-base">Product Catalogue</p>
              <button onClick={() => setAddingProduct(!addingProduct)}
                className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-xs font-bold">
                <Plus size={13} /> Add Product
              </button>
            </div>

            <AnimatePresence>
              {addingProduct && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-border rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold">New Product</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Product Name</label>
                      <input type="text" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Certified Maize Seeds" className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Category</label>
                      <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}
                        className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white">
                        {["Seeds", "Fertilizer", "Pesticides", "Tools", "Equipment", "Other"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Unit</label>
                      <select value={newProduct.unit} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))}
                        className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white">
                        {["kg", "bag (50kg)", "litre", "piece", "box", "set"].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Price (KES per unit)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">KES</span>
                        <input type="number" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))}
                          placeholder="0" className="w-full border border-border rounded-xl pl-12 pr-4 py-2 text-sm focus:outline-none focus:border-primary" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setAddingProduct(false)} className="flex-1 border border-border text-foreground py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
                    <button onClick={saveProduct} disabled={!newProduct.name || !newProduct.price}
                      className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">Save Product</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {products.length === 0 ? (
              <div className="bg-white border border-border rounded-2xl p-8 text-center">
                <Package size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-semibold text-sm">No Products Listed</p>
                <p className="text-muted-foreground text-xs mt-1">Add your first product to start receiving orders from Investa-funded farmers.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="bg-white border border-border rounded-2xl p-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 text-lg">
                      {p.category === "Seeds" ? "🌱" : p.category === "Fertilizer" ? "💧" : p.category === "Pesticides" ? "🧪" : p.category === "Tools" ? "🔧" : "📦"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-semibold text-sm truncate">{p.name}</p>
                      <p className="text-muted-foreground text-xs">{p.category} · per {p.unit}</p>
                    </div>
                    <p className="text-foreground font-bold text-sm flex-shrink-0">{formatKES(p.price)}</p>
                    <button onClick={() => removeProduct(p.id)} className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                      <Trash2 size={13} className="text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-xs text-orange-700">
              <p className="font-semibold mb-1">💡 Pricing tips</p>
              <p>Competitive pricing helps farmers choose you. Farmers search by county so ensure your location is set correctly. Voucher payments are guaranteed — no bad debt.</p>
            </div>
          </>
        )}

        {/* ── REFERRAL SECTION (Farmer Connectors) ── */}
        {activeSection === "referral" && (
          <>
            <div className="bg-gradient-to-br from-[#052e16] to-[#166534] rounded-2xl p-4 text-white">
              <p className="font-bold text-sm mb-1">Your Referral Programme</p>
              <p className="text-white/70 text-xs">Earn a commission every time a farmer you refer gets funded on Investa Farm.</p>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4">
              <p className="text-sm font-semibold mb-3">Your Unique Referral Link</p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-border mb-3">
                <ExternalLink size={12} className="text-muted-foreground flex-shrink-0" />
                <p className="text-muted-foreground text-[10px] font-mono flex-1 truncate">{refLink}</p>
              </div>
              <button onClick={copyRef}
                className="w-full bg-primary text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95">
                {refCopied ? <Check size={15} /> : <Copy size={15} />}
                {refCopied ? "Copied to clipboard!" : "Copy Referral Link"}
              </button>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4">
              <p className="text-sm font-semibold mb-3">How Referral Commissions Work</p>
              <div className="space-y-3">
                {[
                  { step: "1", label: "Share your link", desc: "Send your referral link to farmers via WhatsApp, SMS or in-person" },
                  { step: "2", label: "Farmer registers", desc: "When they register using your link, they are automatically linked to your account" },
                  { step: "3", label: "Farmer gets funded", desc: "Once their farm is funded by investors on Investa Farm, you earn your commission" },
                  { step: "4", label: "Earn 2.5% commission", desc: "You receive 2.5% of every investment into farms you referred, paid to your wallet" },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{s.step}</span>
                    <div>
                      <p className="text-foreground text-sm font-semibold">{s.label}</p>
                      <p className="text-muted-foreground text-xs">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-center">
                <p className="text-emerald-700 font-bold text-xl">{myNetwork.length}</p>
                <p className="text-emerald-600 text-xs mt-0.5">Farmers Referred</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-center">
                <p className="text-emerald-700 font-bold text-base">{formatKES(agribizStats?.commissionEarned ?? 0)}</p>
                <p className="text-emerald-600 text-xs mt-0.5">Total Earned</p>
              </div>
            </div>
          </>
        )}

        {/* ── NETWORK SECTION (Farmer Connectors) ── */}
        {activeSection === "network" && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-bold text-base">My Farmer Network</p>
              <span className="text-xs text-muted-foreground">{myNetwork.length} farmers</span>
            </div>
            {myNetwork.length === 0 ? (
              <div className="bg-white border border-border rounded-2xl p-8 text-center">
                <Users size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-semibold text-sm">No Farmers Yet</p>
                <p className="text-muted-foreground text-xs mt-1 mb-4">Share your referral link to start building your farmer network.</p>
                <button onClick={() => setActiveSection("referral")}
                  className="bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-xl">
                  Get Referral Link
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {myNetwork.map((farmer: any) => (
                  <div key={farmer.id} className="bg-white border border-border rounded-2xl p-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-700 font-bold text-sm">{farmer.name?.charAt(0) ?? "F"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-semibold text-sm truncate">{farmer.name}</p>
                      <p className="text-muted-foreground text-xs">{farmer.county ?? "Kenya"} · {farmer.status ?? "Active"}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${farmer.funded ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {farmer.funded ? "Funded" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── COMMISSIONS SECTION ── */}
        {activeSection === "commissions" && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-3.5 text-white">
                <p className="text-white/80 text-xs">Total Earned</p>
                <p className="text-white font-bold text-xl mt-0.5">{formatKES(agribizStats?.commissionEarned ?? 0)}</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-3.5">
                <p className="text-muted-foreground text-xs">{isInputSupplier ? "Orders Filled" : "Farmers Funded"}</p>
                <p className="text-foreground font-bold text-xl mt-0.5">{isInputSupplier ? agribizStats?.pendingOrders ?? 0 : myNetwork.filter((f: any) => f.funded).length}</p>
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4">
              <p className="text-sm font-semibold mb-3">Commission History</p>
              {commissions.length === 0 ? (
                <div className="text-center py-8">
                  <Star size={28} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm font-medium">No commissions yet</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {isInputSupplier ? "Fulfilled voucher orders will appear here" : "Commissions are earned when your referred farmers get funded"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {commissions.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 bg-amber-50 rounded-xl p-3">
                      <span className="text-lg flex-shrink-0">💰</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-xs font-semibold truncate">{c.description ?? "Commission earned"}</p>
                        <p className="text-muted-foreground text-[10px]">{new Date(c.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      <p className="text-green-600 font-bold text-sm flex-shrink-0">+{formatKES(c.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>

      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <AppTour role="agribusiness" />

      {/* Sales Agent / Farmer Connector footer nav */}
      {(isSalesAgent || agribizType === "farmer_connector") && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border flex items-center justify-around px-2 pb-safe"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)", paddingTop: 8 }}>
          <button onClick={() => setActiveSection("home")}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${activeSection === "home" ? "text-primary" : "text-muted-foreground"}`}>
            <Home size={20} />
            <span className="text-[10px] font-semibold">Home</span>
          </button>
          <button onClick={() => setActiveSection("referral")}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${activeSection === "referral" ? "text-primary" : "text-muted-foreground"}`}>
            <Share2 size={20} />
            <span className="text-[10px] font-semibold">Refer</span>
          </button>
          <button onClick={() => setActiveSection("commissions")}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${activeSection === "commissions" ? "text-primary" : "text-muted-foreground"}`}>
            <DollarSign size={20} />
            <span className="text-[10px] font-semibold">Earnings</span>
          </button>
          <Link href="/agribusiness/network">
            <button className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all text-muted-foreground">
              <Users size={20} />
              <span className="text-[10px] font-semibold">Network</span>
            </button>
          </Link>
          <Link href="/agribusiness/profile">
            <button className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all text-muted-foreground">
              <UserCircle size={20} />
              <span className="text-[10px] font-semibold">Profile</span>
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
