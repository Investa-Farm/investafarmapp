import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";
import { CheckCircle2, Copy, LoaderCircle, ShieldCheck, WalletCards } from "lucide-react";
import { SiStellar } from "react-icons/si";
import { isPrivyConfigured } from "./privy-provider";

type Chain = "solana" | "stellar";
type LinkedWallet = { address: string; linkedAt: string } | null;
type Wallets = Record<Chain, LinkedWallet>;
type LinkedWalletResponse = { wallet: LinkedWallet };
type PrivyWalletLink = {
  type?: string;
  chainType?: string;
  chain_type?: string;
  address?: string;
};

const CHAINS: Array<{ id: Chain; name: string; symbol: string }> = [
  { id: "solana", name: "Solana", symbol: "◎" },
  { id: "stellar", name: "Stellar", symbol: "S" },
];

function shortAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function PrivyMultiChainWallet({
  authToken,
  onWalletsReady,
}: {
  authToken: string | null;
  onWalletsReady?: () => void;
}) {
  if (!isPrivyConfigured) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <WalletCards className="mt-0.5 text-primary" size={20} />
          <div>
            <h2 className="font-semibold text-sm">Privy multi-chain wallet</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              This deployment has not configured Privy. Your KES wallet remains available separately.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return <ConfiguredPrivyMultiChainWallet authToken={authToken} onWalletsReady={onWalletsReady} />;
}

function ConfiguredPrivyMultiChainWallet({
  authToken,
  onWalletsReady,
}: {
  authToken: string | null;
  onWalletsReady?: () => void;
}) {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [wallets, setWallets] = useState<Wallets>({ solana: null, stellar: null });
  const [loading, setLoading] = useState(Boolean(authToken));
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<Chain | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(
      CHAINS.map(async ({ id }) => {
        const response = await fetch(`/api/users/linked-${id}-wallet`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) throw new Error(`Could not load the ${id} wallet.`);
        const result = (await response.json()) as LinkedWalletResponse;
        return [id, result.wallet ?? null] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) {
          setWallets(Object.fromEntries(entries) as Wallets);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load Privy wallets.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (wallets.solana && wallets.stellar) onWalletsReady?.();
  }, [wallets.solana?.address, wallets.stellar?.address]);

  const findPrivyWallet = (chain: Chain) =>
    (user?.linkedAccounts as PrivyWalletLink[] | undefined)?.find(
      (account) =>
        account.type === "wallet" &&
        (account.chainType ?? account.chain_type)?.toLowerCase() === chain &&
        typeof account.address === "string",
    );

  async function linkWallets() {
    setError(null);
    if (!authToken) {
      setError("Sign in to Investa Farm before setting up your Privy wallet.");
      return;
    }
    if (!ready) return;
    if (!authenticated) {
      login();
      return;
    }

    setBusy(true);
    try {
      const privyAccessToken = await getAccessToken();
      if (!privyAccessToken) throw new Error("Sign in to Privy again to verify wallet ownership.");

      for (const { id: chain } of CHAINS) {
        const existingPrivyWallet = findPrivyWallet(chain);
        const savedWallet = wallets[chain];
        if (savedWallet && (!existingPrivyWallet || existingPrivyWallet.address !== savedWallet.address)) {
          throw new Error(
            `The saved ${chain} address belongs to a different Privy account. Reconnect the original Privy account; no wallet link was changed.`,
          );
        }

        const address =
          existingPrivyWallet?.address ??
          (await createWallet({ chainType: chain })).wallet.address;
        const updatePath = chain === "stellar" ? "update-wallet" : "update-solana-wallet";
        const response = await fetch(`/api/users/${updatePath}`, {
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
            (result && "error" in result && result.error) || `Could not link the ${chain} wallet.`,
          );
        }
        if (!result || !("wallet" in result) || !result.wallet) {
          throw new Error(`The server did not confirm the ${chain} wallet.`);
        }
        setWallets((current) => ({ ...current, [chain]: result.wallet }));
      }
      onWalletsReady?.();
    } catch (linkError: unknown) {
      setError(linkError instanceof Error ? linkError.message : "Could not set up the Privy wallets.");
    } finally {
      setBusy(false);
    }
  }

  async function copyAddress(chain: Chain, address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(chain);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Could not copy the wallet address.");
    }
  }

  const complete = Boolean(wallets.solana && wallets.stellar);
  const actionLabel = !ready
    ? "Loading Privy…"
    : !authenticated
      ? "Continue with Privy"
      : complete
        ? "Reconnect Privy wallets"
        : "Create Solana + Stellar wallets";

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <WalletCards className="mt-0.5 text-primary" size={20} />
          <div>
            <h2 className="font-semibold text-sm">Privy multi-chain wallet</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              One Privy account for your Solana and Stellar wallets. Your KES wallet stays separate.
            </p>
          </div>
        </div>
        <ShieldCheck className="shrink-0 text-emerald-600" size={18} />
      </div>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle size={14} className="animate-spin" /> Loading linked wallets…
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {CHAINS.map(({ id, name, symbol }) => {
            const address = wallets[id]?.address;
            return (
              <div key={id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                {id === "stellar" ? (
                  <SiStellar className="shrink-0 text-[#08B5E5]" size={18} />
                ) : (
                  <span className="w-[18px] shrink-0 text-center text-base text-[#9945FF]">{symbol}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">{name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {address ? shortAddress(address) : "Not set up"}
                  </p>
                </div>
                {address && (
                  <button
                    type="button"
                    aria-label={`Copy ${name} address`}
                    onClick={() => void copyAddress(id, address)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground hover:text-foreground"
                  >
                    {copied === id ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-xs leading-relaxed text-red-600">{error}</p>}

      {!complete && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Both chain wallets are created under your signed-in Privy identity. Creating or linking them does not move funds.
        </p>
      )}

      <button
        type="button"
        disabled={!authToken || !ready || busy || loading}
        onClick={() => void linkWallets()}
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
        {busy ? "Setting up wallets…" : actionLabel}
      </button>
    </section>
  );
}
