/**
 * OAuth Callback Page
 * Reads token + user from URL params after Google/LinkedIn OAuth redirect,
 * stores them in sessionStorage, and redirects to the correct dashboard.
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

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Handle OAuth error from provider
    const oauthError = params.get("oauth_error");
    if (oauthError) {
      setError(decodeURIComponent(oauthError));
      setTimeout(() => setLocation("/"), 3000);
      return;
    }

    const token = params.get("token");
    const userRaw = params.get("user");

    if (!token || !userRaw) {
      setError("Invalid authentication response. Redirecting…");
      setTimeout(() => setLocation("/"), 2500);
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userRaw));
      setToken(token);
      storeUser(user);
      // Clean up URL and redirect
      window.history.replaceState({}, "", "/auth-callback");
      setLocation(getRoleHome(user.role));
    } catch {
      setError("Failed to complete sign-in. Please try again.");
      setTimeout(() => setLocation("/"), 2500);
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      {error ? (
        <div className="text-center px-6">
          <p className="text-red-600 font-semibold text-base mb-2">Sign-in failed</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <p className="text-muted-foreground text-xs mt-2">Redirecting you back…</p>
        </div>
      ) : (
        <>
          <Loader2 size={36} className="animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium">Completing sign-in…</p>
        </>
      )}
    </div>
  );
}
