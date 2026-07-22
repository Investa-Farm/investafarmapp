import { useState } from "react";
import { Link } from "wouter";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logoSrc} alt="Investa Farm" className="h-14 w-auto mb-2" />
          <p className="text-muted-foreground text-sm">Forgot your password?</p>
        </div>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 size={40} className="text-green-600 mx-auto mb-3" />
            <h2 className="font-bold text-foreground text-lg mb-2">Check your inbox</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">
              If <strong className="text-foreground">{email}</strong> is registered, we've sent a password reset link. It expires in <strong>1 hour</strong>.
            </p>
            <p className="text-muted-foreground text-xs mb-5">
              Can't find it? Check your spam folder.
            </p>
            <Link href="/login">
              <button className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform">
                Back to Sign In
              </button>
            </Link>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="font-bold text-foreground text-xl mb-1">Reset password</h2>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              Enter the email address for your account and we'll send you a link to reset your password.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : "Send Reset Link"}
              </button>
            </form>
          </div>
        )}

        <Link href="/login">
          <button className="mt-5 flex items-center gap-2 text-muted-foreground text-sm mx-auto hover:text-foreground transition-colors">
            <ArrowLeft size={14} /> Back to Sign In
          </button>
        </Link>
      </div>
    </div>
  );
}
