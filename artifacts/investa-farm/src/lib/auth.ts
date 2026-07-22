export function getToken(): string | null {
  return sessionStorage.getItem("investa_token");
}

export function setToken(token: string): void {
  sessionStorage.setItem("investa_token", token);
}

export function clearToken(): void {
  sessionStorage.removeItem("investa_token");
  sessionStorage.removeItem("investa_user");
  // Reset to light mode so the next account starts clean
  document.documentElement.classList.remove("dark");
}

export function getStoredUser(): { id: number; email: string; name: string; role: "farmer" | "investor" | "cooperative"; phone?: string | null; country?: string | null } | null {
  const raw = sessionStorage.getItem("investa_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function storeUser(user: { id: number; email: string; name: string; role: string; phone?: string | null; country?: string | null }): void {
  sessionStorage.setItem("investa_user", JSON.stringify(user));
  // Apply this account's saved dark-mode preference immediately
  const saved = localStorage.getItem(`investa_theme_${user.id}`);
  document.documentElement.classList.toggle("dark", saved === "dark");
}

export { setToken as storeToken };

export function isAuthenticated(): boolean {
  return !!getToken();
}

const DEMO_EMAILS = new Set([
  "john.farmer@investafarm.com",
  "david.investor@investafarm.com",
  "demo.farmer@investafarm.com",
  "demo.investor@investafarm.com",
  "demo.coop@investafarm.com",
  "grace.farmer@investafarm.com",
  "peter.farmer@investafarm.com",
  "coop@investafarm.com",
  "cooperative@investafarm.com",
]);

export function isDemoAccount(): boolean {
  const user = getStoredUser();
  return user ? DEMO_EMAILS.has(user.email.toLowerCase()) : false;
}

export function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export function formatChange(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}
