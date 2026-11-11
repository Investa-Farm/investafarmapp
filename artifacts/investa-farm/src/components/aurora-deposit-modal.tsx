import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { WalletConnectModal, type WalletConnectResult } from "@/components/wallet-connect-modal";

type Destination = "sol" | "stellar";
type SourceChain =
  | "eth" | "bera" | "base" | "gnosis" | "arb" | "bsc" | "avax" | "op"
  | "monad" | "adi" | "plasma" | "scroll" | "xlayer" | "hood" | "sui" | "aptos"
  | "xrp" | "btc" | "doge" | "tron" | "ton" | "near" | "zec" | "ltc" | "cardano"
  | "stellar" | "aleo" | "bch" | "dash" | "starknet" | "coca" | "qtc" | "evm";

const SOURCE_CHAINS: Array<{ id: SourceChain; label: string }> = [
  { id: "eth", label: "Ethereum" }, { id: "bera", label: "Berachain" },
  { id: "base", label: "Base" }, { id: "gnosis", label: "Gnosis" },
  { id: "arb", label: "Arbitrum" }, { id: "bsc", label: "BNB Chain" },
  { id: "avax", label: "Avalanche" }, { id: "op", label: "Optimism" },
  { id: "monad", label: "Monad" },
  { id: "adi", label: "ADI Chain" }, { id: "plasma", label: "Plasma" },
  { id: "scroll", label: "Scroll" }, { id: "xlayer", label: "X Layer" },
  { id: "hood", label: "Hood" }, { id: "sui", label: "Sui" },
  { id: "aptos", label: "Aptos" }, { id: "xrp", label: "XRP Ledger" },
  { id: "btc", label: "Bitcoin" }, { id: "doge", label: "Dogecoin" },
  { id: "tron", label: "Tron" }, { id: "ton", label: "TON" },
  { id: "near", label: "NEAR" }, { id: "zec", label: "Zcash" },
  { id: "ltc", label: "Litecoin" }, { id: "cardano", label: "Cardano" },
  { id: "stellar", label: "Stellar" }, { id: "aleo", label: "Aleo" },
  { id: "bch", label: "Bitcoin Cash" }, { id: "dash", label: "Dash" },
  { id: "starknet", label: "Starknet" }, { id: "coca", label: "Coca" },
  { id: "qtc", label: "QTC" }, { id: "evm", label: "Other supported EVM network" },
];

type WalletResponse = { wallet: { address: string; linkedAt?: string } | null };
type DepositResponse = {
  destinationChain: Destination;
  destinationAsset: string;
  depositAddress: string;
  memo: string | null;
  alreadyExists: boolean;
  sourceChain: SourceChain;
  message: string;
};
type DepositStatus = {
  found: boolean;
  status: string;
  amountIn?: string | null;
  amountOut?: string | null;
  message?: string;
  refundReason?: string | null;
  originChainTxHashes?: string[];
  destinationChainTxHashes?: string[];
};
function shortAddress(address: string) {
  return `${address.slice(0, 9)}…${address.slice(-6)}`;
}

export function AuroraDepositModal({
  open,
  authToken,
  onClose,
  onSetupWallet,
}: {
  open: boolean;
  authToken: string | null;
  onClose: () => void;
  onSetupWallet: () => void;
}) {
  const [sourceChain, setSourceChain] = useState<SourceChain>("eth");
  const [destinationChain, setDestinationChain] = useState<Destination>("sol");
  const [wallet, setWallet] = useState<WalletResponse["wallet"]>(null);
  const [deposit, setDeposit] = useState<DepositResponse | null>(null);
  const [status, setStatus] = useState<DepositStatus | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<WalletConnectResult | null>(null);
  const [walletConnectOpen, setWalletConnectOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !authToken) return;
    let cancelled = false;
    setLoadingWallet(true);
    setError(null);
    setDeposit(null);
    setStatus(null);
    const chain = destinationChain === "sol" ? "solana" : "stellar";
    fetch(`/api/users/linked-${chain}-wallet`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as WalletResponse | { error?: string } | null;
        if (!response.ok) throw new Error((result && "error" in result && result.error) || "Could not load the selected Privy wallet.");
        return result as WalletResponse;
      })
      .then((result) => {
        if (!cancelled) setWallet(result.wallet ?? null);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load the selected Privy wallet.");
      })
      .finally(() => {
        if (!cancelled) setLoadingWallet(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, authToken, destinationChain]);

  async function createAddress() {
    if (!authToken) {
      setError("Sign in to create an Aurora deposit address.");
      return;
    }
    setCreating(true);
    setError(null);
    setDeposit(null);
    setStatus(null);
    try {
      const response = await fetch("/api/multichain/intent/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceChain, destinationChain }),
      });
      const result = (await response.json().catch(() => null)) as DepositResponse | { error?: string; code?: string } | null;
      if (response.status === 409 && result && "code" in result && result.code === "PRIVY_WALLET_REQUIRED") {
        setWallet(null);
        throw new Error(result.error || "Set up the selected Privy wallet first.");
      }
      if (!response.ok) {
        throw new Error((result && "error" in result && result.error) || "Aurora could not create a deposit address.");
      }
      setDeposit(result as DepositResponse);
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "Aurora could not create a deposit address.");
    } finally {
      setCreating(false);
    }
  }

  async function checkStatus() {
    if (!authToken) return;
    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/multichain/intent/status", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceChain, destinationChain }),
      });
      const result = (await response.json().catch(() => null)) as DepositStatus | { error?: string } | null;
      if (!response.ok) throw new Error((result && "error" in result && result.error) || "Could not check Aurora status.");
      setStatus(result as DepositStatus);
    } catch (checkError: unknown) {
      setError(checkError instanceof Error ? checkError.message : "Could not check Aurora status.");
    } finally {
      setChecking(false);
    }
  }

  async function copyAddress() {
    if (!deposit?.depositAddress) return;
    try {
      await navigator.clipboard.writeText(deposit.depositAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy the deposit address.");
    }
  }

  const destinationName = destinationChain === "sol" ? "Solana" : "Stellar";

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="aurora-deposit-title"
            initial={{ y: "12%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "12%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl border border-border bg-background p-5 pb-8 shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">Aurora Intents</p>
                <h2 id="aurora-deposit-title" className="mt-1 text-lg font-black text-foreground">Cross-chain deposit</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Generate a persistent address on a supported source network and route funds to your Privy {destinationName} wallet.
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="space-y-1.5 text-xs font-semibold text-foreground">
                From network
                <select
                  value={sourceChain}
                  onChange={(event) => { setSourceChain(event.target.value as SourceChain); setDeposit(null); setStatus(null); }}
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-medium"
                >
                  {SOURCE_CHAINS.map((chain) => <option key={chain.id} value={chain.id}>{chain.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-foreground">
                Privy destination
                <select
                  value={destinationChain}
                  onChange={(event) => {
                    setDestinationChain(event.target.value as Destination);
                    setDeposit(null);
                    setStatus(null);
                    setWallet(null);
                  }}
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-medium"
                >
                  <option value="sol">Solana</option>
                  <option value="stellar">Stellar</option>
                </select>
              </label>
            </div>

            {loadingWallet ? (
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircle size={14} className="animate-spin" /> Checking your Privy wallet…
              </p>
            ) : !wallet ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">Set up your Privy {destinationName} wallet first</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-900">
                  Solana and Stellar wallets are created under your Privy account during setup. KES remains a separate Investa wallet.
                </p>
                <button type="button" onClick={onSetupWallet} className="mt-3 min-h-10 w-full rounded-xl bg-amber-800 px-3 text-sm font-semibold text-white">
                  Set up Privy wallets
                </button>
              </div>
            ) : (
              <>
                <p className="mt-4 rounded-xl bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                  Destination: Privy {destinationName} · {shortAddress(wallet.address)}
                </p>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void createAddress()}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"
                >
                  {creating ? <LoaderCircle size={16} className="animate-spin" /> : null}
                  {creating ? "Creating with Aurora…" : "Create deposit address"}
                </button>
              </>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800">
                {error}
              </p>
            )}

            {deposit && (
              <div className="mt-4 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div>
                  <p className="text-sm font-bold text-emerald-950">Deposit address ready</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-emerald-900">
                    Send only an Aurora-supported asset from {SOURCE_CHAINS.find((item) => item.id === sourceChain)?.label}. Aurora routes the output to your {destinationName} wallet.
                  </p>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-white p-3">
                  <code className="min-w-0 flex-1 break-all text-[11px] leading-relaxed text-slate-800">{deposit.depositAddress}</code>
                  <button type="button" onClick={() => void copyAddress()} aria-label="Copy deposit address" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
                {deposit.memo && (
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-semibold text-slate-500">Required memo / tag</p>
                    <code className="mt-1 block break-all text-[11px] text-slate-800">{deposit.memo}</code>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setWalletConnectOpen(true)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 text-xs font-semibold">
                    {connectedWallet?.walletId === "metamask" ? "MetaMask connected" : "Connect MetaMask"}
                  </button>
                  <button type="button" onClick={() => setWalletConnectOpen(true)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 text-xs font-semibold">
                    {connectedWallet?.walletId === "binance" ? "Binance connected" : "Connect Binance Web3"}
                  </button>
                </div>
                {connectedWallet && (
                  <p className="rounded-lg bg-white px-3 py-2 font-mono text-[10px] text-slate-600">
                    {connectedWallet.walletId === "metamask" ? "MetaMask" : "Binance Web3"}: {shortAddress(connectedWallet.address)}
                  </p>
                )}
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Wallet connection lets you view the sender account. Review the selected network and asset in your wallet before sending to the address above.
                </p>
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => void checkStatus()}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {checking ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {checking ? "Checking Aurora…" : "Check deposit status"}
                </button>
                {status && (
                  <div className="rounded-xl border border-emerald-200 bg-white p-3 text-xs">
                    <p className="font-bold text-foreground">{status.status.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-muted-foreground">
                      {status.message ?? (status.found ? `Received ${status.amountIn ?? "—"}; routed ${status.amountOut ?? "—"}.` : "No deposit detected yet.")}
                    </p>
                    {status.refundReason && <p className="mt-1 text-red-700">Refund: {status.refundReason}</p>}
                  </div>
                )}
                <p className="flex items-start gap-2 text-[10px] leading-relaxed text-amber-900">
                  <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                  This is a persistent Aurora deposit route, not a quote or Investa payment. It does not credit KES or issue farm shares. Confirm the network and asset before sending.
                </p>
              </div>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
    <WalletConnectModal
      open={walletConnectOpen}
      onClose={() => setWalletConnectOpen(false)}
      onConnected={(wallet) => {
        setConnectedWallet(wallet);
        setWalletConnectOpen(false);
      }}
    />
    </>
  );
}
