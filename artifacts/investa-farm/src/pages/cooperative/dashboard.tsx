import { useState } from "react";
import { useLocation } from "wouter";
import { Building2, Users, Code2, FileSpreadsheet, Plug, Copy, Check, ChevronRight, LogOut, BarChart3, Globe, Phone, Camera } from "lucide-react";
import { motion } from "framer-motion";
import { clearToken, getStoredUser } from "@/lib/auth";

const API_SNIPPET = `// Investa Farm REST API
fetch("https://api.investafarm.co.ke/v1/farmers", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
})
.then(r => r.json())
.then(farmers => console.log(farmers));`;

const EXCEL_SNIPPET = `=INVESTAFARM_FARMERS("YOUR_KEY","county=Nakuru")`;

const SERVICES = [
  { icon: "🌾", title: "Member Farmer Management", desc: "Onboard and manage farmer groups in your network", badge: "Active" },
  { icon: "💳", title: "Input Credit Facilitation", desc: "Connect farmers to input vouchers via Investa Farm loans", badge: "Active" },
  { icon: "📦", title: "Produce Aggregation", desc: "Receive and track produce from funded farms", badge: "Coming Soon" },
  { icon: "📊", title: "Data Analytics & Reports", desc: "Performance reports for your farmer network", badge: "Active" },
  { icon: "🔌", title: "API Integration", desc: "Embed Investa Farm data into your systems", badge: "Beta" },
  { icon: "🤝", title: "Co-financing Programs", desc: "Co-invest alongside Investa Farm on large farms", badge: "Coming Soon" },
];

const ORG_TYPE_IMAGES: Record<string, string> = {
  cooperative:  "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=200&q=80",
  distributor:  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=200&q=80",
  aggregator:   "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=200&q=80",
  agribusiness: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&q=80",
  financial:    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&q=80",
  ngo:          "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=200&q=80",
};

export default function CooperativeDashboard() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const [copiedSnippet, setCopiedSnippet] = useState<"rest" | "excel" | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "api" | "farmers">("overview");

  const handleLogout = () => { clearToken(); setLocation("/"); };

  const copy = async (text: string, type: "rest" | "excel") => {
    await navigator.clipboard.writeText(text);
    setCopiedSnippet(type);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const orgType = localStorage.getItem("investa_org_type") ?? "cooperative";
  const profileImage = ORG_TYPE_IMAGES[orgType] ?? ORG_TYPE_IMAGES.cooperative;

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-gray-50 pb-10">
      {/* Header */}
      <div className="hero-header rounded-b-3xl px-5 pt-12 pb-5 text-white overflow-hidden relative">

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            {/* Profile image card */}
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/30 shadow-lg">
                <img
                  src={profileImage}
                  alt="Organization"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                <Building2 size={9} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-white/70 text-xs">Partner Dashboard</p>
              <h1 className="text-white font-bold text-base leading-tight">{user?.name ?? "Partner"}</h1>
              <p className="text-white/50 text-[9px] capitalize">{orgType.replace(/_/g, " ")} · Verified Partner</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <LogOut size={15} className="text-white" />
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 relative z-10">
          {[
            { val: "—", label: "Farmers" },
            { val: "—", label: "Active Loans" },
            { val: "—", label: "Funded KES" },
          ].map(({ val, label }) => (
            <div key={label} className="bg-white/10 rounded-xl p-2.5 text-center border border-white/10">
              <p className="text-white font-bold text-sm">{val}</p>
              <p className="text-white/60 text-[9px]">{label}</p>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mt-3 bg-black/20 rounded-xl p-1 relative z-10">
          {(["overview", "api", "farmers"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold capitalize transition-all ${activeTab === t ? "bg-white text-foreground" : "text-white/70"}`}>
              {t === "api" ? "API / Plugin" : t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {activeTab === "overview" && (
          <>
            {/* Partnership notice */}
            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={15} className="text-primary" />
                <p className="text-sm font-semibold">Welcome to Investa Farm Partners</p>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                You are registered as a <strong>{user?.role ?? "partner"}</strong>. Use this dashboard to manage your farmer network, access loan facilitation, and integrate our data into your operations.
              </p>
            </div>

            {/* Org profile card */}
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <div className="relative h-28">
                <img src={profileImage} alt="Organization" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">{user?.name ?? "Your Organization"}</p>
                    <p className="text-white/70 text-[10px] capitalize">{orgType.replace(/_/g, " ")} · Kenya</p>
                  </div>
                  <button className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Camera size={13} className="text-white" />
                  </button>
                </div>
              </div>
              <div className="p-3 grid grid-cols-3 divide-x divide-border">
                {[
                  { label: "Network", val: "Partner" },
                  { label: "Status", val: "Active" },
                  { label: "Since", val: "2026" },
                ].map(({ label, val }) => (
                  <div key={label} className="text-center px-2">
                    <p className="text-foreground font-bold text-xs">{val}</p>
                    <p className="text-muted-foreground text-[9px]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Services grid */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Available Services</p>
              <div className="space-y-2">
                {SERVICES.map(svc => (
                  <motion.div key={svc.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl flex-shrink-0">
                      {svc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-semibold">{svc.title}</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{svc.desc}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${svc.badge === "Active" ? "bg-green-100 text-green-700" : svc.badge === "Beta" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                      {svc.badge}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="text-green-700 font-semibold text-sm mb-2">Get Onboarded</p>
              <p className="text-green-600 text-xs mb-3">Our partnership team will reach you within 24 hours to complete your onboarding and assign API credentials.</p>
              <div className="flex items-center gap-2 text-green-700 text-xs">
                <Phone size={12} /> <span>+254 700 000 000</span>
                <span className="text-green-400">·</span>
                <span>partners@investafarm.co.ke</span>
              </div>
            </div>
          </>
        )}

        {activeTab === "api" && (
          <>
            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Plug size={15} className="text-primary" />
                <p className="text-sm font-semibold">REST API Integration</p>
              </div>
              <p className="text-muted-foreground text-xs mb-3">Connect your systems directly to Investa Farm's farmer database, loans, and market data via our REST API.</p>
              <div className="bg-gray-900 rounded-xl p-3 relative">
                <pre className="text-green-400 text-[9px] font-mono leading-relaxed overflow-x-auto">{API_SNIPPET}</pre>
                <button onClick={() => copy(API_SNIPPET, "rest")}
                  className="absolute top-2 right-2 w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                  {copiedSnippet === "rest" ? <Check size={10} className="text-green-400" /> : <Copy size={10} className="text-white/60" />}
                </button>
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileSpreadsheet size={15} className="text-green-600" />
                <p className="text-sm font-semibold">Excel / Google Sheets Plugin</p>
                <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Beta</span>
              </div>
              <p className="text-muted-foreground text-xs mb-3">Pull live farmer data directly into your Excel or Google Sheets using our custom functions.</p>
              <div className="bg-gray-900 rounded-xl p-3 relative">
                <pre className="text-yellow-400 text-[10px] font-mono">{EXCEL_SNIPPET}</pre>
                <button onClick={() => copy(EXCEL_SNIPPET, "excel")}
                  className="absolute top-2 right-2 w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                  {copiedSnippet === "excel" ? <Check size={10} className="text-green-400" /> : <Copy size={10} className="text-white/60" />}
                </button>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {["Download the Investa Farm Excel Add-in from our partner portal", "Install in Excel via Insert → Add-ins → Upload My Add-in", "Enter your API key when prompted — data syncs automatically"].map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Code2 size={15} className="text-purple-600" />
                <p className="text-sm font-semibold">Available Endpoints</p>
              </div>
              <div className="space-y-2">
                {[
                  { method: "GET", path: "/v1/farmers", desc: "List all farmers in your network" },
                  { method: "GET", path: "/v1/farms", desc: "Farm details, crop, location, size" },
                  { method: "GET", path: "/v1/loans", desc: "Loan applications & status" },
                  { method: "GET", path: "/v1/vouchers", desc: "Input vouchers issued" },
                  { method: "POST", path: "/v1/webhooks", desc: "Receive event notifications" },
                ].map(ep => (
                  <div key={ep.path} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ep.method === "GET" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{ep.method}</span>
                    <code className="text-foreground text-[10px] font-mono flex-1">{ep.path}</code>
                    <span className="text-muted-foreground text-[9px]">{ep.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "farmers" && (
          <>
            <div className="bg-white border border-border rounded-2xl p-4 text-center py-10">
              <Users size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-semibold text-sm">No Farmers Linked Yet</p>
              <p className="text-muted-foreground text-xs mt-1 mb-4">Contact the Investa Farm team to link your farmer network to this partner account.</p>
              <button className="bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 mx-auto">
                <Phone size={14} /> Contact Partnership Team <ChevronRight size={14} />
              </button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={14} className="text-blue-600" />
                <p className="text-blue-700 text-xs font-semibold">Farmer Database Import</p>
              </div>
              <p className="text-blue-600 text-xs">Upload a CSV of your farmer members and we'll bulk-onboard them onto Investa Farm, with group KYC pre-filled from your records.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
