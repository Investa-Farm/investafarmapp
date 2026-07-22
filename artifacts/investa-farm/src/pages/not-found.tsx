import { useLocation } from "wouter";
import { getStoredUser } from "@/lib/auth";

function getRoleHome(): string {
  const user = getStoredUser();
  if (!user) return "/";
  if (user.role === "farmer") return "/farmer/dashboard";
  if (user.role === "cooperative") return "/cooperative/dashboard";
  return "/market";
}

export default function NotFound() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();

  const homeLabel = user
    ? user.role === "farmer" ? "Go to Farmer Dashboard"
    : user.role === "cooperative" ? "Go to Cooperative Dashboard"
    : "Go to Market"
    : "Go to Home";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-background">
      <div className="text-5xl mb-4">🌾</div>
      <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
      <p className="text-lg font-semibold text-foreground mb-2">Page not found</p>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs leading-relaxed">
        This page doesn't exist or may have moved. Don't worry — your account and data are safe.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => window.history.back()}
          className="bg-muted text-foreground border border-border px-6 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
        >
          ← Go Back
        </button>
        <button
          onClick={() => setLocation(getRoleHome())}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
        >
          {homeLabel}
        </button>
      </div>
    </div>
  );
}
