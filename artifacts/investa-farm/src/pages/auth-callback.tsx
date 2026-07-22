/**
 * OAuth Callback Page
 * Reads token + user from URL params after Google/LinkedIn OAuth redirect,
 * stores them in sessionStorage, and redirects to the correct dashboard.
 * Also handles provider-conflict errors with clear messaging.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
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
        {/* Icon */}
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

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "conflict"; conflictProvider: string; loginPath: string }
    | { kind: "error"; message: string; loginPath: string }
  >({ kind: "loading" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginPath = decodeURIComponent(params.get("login_path") ?? "/investor-auth");

    const oauthError = params.get("oauth_error");
    if (oauthError) {
      const decoded = decodeURIComponent(oauthError);
      if (decoded.startsWith("conflict:")) {
        const conflictProvider = decoded.slice("conflict:".length);
        setState({ kind: "conflict", conflictProvider, loginPath });
      } else {
        setState({ kind: "error", message: decoded, loginPath });
        setTimeout(() => setLocation(loginPath), 4000);
      }
      return;
    }

    const token = params.get("token");
    const userRaw = params.get("user");

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
      setLocation(getRoleHome(user.role));
    } catch {
      setState({ kind: "error", message: "Failed to complete sign-in. Please try again.", loginPath });
      setTimeout(() => setLocation(loginPath), 2500);
    }
  }, [setLocation]);

  if (state.kind === "conflict") {
    return <ConflictView conflictProvider={state.conflictProvider} loginPath={state.loginPath} />;
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
