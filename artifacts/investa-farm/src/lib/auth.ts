export function getToken(): string | null {
  return localStorage.getItem("investa_token");
}

export function setToken(token: string): void {
  localStorage.setItem("investa_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("investa_token");
  localStorage.removeItem("investa_user");
}

export function getStoredUser(): { id: number; email: string; name: string; role: "farmer" | "investor" | "cooperative" } | null {
  const raw = localStorage.getItem("investa_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function storeUser(user: { id: number; email: string; name: string; role: string }): void {
  localStorage.setItem("investa_user", JSON.stringify(user));
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
