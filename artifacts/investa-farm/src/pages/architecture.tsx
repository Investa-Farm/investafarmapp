import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Database, Server, Globe, Smartphone, Shield, Zap, Users, Cpu, Cloud, ChevronDown, ChevronUp, Lock, RefreshCw } from "lucide-react";

const FADE = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function LayerCard({ layer, expanded, onToggle }: { layer: Layer; expanded: boolean; onToggle: () => void }) {
  return (
    <motion.div variants={FADE} className={`rounded-2xl border overflow-hidden ${layer.border} ${layer.bg}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${layer.iconBg}`}>
            <layer.Icon size={18} className={layer.iconColor} />
          </div>
          <div className="text-left">
            <p className={`font-black text-sm ${layer.titleColor}`}>{layer.title}</p>
            <p className="text-muted-foreground text-[11px]">{layer.subtitle}</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-2">
          {layer.items.map((item, i) => (
            <div key={i} className="bg-background/70 rounded-xl p-2.5 border border-white/60">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-base">{item.icon}</span>
                <p className="text-foreground text-xs font-bold leading-none">{item.name}</p>
              </div>
              <p className="text-muted-foreground text-[10px] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

type Layer = {
  title: string; subtitle: string; Icon: any;
  bg: string; border: string; iconBg: string; iconColor: string; titleColor: string;
  items: { icon: string; name: string; desc: string }[];
};

const LAYERS: Layer[] = [
  {
    title: "Client Layer", subtitle: "React PWA · Mobile-first",
    Icon: Smartphone, bg: "bg-violet-50", border: "border-violet-200",
    iconBg: "bg-violet-100", iconColor: "text-violet-600", titleColor: "text-violet-800",
    items: [
      { icon: "📈", name: "Investor View", desc: "Market, portfolio, P&L, wallet" },
      { icon: "👨‍🌾", name: "Farmer View", desc: "Dashboard, operations, funding" },
      { icon: "🤝", name: "Agribusiness", desc: "Network, orders, KYC portal" },
      { icon: "🏛️", name: "Admin Panel", desc: "Users, KYC, farms, dividends" },
    ],
  },
  {
    title: "API Gateway", subtitle: "Express 5 · TypeScript · OpenAPI",
    Icon: Server, bg: "bg-blue-50", border: "border-blue-200",
    iconBg: "bg-blue-100", iconColor: "text-blue-600", titleColor: "text-blue-800",
    items: [
      { icon: "🔐", name: "Auth Routes", desc: "/auth — login, OTP, MFA, TOTP" },
      { icon: "🏦", name: "Market Routes", desc: "/market — listings, buy, order book" },
      { icon: "💰", name: "Wallet Routes", desc: "/wallet — M-Pesa, Stripe, Circle" },
      { icon: "🌾", name: "Farmer Routes", desc: "/farmer — farms, updates, vouchers" },
      { icon: "📊", name: "Portfolio", desc: "/portfolio — holdings, ROI, exits" },
      { icon: "🛡️", name: "Security", desc: "Rate limit, nonce, bot block, CSP" },
    ],
  },
  {
    title: "Data Layer", subtitle: "PostgreSQL · Drizzle ORM",
    Icon: Database, bg: "bg-green-50", border: "border-green-200",
    iconBg: "bg-green-100", iconColor: "text-green-600", titleColor: "text-green-700",
    items: [
      { icon: "👥", name: "Users", desc: "Auth, roles, KYC status, wallets" },
      { icon: "🚜", name: "Farms", desc: "Listings, shares, funding progress" },
      { icon: "💼", name: "Investments", desc: "Holdings, exit plans, placements" },
      { icon: "📒", name: "Orders", desc: "Order book, matches, depth" },
      { icon: "💸", name: "Transactions", desc: "Wallet txns, fees, dividends" },
      { icon: "🔔", name: "Notifications", desc: "Push, in-app, price alerts" },
    ],
  },
  {
    title: "Scheduler", subtitle: "node-cron · Background Jobs",
    Icon: RefreshCw, bg: "bg-amber-50", border: "border-amber-200",
    iconBg: "bg-amber-100", iconColor: "text-amber-600", titleColor: "text-amber-800",
    items: [
      { icon: "📊", name: "Pricing Engine", desc: "DCF fair value every 5 min" },
      { icon: "🤖", name: "Order Matching", desc: "Buy/sell order engine every 2 min" },
      { icon: "🌧️", name: "Rainfall Alerts", desc: "Open-Meteo analysis at 6am EAT" },
      { icon: "🌾", name: "Dividends", desc: "Harvest payout at 2am EAT daily" },
      { icon: "📧", name: "Email Digest", desc: "Mon 8am & Fri 6pm EAT" },
      { icon: "📸", name: "ROI Snapshots", desc: "Daily AI ROI computation" },
    ],
  },
  {
    title: "External Services", subtitle: "Payments · AI · Satellite · Comms",
    Icon: Cloud, bg: "bg-rose-50", border: "border-rose-200",
    iconBg: "bg-rose-100", iconColor: "text-rose-600", titleColor: "text-rose-800",
    items: [
      { icon: "📱", name: "M-Pesa / Paystack", desc: "Safaricom STK push (KES)" },
      { icon: "💳", name: "Stripe", desc: "Global card payments (Visa/MC)" },
      { icon: "🔵", name: "Circle USDC", desc: "USDC stablecoin deposits" },
      { icon: "⭐", name: "Stellar", desc: "Custodial wallets (IFV-XXXX)" },
      { icon: "🤖", name: "Groq AI", desc: "Farm insights, news, ROI scoring" },
      { icon: "🛰️", name: "Sentinel Hub", desc: "NDVI satellite imagery" },
      { icon: "🌦️", name: "Open-Meteo", desc: "Real-time rainfall data" },
      { icon: "📨", name: "Resend / Brevo", desc: "Email + SMS notifications" },
    ],
  },
];

const FLOW_STEPS = [
  { step: "1", emoji: "📱", title: "User opens the PWA", desc: "React app loads, checks auth token in localStorage" },
  { step: "2", emoji: "🔑", title: "Authentication", desc: "Login → bcrypt verify → Base64 JWT issued → stored locally" },
  { step: "3", emoji: "🌿", title: "Browse farms", desc: "TanStack Query fetches /api/market → Express validates token → DB query → cached 30s" },
  { step: "4", emoji: "💰", title: "Invest", desc: "Buy → nonce check → Zod validate → deduct wallet balance → insert investment → emit notification" },
  { step: "5", emoji: "📊", title: "Portfolio value", desc: "DCF engine computes fair value per farm every 5 min using harvest revenue model" },
  { step: "6", emoji: "🌾", title: "Harvest / Exit", desc: "Admin triggers harvest → wallet.ts distributes 65% to investors → Stellar records transfer" },
];

const SECURITY_ITEMS = [
  { icon: "🔒", name: "Request Nonce", desc: "Every financial POST requires a unique nonce + timestamp header — blocks replay attacks" },
  { icon: "🚦", name: "Rate Limiting", desc: "200 req/min global; 10/15min on auth; 20/min on wallet ops per user" },
  { icon: "🤖", name: "Bot Detection", desc: "Headless browsers, known scrapers, and burst traffic blocked at middleware" },
  { icon: "📄", name: "Content Security", desc: "Strict CSP on API routes (default-src 'none'); permissive for frontend assets" },
  { icon: "🏦", name: "Account Lockout", desc: "Progressive back-off: 3 fails → 5 min, 6 → 1 hr, 10 → 24 hr lockout" },
  { icon: "🔐", name: "Input Sanitisation", desc: "HTML, null bytes, proto pollution stripped from every req.body and query" },
];

export default function SystemArchitecture() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"layers" | "flow" | "security">("layers");
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0, 1]));

  const toggle = (i: number) =>
    setExpanded(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background flex flex-col pb-10">
      {/* Header */}
      <div className="hero-header pt-12 pb-5 px-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setLocation("/profile")}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft size={14} className="text-white" />
          </button>
          <div>
            <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">Developer Docs</p>
            <h1 className="text-white font-extrabold text-xl">System Architecture</h1>
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-white/10 rounded-2xl">
          {(["layers", "flow", "security"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all capitalize ${tab === t ? "bg-white text-primary shadow" : "text-white/70"}`}>
              {t === "layers" ? "🏗 Layers" : t === "flow" ? "🔄 Data Flow" : "🛡 Security"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 space-y-3">
        {tab === "layers" && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Cpu size={13} className="text-primary" />
              <p className="text-muted-foreground text-xs font-semibold">Tap any layer to expand details</p>
            </div>
            <motion.div
              variants={{ show: { transition: { staggerChildren: 0.07 } } }}
              initial="hidden" animate="show"
              className="space-y-2.5"
            >
              {LAYERS.map((layer, i) => (
                <div key={i}>
                  <LayerCard layer={layer} expanded={expanded.has(i)} onToggle={() => toggle(i)} />
                  {i < LAYERS.length - 1 && (
                    <div className="flex justify-center my-1">
                      <div className="flex flex-col items-center gap-0.5">
                        {[0, 1, 2].map(j => (
                          <div key={j} className="w-0.5 h-1.5 rounded-full bg-border" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </motion.div>

            {/* Tech stack badges */}
            <div className="mt-4 bg-muted rounded-2xl p-4 border border-border">
              <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-3">Core Tech Stack</p>
              <div className="flex flex-wrap gap-1.5">
                {["React 19", "Vite 7", "Tailwind v4", "Express 5", "PostgreSQL", "Drizzle ORM", "TypeScript 5.9", "TanStack Query", "Framer Motion", "Recharts", "Zod v4", "Orval", "esbuild", "node-cron", "pnpm workspaces"].map(t => (
                  <span key={t} className="text-[10px] font-semibold bg-background border border-border rounded-lg px-2 py-0.5 text-foreground">{t}</span>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "flow" && (
          <motion.div
            variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            initial="hidden" animate="show"
            className="space-y-0"
          >
            <p className="text-muted-foreground text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Globe size={13} /> End-to-end investment flow
            </p>
            {FLOW_STEPS.map((s, i) => (
              <motion.div key={i} variants={FADE}>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/25">
                      <span className="text-white font-black text-xs">{s.step}</span>
                    </div>
                    {i < FLOW_STEPS.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1 min-h-[24px]" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-lg">{s.emoji}</span>
                      <p className="text-foreground font-bold text-sm">{s.title}</p>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Investment math */}
            <div className="mt-2 bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="text-green-800 font-black text-xs uppercase tracking-wider mb-3">💹 Investment Math</p>
              <div className="space-y-2">
                {[
                  { label: "Share Price", formula: "Loan Amount ÷ Total Shares" },
                  { label: "Platform Fee", formula: "1.5% of purchase value" },
                  { label: "Mid-Season ROI", formula: "~9.5% in 30–60 days (≈120% p.a.)" },
                  { label: "Full-Season ROI", formula: "~28% in ~6 months (≈62% p.a.)" },
                  { label: "DCF Fair Value", formula: "(Revenue × 0.65) ÷ (1 + 10.5%)^t" },
                ].map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <p className="text-green-700 text-[11px] font-semibold flex-shrink-0">{r.label}</p>
                    <p className="text-green-900 text-[11px] font-mono text-right">{r.formula}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Wallet flow */}
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-blue-800 font-black text-xs uppercase tracking-wider mb-3">💳 Payment Flows</p>
              <div className="space-y-1.5">
                {[
                  { icon: "📱", name: "M-Pesa", desc: "STK push → Paystack webhook → credit wallet" },
                  { icon: "💳", name: "Stripe", desc: "PaymentIntent → card element → confirm → credit" },
                  { icon: "🔵", name: "Circle USDC", desc: "Generate address → on-chain detect → credit KES equiv" },
                  { icon: "⭐", name: "Stellar", desc: "AES-256 keypair → custodial IFV-XXXX account" },
                ].map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">{p.icon}</span>
                    <div>
                      <p className="text-blue-800 font-bold text-xs">{p.name}</p>
                      <p className="text-blue-600 text-[10px]">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {tab === "security" && (
          <motion.div
            variants={{ show: { transition: { staggerChildren: 0.07 } } }}
            initial="hidden" animate="show"
            className="space-y-2.5"
          >
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
              <Shield size={18} className="text-red-600 flex-shrink-0" />
              <div>
                <p className="text-red-800 font-bold text-sm">Multi-layer Security Posture</p>
                <p className="text-red-600 text-xs">Server + Client + Transport protections</p>
              </div>
            </div>
            {SECURITY_ITEMS.map((item, i) => (
              <motion.div key={i} variants={FADE}
                className="bg-card rounded-2xl border border-border p-4 flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="text-foreground font-bold text-sm">{item.name}</p>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}

            {/* Auth flow */}
            <div className="bg-muted rounded-2xl p-4 border border-border">
              <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-3">🔑 Auth Architecture</p>
              <div className="space-y-2">
                {[
                  { k: "Password hashing", v: "bcrypt (cost 12)" },
                  { k: "Token format", v: "Base64 pseudo-JWT (userId+role)" },
                  { k: "Token storage", v: "localStorage (no cookies)" },
                  { k: "MFA support", v: "TOTP (otplib) + SMS OTP (Brevo)" },
                  { k: "Email verify", v: "6-digit OTP, 10-min expiry, AuthGuard blocks unverified" },
                  { k: "Session secret", v: "SESSION_SECRET env var (min 32 chars)" },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-start gap-2">
                    <p className="text-muted-foreground text-[11px]">{r.k}</p>
                    <p className="text-foreground text-[11px] font-mono font-semibold text-right">{r.v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-muted rounded-2xl p-4 border border-border">
              <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-3">🔒 Allowed Origins (SecurityGuard)</p>
              <div className="space-y-1">
                {["localhost", "app.investafarm.com", "investa-farm.onrender.com", "*.replit.dev", "*.replit.app"].map(o => (
                  <div key={o} className="flex items-center gap-2">
                    <Lock size={10} className="text-primary flex-shrink-0" />
                    <p className="text-foreground font-mono text-[11px]">{o}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
