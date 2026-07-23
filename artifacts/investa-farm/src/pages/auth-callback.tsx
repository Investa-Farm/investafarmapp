/**
 * OAuth Callback Page
 * Reads token + user from URL params after Google/LinkedIn OAuth redirect.
 * - Existing users → redirect to their dashboard
 * - New users (is_new=1) → show a welcome screen before redirecting
 * - Errors → show friendly conflict / failure messages
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2 } from "lucide-react";
import { setToken, storeUser } from "@/lib/auth";

function getRoleHome(role: string): string {
  if (role === "farmer" || role === "cooperative") return "/farmer/dashboard";
  if (role === "agribusiness") return "/agribusiness/dashboard";
  return "/market";
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  linkedin: "LinkedIn",
  email: "email and password",
};

const PROVIDER_COLORS: Record<string, string> = {
  google: "#EA4335",
  linkedin: "#0A66C2",
  email: "#16a34a",
};

/* ── Conflict screen ───────────────────────────────────────────── */
function ConflictView({ conflictProvider, loginPath }: { conflictProvider: string; loginPath: string }) {
  const [, setLocation] = useLocation();
  const label = PROVIDER_LABELS[conflictProvider] ?? conflictProvider;
  const color = PROVIDER_COLORS[conflictProvider] ?? "#374151";

  const message =
    conflictProvider === "email"
      ? "This email is already registered with an email and password. Please sign in with your email instead."
      : `This email is already registered with ${label}. Please sign in with ${label} instead.`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-5 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ background: `${color}18`, border: `2px solid ${color}30` }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
            <path d="M12 8v4M12 16h.01" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <p className="text-foreground font-bold text-lg">Account already exists</p>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{message}</p>
        </div>
        <button
          onClick={() => setLocation(loginPath)}
          className="w-full py-3.5 rounded-2xl text-white font-bold text-sm active:scale-95 transition-all"
          style={{ background: color }}
        >
          Go to sign in
        </button>
        <button
          onClick={() => setLocation(loginPath)}
          className="w-full py-3 rounded-2xl border-2 border-border text-muted-foreground font-semibold text-sm active:scale-95 transition-all hover:text-foreground"
        >
          Back
        </button>
      </div>
    </div>
  );
}

/* ── Welcome screen for first-time OAuth users ─────────────────── */
function NewUserWelcome({ user, destination }: { user: { name: string; email: string; role: string }; destination: string }) {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    const r = setTimeout(() => setLocation(destination), 4000);
    return () => { clearInterval(t); clearTimeout(r); };
  }, [setLocation, destination]);

  const roleLabel =
    user.role === "farmer" ? "Farmer" :
    user.role === "investor" ? "Investor" :
    user.role === "cooperative" ? "Cooperative" :
    user.role === "agribusiness" ? "Agribusiness" : "Member";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Success ring */}
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
            <CheckCircle2 size={36} className="text-primary" />
          </div>
        </div>

        <div>
          <p className="text-foreground font-black text-2xl">Welcome, {user.name.split(" ")[0]}! 🎉</p>
          <p className="text-muted-foreground text-sm mt-2">
            Your <span className="font-semibold text-foreground">{roleLabel}</span> account has been created.
            A welcome email has been sent to <span className="font-semibold">{user.email}</span>.
          </p>
        </div>

        <div className="bg-primary/8 border border-primary/20 rounded-2xl p-4 text-left space-y-2">
          <p className="text-foreground text-xs font-bold uppercase tracking-wider text-primary">What's next</p>
          {user.role === "farmer" || user.role === "cooperative" ? (
            <>
              <p className="text-foreground text-sm">✅ Complete your farmer profile</p>
              <p className="text-foreground text-sm">📋 Submit KYC documents to unlock funding</p>
              <p className="text-foreground text-sm">💰 Get listed on the investor marketplace</p>
            </>
          ) : (
            <>
              <p className="text-foreground text-sm">✅ Browse investment opportunities</p>
              <p className="text-foreground text-sm">📈 Invest in verified farms across East Africa</p>
              <p className="text-foreground text-sm">💵 Track returns in real-time</p>
            </>
          )}
        </div>

        <button
          onClick={() => setLocation(destination)}
          className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-all"
        >
          Get Started →
        </button>
        <p className="text-muted-foreground text-xs">Auto-redirecting in {countdown}s…</p>
      </div>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────── */
export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "welcome"; user: { name: string; email: string; role: string }; destination: string }
    | { kind: "conflict"; conflictProvider: string; loginPath: string }
    | { kind: "error"; message: string; loginPath: string }
  >({ kind: "loading" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginPath = decodeURIComponent(params.get("login_path") ?? "/investor-auth");

    // Error cases
    const oauthError = params.get("oauth_error");
    if (oauthError) {
      const decoded = decodeURIComponent(oauthError);
      if (decoded.startsWith("conflict:")) {
        setState({ kind: "conflict", conflictProvider: decoded.slice("conflict:".length), loginPath });
      } else {
        setState({ kind: "error", message: decoded, loginPath });
        setTimeout(() => setLocation(loginPath), 4000);
      }
      return;
    }

    const token = params.get("token");
    const userRaw = params.get("user");
    const isNew = params.get("is_new") === "1";

    if (!token || !userRaw) {
      setState({ kind: "error", message: "Invalid authentication response. Redirecting…", loginPath });
      setTimeout(() => setLocation(loginPath), 2500);
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userRaw));
      setToken(token);
      storeUser(user);
      window.history.replaceState({}, "", "/auth-callback");

      const destination = getRoleHome(user.role);

      if (isNew) {
        // New user — show welcome screen first, then redirect
        setState({ kind: "welcome", user, destination });
      } else {
        // Returning user — go straight to dashboard
        setLocation(destination);
      }
    } catch {
      setState({ kind: "error", message: "Failed to complete sign-in. Please try again.", loginPath });
      setTimeout(() => setLocation(loginPath), 2500);
    }
  }, [setLocation]);

  if (state.kind === "conflict") {
    return <ConflictView conflictProvider={state.conflictProvider} loginPath={state.loginPath} />;
  }

  if (state.kind === "welcome") {
    return <NewUserWelcome user={state.user} destination={state.destination} />;
  }

  if (state.kind === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6">
        <div className="text-center">
          <p className="text-red-600 font-semibold text-base mb-2">Sign-in failed</p>
          <p className="text-muted-foreground text-sm">{state.message}</p>
          <p className="text-muted-foreground text-xs mt-2">Redirecting you back…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Loader2 size={36} className="animate-spin text-primary" />
      <p className="text-muted-foreground text-sm font-medium">Completing sign-in…</p>
    </div>
  );
}
