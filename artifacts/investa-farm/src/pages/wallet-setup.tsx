import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { PrivyMultiChainWallet } from "@/components/privy-multichain-wallet";
import { getStoredUser, getToken } from "@/lib/auth";

function roleHome(role?: string) {
  if (role === "farmer") return "/farmer";
  if (role === "cooperative") return "/cooperative/dashboard";
  if (role === "agribusiness") return "/agribusiness";
  return "/market";
}

function safeNextPath(value: string | null, role?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : roleHome(role);
}

export default function WalletSetupPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const user = getStoredUser();
  const token = getToken();
  const next = safeNextPath(params.get("next"), user?.role);
  const [walletsReady, setWalletsReady] = useState(false);

  return (
    <main className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-[480px] space-y-5">
        <button
          type="button"
          onClick={() => setLocation(next)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Skip setup
        </button>

        <header className="rounded-3xl bg-gradient-to-br from-primary to-emerald-700 p-6 text-white">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <ShieldCheck size={24} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/75">Wallet setup</p>
          <h1 className="mt-1 text-2xl font-black">Create your Privy multi-chain wallet</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            Use one Privy account for Solana and Stellar. Your KES wallet remains separate.
          </p>
        </header>

        {!token ? (
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Sign in to finish setup</p>
            <p className="mt-1 text-xs text-muted-foreground">Your Investa account must be active before wallet links can be saved.</p>
            <button
              type="button"
              onClick={() => setLocation("/investor-auth")}
              className="mt-4 min-h-10 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-white"
            >
              Sign in
            </button>
          </section>
        ) : (
          <>
            <PrivyMultiChainWallet authToken={token} onWalletsReady={() => setWalletsReady(true)} />
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
              Wallet creation does not move funds. Cross-chain deposits remain separate from your KES balance and do not automatically purchase farm shares.
            </div>
            <button
              type="button"
              onClick={() => setLocation(next)}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white"
            >
              {walletsReady ? "Continue" : "Continue without setup"}
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
    </main>
  );
}
