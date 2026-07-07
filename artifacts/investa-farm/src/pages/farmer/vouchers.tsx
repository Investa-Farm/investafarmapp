import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToken, getStoredUser, formatKES } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";
import { useLocation } from "wouter";
import {
  ChevronLeft, Package, CheckCircle2, ShoppingCart, Plus, Minus,
  Truck, Loader2, X, Leaf, Zap, Droplets, Shield, Wrench,
} from "lucide-react";

const AGRI_CATALOG = [
  {
    id: "maize-seeds", category: "Seeds", name: "Certified Maize Seeds (5kg)",
    price: 1800, unit: "bag", icon: Leaf,
    desc: "H614D hybrid — drought-tolerant, 4.5T/acre yield",
    color: "bg-green-100 text-green-700", badge: "Best Seller",
  },
  {
    id: "tomato-seeds", category: "Seeds", name: "F1 Tomato Seeds (10g)",
    price: 650, unit: "sachet", icon: Leaf,
    desc: "Kilele F1 — disease resistant, 25T/acre yield",
    color: "bg-green-100 text-green-700", badge: null,
  },
  {
    id: "dap-fert", category: "Fertilizer", name: "DAP Fertilizer (50kg)",
    price: 3600, unit: "bag", icon: Zap,
    desc: "Di-ammonium phosphate — boosts root development",
    color: "bg-amber-100 text-amber-700", badge: "Popular",
  },
  {
    id: "cAN-fert", category: "Fertilizer", name: "CAN Fertilizer (50kg)",
    price: 3200, unit: "bag", icon: Zap,
    desc: "Calcium ammonium nitrate — top-dressing for maize",
    color: "bg-amber-100 text-amber-700", badge: null,
  },
  {
    id: "drip-kit", category: "Irrigation", name: "Drip Irrigation Kit (0.25ac)",
    price: 8500, unit: "kit", icon: Droplets,
    desc: "Includes pipes, emitters, header tank connector",
    color: "bg-blue-100 text-blue-700", badge: "Recommended",
  },
  {
    id: "fungicide", category: "Crop Protection", name: "Ridomil Gold Fungicide (1kg)",
    price: 1200, unit: "packet", icon: Shield,
    desc: "Controls late blight & downy mildew effectively",
    color: "bg-red-100 text-red-700", badge: null,
  },
  {
    id: "panga", category: "Tools", name: "Farm Panga + Hoe Set",
    price: 950, unit: "set", icon: Wrench,
    desc: "Carbon steel — heavy-duty for land preparation",
    color: "bg-gray-100 text-gray-700", badge: null,
  },
  {
    id: "knapsack", category: "Tools", name: "Knapsack Sprayer (16L)",
    price: 2400, unit: "unit", icon: Wrench,
    desc: "Manual pump — suitable for small to medium farms",
    color: "bg-gray-100 text-gray-700", badge: null,
  },
];

const CATEGORIES = ["All", "Seeds", "Fertilizer", "Irrigation", "Crop Protection", "Tools"];

type CartItem = { id: string; qty: number };

export default function FarmerVouchers() {
  const [, setLocation] = useLocation();
  const token = getToken();
  const user = getStoredUser();
  const qc = useQueryClient();

  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const { data: loans = [] } = useQuery<any[]>({
    queryKey: ["loan-apps"],
    queryFn: async () => {
      const r = await fetch("/api/loans/applications", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const disbursedLoan = loans.find((l: any) => l.status === "disbursed");
  const voucherCode = disbursedLoan?.voucherCode ?? `VCH-${user?.id ?? "000"}-2026`;
  const voucherBudget = disbursedLoan ? parseFloat(disbursedLoan.amount) * 0.4 : 15000;

  const cartTotal = cart.reduce((sum, item) => {
    const product = AGRI_CATALOG.find(p => p.id === item.id);
    return sum + (product?.price ?? 0) * item.qty;
  }, 0);

  const addToCart = (id: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === id);
      if (existing) return prev.map(c => c.id === id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === id);
      if (!existing || existing.qty <= 1) return prev.filter(c => c.id !== id);
      return prev.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c);
    });
  };

  const placeOrder = useMutation({
    mutationFn: async () => {
      await new Promise(r => setTimeout(r, 1500));
      return { ok: true };
    },
    onSuccess: () => {
      setCartOpen(false);
      setCart([]);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 5000);
    },
  });

  const filtered = activeCategory === "All"
    ? AGRI_CATALOG
    : AGRI_CATALOG.filter(p => p.category === activeCategory);

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 pt-10 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/farmer")}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <ChevronLeft size={18} className="text-foreground" />
          </button>
          <div>
            <h1 className="text-foreground font-bold text-base leading-tight">Order Agri-Inputs</h1>
            <p className="text-muted-foreground text-[10px]">Delivered to your farm within 3–5 days</p>
          </div>
        </div>
        <button onClick={() => setCartOpen(true)}
          className="relative w-9 h-9 rounded-full bg-primary flex items-center justify-center">
          <ShoppingCart size={16} className="text-white" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Voucher banner */}
        <div className="mx-4 mt-4 bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Package size={16} className="text-green-200" />
            <span className="text-green-100 text-[10px] font-bold uppercase tracking-wide">Agri-Input Voucher</span>
          </div>
          <p className="font-mono text-lg font-bold tracking-widest">{voucherCode}</p>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-green-100 text-[10px]">Available credit</p>
              <p className="text-white font-bold text-base">{formatKES(Math.max(0, voucherBudget - cartTotal))}</p>
            </div>
            <div className="text-right">
              <p className="text-green-100 text-[10px]">Total budget</p>
              <p className="text-white/80 text-sm font-semibold">{formatKES(voucherBudget)}</p>
            </div>
          </div>
          {cartTotal > 0 && (
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all"
                style={{ width: `${Math.min((cartTotal / voucherBudget) * 100, 100)}%` }} />
            </div>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 px-4 mt-4" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? "bg-primary text-white shadow-sm"
                  : "bg-muted text-muted-foreground"
              }`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 gap-3 px-4 mt-3">
          {filtered.map(product => {
            const Icon = product.icon;
            const inCart = cart.find(c => c.id === product.id);
            const qty = inCart?.qty ?? 0;
            return (
              <div key={product.id} className="bg-card border border-border rounded-2xl p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-1">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${product.color}`}>
                    <Icon size={16} />
                  </div>
                  {product.badge && (
                    <span className="text-[8px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{product.badge}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-foreground font-bold text-[11px] leading-tight">{product.name}</p>
                  <p className="text-muted-foreground text-[9px] mt-0.5 leading-snug">{product.desc}</p>
                </div>
                <div className="flex items-center justify-between gap-1 mt-auto">
                  <div>
                    <p className="text-primary font-bold text-sm">KES {product.price.toLocaleString()}</p>
                    <p className="text-muted-foreground text-[9px]">/{product.unit}</p>
                  </div>
                  {qty === 0 ? (
                    <button onClick={() => addToCart(product.id)}
                      className="w-7 h-7 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-all">
                      <Plus size={14} className="text-white" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => removeFromCart(product.id)}
                        className="w-6 h-6 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-all">
                        <Minus size={11} className="text-foreground" />
                      </button>
                      <span className="text-foreground font-bold text-sm w-4 text-center">{qty}</span>
                      <button onClick={() => addToCart(product.id)}
                        className="w-6 h-6 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-all">
                        <Plus size={11} className="text-white" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {cart.length > 0 && (
          <div className="px-4 mt-4">
            <button onClick={() => setCartOpen(true)}
              className="w-full bg-primary text-white rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
              <ShoppingCart size={16} />
              Review Order · {formatKES(cartTotal)}
            </button>
          </div>
        )}
      </div>

      {/* Cart bottom sheet */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-end"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
            <motion.div className="relative bg-background rounded-t-3xl w-full max-h-[80vh] flex flex-col"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
                <h2 className="font-bold text-base">Your Cart</h2>
                <button onClick={() => setCartOpen(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
                {cart.map(item => {
                  const product = AGRI_CATALOG.find(p => p.id === item.id)!;
                  return (
                    <div key={item.id} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${product.color}`}>
                        <product.icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-semibold text-xs truncate">{product.name}</p>
                        <p className="text-muted-foreground text-[10px]">KES {product.price.toLocaleString()} × {item.qty}</p>
                      </div>
                      <p className="text-primary font-bold text-sm">{formatKES(product.price * item.qty)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 pb-8 pt-3 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Total</span>
                  <span className="text-foreground font-bold text-lg">{formatKES(cartTotal)}</span>
                </div>
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                  <Truck size={14} className="text-green-600" />
                  <p className="text-green-700 text-xs">Delivery to your farm in 3–5 business days</p>
                </div>
                {cartTotal > voucherBudget ? (
                  <p className="text-red-500 text-xs text-center">Order exceeds your voucher budget of {formatKES(voucherBudget)}</p>
                ) : (
                  <button
                    onClick={() => placeOrder.mutate()}
                    disabled={placeOrder.isPending}
                    className="w-full bg-primary text-white rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60">
                    {placeOrder.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {placeOrder.isPending ? "Placing Order…" : "Confirm Order via Voucher"}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success toast */}
      <AnimatePresence>
        {orderSuccess && (
          <motion.div className="fixed bottom-24 left-4 right-4 z-50 bg-green-600 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
            <CheckCircle2 size={20} />
            <div>
              <p className="font-bold text-sm">Order Placed!</p>
              <p className="text-green-100 text-xs">Your agri-inputs will be delivered in 3–5 days</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav role="farmer" />
    </div>
  );
}
