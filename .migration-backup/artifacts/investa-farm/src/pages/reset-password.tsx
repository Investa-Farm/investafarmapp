import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Lock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

export default function ResetPassword() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-sm w-full">
          <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
          <h2 className="font-bold text-foreground text-lg mb-2">Invalid Link</h2>
          <p className="text-muted-foreground text-sm mb-5">This password reset link is missing a token. Please request a new one.</p>
          <Link href="/forgot-password">
            <button className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm">Request New Link</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logoSrc} alt="Investa Farm" className="h-14 w-auto mb-2" />
          <p className="text-muted-foreground text-sm">Create a new password</p>
        </div>

        {done ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 size={40} className="text-green-600 mx-auto mb-3" />
            <h2 className="font-bold text-foreground text-lg mb-2">Password Updated!</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <Link href="/login">
              <button className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-transform">
                Sign In
              </button>
            </Link>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="font-bold text-foreground text-xl mb-1">New password</h2>
            <p className="text-muted-foreground text-sm mb-6">Choose a strong password for your account.</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">New Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              {password && confirm && password !== confirm && (
                <p className="text-red-500 text-xs">Passwords don't match</p>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirm || password !== confirm}
                className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Updating…</> : "Set New Password"}
              </button>
            </form>
          </div>
        )}

        <Link href="/forgot-password">
          <button className="mt-5 text-muted-foreground text-sm mx-auto block text-center hover:text-foreground transition-colors">
            Request a new reset link
          </button>
        </Link>
      </div>
    </div>
  );
}
