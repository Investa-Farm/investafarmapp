import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Eye, EyeOff, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: code }),
      });
      const data = await r.json();
      if (r.ok) {
        sessionStorage.setItem("admin_auth", "1");
        sessionStorage.setItem("admin_token", data.token);
        setLocation("/admin/dashboard");
      } else {
        setError(data.error ?? "Invalid admin code.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto flex flex-col"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #16a34a 100%)" }}>
      <div className="pt-14 pb-8 px-6 flex flex-col items-center gap-4">
        <button onClick={() => setLocation("/")} className="self-start w-9 h-9 rounded-full bg-white/15 flex items-center justify-center mb-2">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}
          className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
          <Shield size={32} className="text-white" />
        </motion.div>
        <div className="text-center">
          <h1 className="text-white text-2xl font-bold">Admin Portal</h1>
          <p className="text-white/60 text-sm mt-1">Restricted Access · Investa Farm</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-12 shadow-2xl">
        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>
          )}
          <div className="space-y-1.5">
            <label className="text-foreground/60 text-xs font-semibold uppercase tracking-wider">Admin Access Code</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type={show ? "text" : "password"} value={code} onChange={e => setCode(e.target.value)}
                placeholder="Enter admin code" required
                className="w-full border border-border rounded-xl pl-10 pr-12 py-3 text-foreground bg-gray-50 text-sm focus:outline-none focus:border-green-500 focus:bg-white transition-colors" />
              <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-green-700 to-green-500 text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Authenticating…" : "Access Dashboard"}
          </button>
          <p className="text-center text-muted-foreground text-xs">Contact your Investa Farm system administrator for access.</p>
        </form>
      </div>
    </div>
  );
}
