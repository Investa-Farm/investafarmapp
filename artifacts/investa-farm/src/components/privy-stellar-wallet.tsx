import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";
import { CheckCircle2, Copy, LoaderCircle, ShieldCheck, WalletCards } from "lucide-react";
import { isPrivyConfigured } from "./privy-provider";

type LinkedWalletResponse = {
  wallet: { address: string; linkedAt: string } | null;
};

type PrivyWalletLink = {
  type?: string;
  chainType?: string;
  chain_type?: string;
  address?: string;
};

function shortAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function PrivyStellarWallet({ authToken }: { authToken: string | null }) {
  if (!isPrivyConfigured) {
    return (
      <section className="mt-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <WalletCards className="mt-0.5 text-muted-foreground" size={20} />
          <div>
            <h2 className="font-semibold text-sm">Embedded Stellar wallet</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Wallet connection is not configured for this deployment.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return <ConfiguredPrivyStellarWallet authToken={authToken} />;
}

function ConfiguredPrivyStellarWallet({ authToken }: { authToken: string | null }) {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [linkedAddress, setLinkedAddress] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(Boolean(authToken));
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authToken) {
      setLoadingLink(false);
      return;
    }

    let cancelled = false;
    setLoadingLink(true);
    fetch("/api/users/linked-stellar-wallet", {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the linked Stellar wallet.");
        return (await response.json()) as LinkedWalletResponse;
      })
      .then((response) => {
        if (!cancelled) setLinkedAddress(response.wallet?.address ?? null);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load the linked wallet.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLink(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const findStellarWallet = () =>
    (user?.linkedAccounts as PrivyWalletLink[] | undefined)?.find(
      (account) =>
        account.type === "wallet" &&
        (account.chainType ?? account.chain_type) === "stellar" &&
        typeof account.address === "string",
    );

  async function linkWallet() {
    setError(null);
    if (!authToken) {
      setError("Sign in to Investa Farm before linking a wallet.");
      return;
    }
    if (!authenticated) {
      login();
      return;
    }

    setBusy(true);
    try {
      const existingWallet = findStellarWallet();
      const address =
        existingWallet?.address ?? (await createWallet({ chainType: "stellar" })).wallet.address;
      const privyAccessToken = await getAccessToken();
      if (!privyAccessToken) throw new Error("Sign in to Privy again to verify wallet ownership.");

      const response = await fetch("/api/users/update-wallet", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Privy-Access-Token": `Bearer ${privyAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });
      const result = (await response.json().catch(() => null)) as
        | LinkedWalletResponse
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(
          (result && "error" in result && result.error) || "Failed to link the Stellar wallet.",
        );
      }
      if (!result || !("wallet" in result) || !result.wallet) {
        throw new Error("The server did not confirm the linked wallet.");
      }
      setLinkedAddress(result.wallet.address);
    } catch (linkError: unknown) {
      setError(linkError instanceof Error ? linkError.message : "Failed to link the Stellar wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function copyAddress() {
    if (!linkedAddress) return;
    try {
      await navigator.clipboard.writeText(linkedAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the wallet address.");
    }
  }

  const actionLabel = !ready
    ? "Loading Privy…"
    : !authenticated
      ? "Continue with Privy"
      : "Create and link Stellar wallet";

  return (
    <section className="mt-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <WalletCards className="mt-0.5 text-primary" size={20} />
          <div>
            <h2 className="font-semibold text-sm">Embedded Stellar wallet</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Separate from your Investa account number. Link a wallet securely with Privy.
            </p>
          </div>
        </div>
        <ShieldCheck className="shrink-0 text-emerald-600" size={18} />
      </div>

      {loadingLink ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle className="animate-spin" size={14} /> Checking linked wallet…
        </p>
      ) : linkedAddress ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Connected address</p>
            <p className="mt-1 font-mono text-xs" title={linkedAddress}>{shortAddress(linkedAddress)}</p>
          </div>
          <button
            type="button"
            onClick={copyAddress}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-background"
            aria-label="Copy Stellar wallet address"
          >
            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={linkWallet}
          disabled={!ready || busy}
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy || !ready ? <LoaderCircle className="animate-spin" size={16} /> : <WalletCards size={16} />}
          {busy ? "Verifying and linking…" : actionLabel}
        </button>
      )}

      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    </section>
  );
}
