import { useEffect, useState } from "react";
import { useCreateWallet, usePrivy } from "@privy-io/react-auth";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { isPrivyConfigured } from "./privy-provider";

type PrivyLinkedAccount = {
  type?: string;
  chainType?: string;
  chain_type?: string;
  address?: string;
};

type MultiChainStatus = {
  auroraReady: boolean;
  solanaDevnet: {
    network: string;
    transferConfigured: boolean;
    cropShareMintConfigured: boolean;
    missingSettings: string[];
  };
};

type IntentAddress = {
  network: string;
  destinationAsset: string;
  depositAddress: string;
  memo: string | null;
  alreadyExists: boolean;
  targetAmountUsd: number;
  amountIsNotQuoted: boolean;
  message: string;
};

type TokenBalance = {
  mint: string;
  rawAmount: string;
  decimals: number;
  amount: string;
};

type DevnetBalances = {
  nativeSol: string;
  usdcBalance: TokenBalance | null;
  cropShareBalance: TokenBalance | null;
  cropShareMintConfigured: boolean;
  note: string;
};

function errorFromResponse(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return fallback;
}

export function SolanaDevnetFunding({ authToken }: { authToken: string | null }) {
  if (!isPrivyConfigured) {
    return (
      <section className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/30">
        <div className="flex items-start gap-3">
          <WalletCards className="mt-0.5 text-violet-700 dark:text-violet-300" size={20} />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Solana Devnet funding lab</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Privy is not configured in this deployment, so Solana wallet linking is unavailable.
              This sandbox never changes your KES or Polygon USDC balance.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return <ConfiguredSolanaDevnetFunding authToken={authToken} />;
}

function ConfiguredSolanaDevnetFunding({ authToken }: { authToken: string | null }) {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [open, setOpen] = useState(false);
  useScrollLock(open);

  const [walletAddress, setWalletAddress] = useState("");
  const [walletVerified, setWalletVerified] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [amount, setAmount] = useState(10);
  const [sourceChain, setSourceChain] = useState<"base" | "eth">("base");
  const [status, setStatus] = useState<MultiChainStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [intentBusy, setIntentBusy] = useState(false);
  const [intentError, setIntentError] = useState("");
  const [intentAddress, setIntentAddress] = useState<IntentAddress | null>(null);
  const [copied, setCopied] = useState(false);
  const [sandboxPreviewed, setSandboxPreviewed] = useState(false);
  const [balances, setBalances] = useState<DevnetBalances | null>(null);
  const [balancesBusy, setBalancesBusy] = useState(false);
  const [balancesError, setBalancesError] = useState("");

  useEffect(() => {
    const linkedAccounts = user?.linkedAccounts as PrivyLinkedAccount[] | undefined;
    const solanaWallet = linkedAccounts?.find(
      (account) =>
        account.type === "wallet" &&
        (account.chainType ?? account.chain_type) === "solana" &&
        typeof account.address === "string",
    );
    setWalletAddress(solanaWallet?.address ?? "");
    setWalletVerified(false);
  }, [user]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatusError("");
    fetch("/api/multichain/status")
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(errorFromResponse(payload, "Could not load funding status."));
        return payload as MultiChainStatus;
      })
      .then((payload) => {
        if (!cancelled) setStatus(payload);
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatusError(error instanceof Error ? error.message : "Could not load funding status.");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function connectSolanaWallet() {
    setWalletError("");
    setWalletBusy(true);
    try {
      if (!authToken) throw new Error("Sign in to Investa Farm before linking a wallet.");
      if (!ready) throw new Error("Privy is still loading. Try again in a moment.");
      if (!authenticated) {
        login();
        return;
      }

      const linkedAccounts = user?.linkedAccounts as PrivyLinkedAccount[] | undefined;
      const existing = linkedAccounts?.find(
        (account) =>
          account.type === "wallet" &&
          (account.chainType ?? account.chain_type) === "solana" &&
          typeof account.address === "string",
      );
      const address = existing?.address ?? (await createWallet()).address;
      const privyAccessToken = await getAccessToken();
      if (!privyAccessToken) throw new Error("Sign in to Privy again to verify wallet ownership.");

      const response = await fetch("/api/users/verify-solana-wallet", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Privy-Access-Token": `Bearer ${privyAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(errorFromResponse(payload, "The server could not verify this Solana wallet."));
      }
      const verifiedAddress = (payload as { wallet?: { address?: string } })?.wallet?.address;
      if (!verifiedAddress) throw new Error("The server did not confirm the Solana wallet.");
      setWalletAddress(verifiedAddress);
      setWalletVerified(true);
      setBalances(null);
    } catch (error: unknown) {
      setWalletError(error instanceof Error ? error.message : "Could not link the Solana wallet.");
    } finally {
      setWalletBusy(false);
    }
  }

  async function createAuroraAddress() {
    setIntentError("");
    setIntentAddress(null);
    setIntentBusy(true);
    try {
      if (!authToken) throw new Error("Sign in to Investa Farm before creating a deposit address.");
      if (!walletAddress || !walletVerified) throw new Error("Connect and verify a Solana wallet first.");
      const privyAccessToken = await getAccessToken();
      if (!privyAccessToken) throw new Error("Sign in to Privy again to verify wallet ownership.");

      const response = await fetch("/api/intent/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Privy-Access-Token": `Bearer ${privyAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userSolanaWallet: walletAddress,
          sourceChain,
          sourceAsset: "USDC",
          investmentAmount: amount,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(errorFromResponse(payload, "Aurora could not create a deposit address."));
      }
      setIntentAddress(payload as IntentAddress);
    } catch (error: unknown) {
      setIntentError(error instanceof Error ? error.message : "Aurora could not create a deposit address.");
    } finally {
      setIntentBusy(false);
    }
  }

  async function loadDevnetBalances() {
    setBalancesError("");
    setBalances(null);
    setBalancesBusy(true);
    try {
      if (!walletAddress) throw new Error("Connect a Solana wallet first.");
      const response = await fetch(
        `/api/solana/devnet/balances?owner=${encodeURIComponent(walletAddress)}`,
      );
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorFromResponse(payload, "Could not read Devnet balances."));
      setBalances(payload as DevnetBalances);
    } catch (error: unknown) {
      setBalancesError(error instanceof Error ? error.message : "Could not read Devnet balances.");
    } finally {
      setBalancesBusy(false);
    }
  }

  async function copyDepositAddress() {
    if (!intentAddress?.depositAddress) return;
    try {
      await navigator.clipboard.writeText(intentAddress.depositAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setIntentError("Could not copy the deposit address.");
    }
  }

  function actionUrl() {
    return `${window.location.origin}/api/actions/invest?amount=${amount}`;
  }

  async function copyActionUrl() {
    try {
      await navigator.clipboard.writeText(actionUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setBalancesError("Could not copy the Devnet action link.");
    }
  }

  function openBlinkPreview() {
    const preview = new URL("https://dial.to/");
    preview.searchParams.set("action", `solana-action:${actionUrl()}`);
    window.open(preview.toString(), "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <section className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/30" data-testid="card-solana-devnet-lab">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-700 text-xs font-black text-white">SOL</div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Solana funding lab</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">Devnet sandbox · separate from KES and Polygon USDC</p>
            </div>
          </div>
          <span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-violet-800 dark:bg-violet-900 dark:text-violet-200">
            Test only
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-violet-200/70 pt-3 dark:border-violet-900">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Devnet tokens have no real-world value. The demo cannot credit KES or issue farm shares.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl bg-violet-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-violet-800"
            data-testid="button-open-solana-lab"
          >
            Open lab <ArrowUpRight size={14} />
          </button>
        </div>
      </section>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="solana-lab-title"
            className="max-h-[88dvh] w-full max-w-[470px] overflow-y-auto rounded-t-3xl border-t-4 border-violet-600 bg-background p-5 pb-8 shadow-2xl sm:rounded-3xl sm:border-t-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="solana-lab-title" className="text-lg font-bold text-foreground">Funding routes</h3>
                <p className="mt-1 text-xs text-muted-foreground">Choose a sandbox flow. No KES balance is used.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
                aria-label="Close funding routes"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 shrink-0" size={15} />
                <p>
                  Aurora deposit addresses route to Solana <strong>mainnet</strong>. Solana Devnet is a separate
                  test-only flow. Never send real assets to a Devnet address or treat test tokens as farm shares.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="funding-amount" className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span>Target amount</span>
                <span>${amount} USD</span>
              </label>
              <input
                id="funding-amount"
                type="range"
                min={10}
                max={500}
                step={10}
                value={amount}
                onChange={(event) => setAmount(Number(event.currentTarget.value))}
                className="mt-3 w-full accent-violet-700"
                aria-label="Target amount in US dollars"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>$10</span><span>$500</span></div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Privy Solana wallet</h4>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {walletVerified ? "Verified by Investa's server with Privy." : "Connect and verify with Privy before creating a deposit address."}
                  </p>
                </div>
                <ShieldCheck className="text-emerald-600" size={18} />
              </div>
              {walletAddress ? (
                <p className="mt-3 break-all rounded-lg bg-muted px-3 py-2 font-mono text-[10px] text-foreground">{walletAddress}</p>
              ) : (
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-[10px] text-muted-foreground">No Solana wallet is connected.</p>
              )}
              <button
                type="button"
                onClick={connectSolanaWallet}
                disabled={!ready || walletBusy}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {walletBusy || !ready ? <LoaderCircle className="animate-spin" size={15} /> : <WalletCards size={15} />}
                {walletBusy ? "Verifying with Privy…" : walletAddress ? "Verify Solana wallet" : "Connect Solana wallet"}
              </button>
              {walletError && <p role="alert" className="mt-2 text-[11px] text-destructive">{walletError}</p>}
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Aurora Intents · Solana mainnet</h4>
                  <p className="mt-1 text-[10px] text-muted-foreground">Creates a persistent address; it does not move funds or quote an exchange rate.</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-[9px] font-semibold text-muted-foreground">Mainnet</span>
              </div>
              <label htmlFor="aurora-source-chain" className="mt-3 block text-[10px] font-semibold text-muted-foreground">Source chain</label>
              <select
                id="aurora-source-chain"
                value={sourceChain}
                onChange={(event) => setSourceChain(event.currentTarget.value as "base" | "eth")}
                className="mt-1 min-h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground"
              >
                <option value="base">Base mainnet</option>
                <option value="eth">Ethereum mainnet</option>
              </select>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                USDC is only a reminder, not a restriction: the address may accept other Aurora-supported assets on
                this chain. Verify the network and asset before sending.
              </p>
              <button
                type="button"
                onClick={createAuroraAddress}
                disabled={!authToken || !walletAddress || !walletVerified || !status?.auroraReady || intentBusy}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {intentBusy ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowUpRight size={15} />}
                {intentBusy ? "Requesting address…" : "Create persistent address"}
              </button>
              {status && !status.auroraReady && (
                <p className="mt-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                  Aurora requires an approved API key and server-side Privy verification. No address can be created until configured.
                </p>
              )}
              {statusError && <p role="alert" className="mt-2 text-[10px] text-destructive">{statusError}</p>}
              {intentError && <p role="alert" className="mt-2 text-[10px] text-destructive">{intentError}</p>}
              {intentAddress && (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                  <p className="text-[10px] font-semibold text-blue-900 dark:text-blue-100">
                    Address ready · {intentAddress.network}
                  </p>
                  <p className="mt-1 break-all font-mono text-[10px] text-foreground">{intentAddress.depositAddress}</p>
                  {intentAddress.memo && <p className="mt-1 break-all text-[10px] text-muted-foreground">Memo: {intentAddress.memo}</p>}
                  <button
                    type="button"
                    onClick={copyDepositAddress}
                    className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-300 px-3 text-[10px] font-semibold text-blue-900 dark:border-blue-800 dark:text-blue-100"
                  >
                    {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    {copied ? "Copied" : "Copy address"}
                  </button>
                  <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{intentAddress.message}</p>
                  <p className="mt-2 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    Waiting for a source-chain deposit. This address response does not confirm a payment or issue crop shares.
                  </p>
                </div>
              )}
              <div
                className="mt-4 rounded-xl border border-border bg-muted/40 p-3"
                aria-label="Funding progress"
              >
                <h5 className="text-[11px] font-semibold text-foreground">Funding progress</h5>
                <ol className="mt-3 space-y-3">
                  {[
                    {
                      title: "Privy wallet",
                      detail: walletVerified
                        ? "Ownership verified by Investa's server."
                        : walletAddress
                          ? "Linked in Privy; server verification is still required."
                          : "Connect a Solana wallet to start.",
                      complete: walletVerified,
                    },
                    {
                      title: "Aurora address",
                      detail: intentAddress
                        ? "Persistent mainnet address created; no funds moved."
                        : status?.auroraReady
                          ? "Ready after the wallet is verified."
                          : "Unavailable until Aurora is approved and configured.",
                      complete: Boolean(intentAddress),
                    },
                    {
                      title: "Incoming payment",
                      detail: intentAddress
                        ? "Waiting; payment receipt tracking is not connected."
                        : "Not started.",
                      complete: false,
                    },
                    {
                      title: "Solana settlement",
                      detail: "Not confirmed; Aurora settlement status is not connected.",
                      complete: false,
                    },
                    {
                      title: "Farm-share issuance",
                      detail: "Disabled until an audited issuance program is configured.",
                      complete: false,
                    },
                  ].map((step, index) => (
                    <li key={step.title} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                          step.complete
                            ? "bg-emerald-600 text-white"
                            : "border border-border bg-background text-muted-foreground"
                        }`}
                        aria-hidden="true"
                      >
                        {step.complete ? <CheckCircle2 size={13} /> : index + 1}
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold text-foreground">{step.title}</p>
                        <p className="text-[10px] leading-relaxed text-muted-foreground">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900 dark:bg-violet-950/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Solana Devnet Actions & balances</h4>
                  <p className="mt-1 text-[10px] text-muted-foreground">Unsigned test-USDC transfer only; no farm shares are minted.</p>
                </div>
                <span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-semibold text-violet-800 dark:bg-violet-900 dark:text-violet-200">Devnet</span>
              </div>
              {walletAddress && (
                <button
                  type="button"
                  onClick={loadDevnetBalances}
                  disabled={balancesBusy}
                  className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-violet-300 px-3 text-xs font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:text-violet-100 dark:hover:bg-violet-950"
                >
                  {balancesBusy ? <LoaderCircle className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                  {balancesBusy ? "Reading Devnet…" : "Read Devnet balances"}
                </button>
              )}
              {balances && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-background/80 p-2">
                    <p className="text-[9px] text-muted-foreground">Native SOL</p>
                    <p className="mt-1 text-xs font-semibold text-foreground">{balances.nativeSol}</p>
                  </div>
                  <div className="rounded-lg bg-background/80 p-2">
                    <p className="text-[9px] text-muted-foreground">Test USDC</p>
                    <p className="mt-1 text-xs font-semibold text-foreground">{balances.usdcBalance?.amount ?? "Not configured"}</p>
                  </div>
                  <div className="col-span-2 rounded-lg bg-background/80 p-2">
                    <p className="text-[9px] text-muted-foreground">Crop-share SPL balance</p>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {balances.cropShareBalance?.amount ?? "Share mint not configured"}
                    </p>
                    <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{balances.note}</p>
                  </div>
                </div>
              )}
              {status?.solanaDevnet.missingSettings.length ? (
                <p className="mt-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                  Missing Devnet setup: {status.solanaDevnet.missingSettings.join(", ")}. The transfer action remains disabled.
                </p>
              ) : null}
              {balancesError && <p role="alert" className="mt-2 text-[10px] text-destructive">{balancesError}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={copyActionUrl}
                  disabled={!status?.solanaDevnet.transferConfigured}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-violet-300 px-2 text-[10px] font-semibold text-violet-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:text-violet-100"
                >
                  {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  Copy Action link
                </button>
                <button
                  type="button"
                  onClick={openBlinkPreview}
                  disabled={!status?.solanaDevnet.transferConfigured}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-violet-700 px-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ExternalLink size={13} /> Open Blink
                </button>
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
                A signed Devnet action transfers test USDC to the configured demo pool. It does not mint crop shares,
                change the Investa wallet, or represent a real investment.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Robinhood Connect</h4>
                  <p className="mt-1 text-[10px] text-muted-foreground">Local sandbox preview only. No Robinhood login or API request.</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-[9px] font-semibold text-muted-foreground">Mock</span>
              </div>
              <button
                type="button"
                onClick={() => setSandboxPreviewed((value) => !value)}
                className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted"
              >
                {sandboxPreviewed ? <CheckCircle2 size={14} /> : <ExternalLink size={14} />}
                {sandboxPreviewed ? "Hide sandbox preview" : "Preview funding flow"}
              </button>
              {sandboxPreviewed && (
                <div role="status" className="mt-3 rounded-lg bg-muted/70 p-3 text-[10px] leading-relaxed text-muted-foreground">
                  Sandbox preview completed locally. No Robinhood account was linked, no funding was requested, and no wallet balance changed.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
