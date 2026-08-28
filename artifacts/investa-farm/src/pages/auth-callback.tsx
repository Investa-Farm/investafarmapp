/**
 * OAuth Callback Page
 * Exchanges a one-time OAuth ticket for a session token (token is never put in the URL).
 * - Existing users → redirect to their dashboard
 * - New users (is_new=1) → show a welcome screen before redirecting
 * - Errors → show friendly conflict / failure messages
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2 } from "lucide-react";
import { setToken, storeUser } from "@/lib/auth";

function getRoleHome(role: string): string {
  if (role === "farmer") return "/farmer";
  if (role === "cooperative") return "/cooperative/dashboard";
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
function ConflictView({
  conflictProvider,
  conflictRole,
  loginPath,
}: {
  conflictProvider?: string;
  conflictRole?: string;
  loginPath: string;
}) {
  const [, setLocation] = useLocation();
  const roleLabel = conflictRole
    ? conflictRole.charAt(0).toUpperCase() + conflictRole.slice(1)
    : null;
  const label = conflictProvider ? (PROVIDER_LABELS[conflictProvider] ?? conflictProvider) : "this account";
  const color = conflictProvider ? (PROVIDER_COLORS[conflictProvider] ?? "#374151") : "#16a34a";

  const message = conflictRole
    ? `This Google or LinkedIn email is already registered as a ${roleLabel}. Sign in from the ${roleLabel} page instead — one email cannot be both a farmer and an investor.`
    : conflictProvider === "email"
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
const TICKET_KEY = "investa_oauth_ticket";
const RESULT_KEY = "investa_oauth_result";
const LOGIN_PATH_KEY = "investa_oauth_login_path";
const EXCHANGING_KEY = "investa_oauth_exchanging";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "welcome"; user: { name: string; email: string; role: string }; destination: string }
    | { kind: "conflict"; conflictProvider?: string; conflictRole?: string; loginPath: string }
    | { kind: "error"; message: string; loginPath: string }
  >({ kind: "loading" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginPath = decodeURIComponent(
      params.get("login_path") ?? sessionStorage.getItem(LOGIN_PATH_KEY) ?? "/investor-auth",
    );
    if (params.get("login_path")) sessionStorage.setItem(LOGIN_PATH_KEY, loginPath);

    const finish = (d: { token: string; user: { id: number; name: string; email: string; role: string }; isNew?: boolean }, isNewParam: boolean) => {
      setToken(d.token);
      storeUser(d.user);
      sessionStorage.removeItem(TICKET_KEY);
      sessionStorage.removeItem(RESULT_KEY);
      sessionStorage.removeItem(EXCHANGING_KEY);
      const destination = getRoleHome(d.user.role);
      if (d.isNew || isNewParam) {
        setState({ kind: "welcome", user: d.user, destination });
      } else {
        setLocation(destination);
      }
    };

    const oauthError = params.get("oauth_error");
    if (oauthError) {
      sessionStorage.removeItem(TICKET_KEY);
      sessionStorage.removeItem(RESULT_KEY);
      sessionStorage.removeItem(EXCHANGING_KEY);
      const decoded = decodeURIComponent(oauthError);
      if (decoded.startsWith("conflict:role:")) {
        setState({ kind: "conflict", conflictRole: decoded.slice("conflict:role:".length), loginPath });
      } else if (decoded.startsWith("conflict:")) {
        setState({ kind: "conflict", conflictProvider: decoded.slice("conflict:".length), loginPath });
      } else {
        setState({ kind: "error", message: decoded, loginPath });
        setTimeout(() => setLocation(loginPath), 4000);
      }
      return;
    }

    const isNewParam = params.get("is_new") === "1";

    try {
      const cached = sessionStorage.getItem(RESULT_KEY);
      if (cached) {
        const d = JSON.parse(cached);
        if (d.token && d.user) {
          finish(d, isNewParam || Boolean(d.isNew));
          return;
        }
      }
    } catch { /* ignore */ }

    const legacyToken = params.get("token");
    const legacyUserRaw = params.get("user");
    if (legacyToken && legacyUserRaw && !params.get("ticket")) {
      try {
        const user = JSON.parse(decodeURIComponent(legacyUserRaw));
        window.history.replaceState({}, "", "/auth-callback");
        finish({ token: legacyToken, user, isNew: isNewParam }, isNewParam);
        return;
      } catch {
        setState({ kind: "error", message: "Invalid authentication response. Redirecting…", loginPath });
        setTimeout(() => setLocation(loginPath), 2500);
        return;
      }
    }

    const ticket = params.get("ticket") || sessionStorage.getItem(TICKET_KEY);
    if (!ticket) {
      setState({ kind: "error", message: "Invalid authentication response. Redirecting…", loginPath });
      setTimeout(() => setLocation(loginPath), 2500);
      return;
    }

    sessionStorage.setItem(TICKET_KEY, ticket);
    if (params.get("ticket")) window.history.replaceState({}, "", "/auth-callback");

    if (sessionStorage.getItem(EXCHANGING_KEY) === ticket) return;
    sessionStorage.setItem(EXCHANGING_KEY, ticket);

    fetch("/api/auth/oauth/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.token || !d.user) throw new Error(d.error ?? "Failed to complete sign-in");
        sessionStorage.setItem(RESULT_KEY, JSON.stringify(d));
        finish(d, isNewParam);
      })
      .catch((err) => {
        sessionStorage.removeItem(TICKET_KEY);
        sessionStorage.removeItem(EXCHANGING_KEY);
        setState({ kind: "error", message: (err as Error).message || "Failed to complete sign-in. Please try again.", loginPath });
        setTimeout(() => setLocation(loginPath), 2500);
      });
  }, [setLocation]);

  if (state.kind === "conflict") {
    return (
      <ConflictView
        conflictProvider={state.conflictProvider}
        conflictRole={state.conflictRole}
        loginPath={state.loginPath}
      />
    );
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
