import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Wallet, X } from "lucide-react";
import { SiBinance } from "react-icons/si";
import { EthereumProvider } from "@walletconnect/ethereum-provider";

type WalletId = "metamask" | "binance";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  providers?: Eip1193Provider[];
  isMetaMask?: boolean;
  isBraveWallet?: boolean;
  isBinance?: boolean;
  isBinanceWallet?: boolean;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};

export interface WalletConnectResult {
  address: string;
  walletId: WalletId;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected?: (wallet: WalletConnectResult | null) => void;
}

const PENDING_KEY = "investa_wallet_connect_pending";
const CONNECTED_KEY = "investa_connected_evm_wallet";
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "";

function MetaMaskMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true">
      <path fill="#E2761B" d="M5 4 18 13 15 19 8 17 5 4Zm30 0-13 9 3 6 7-2 3-13Z" />
      <path fill="#E4761B" d="m8 18 7 2 5 5-4 4-8-4v-7Zm24 0-7 2-5 5 4 4 8-4v-7Z" />
      <path fill="#F6851B" d="m16 29 4-4 4 4-1 5h-6l-1-5Z" />
      <path fill="#763D16" d="m13 21 5 1 2 3-4 4-5-4 2-4Zm14 0-5 1-2 3 4 4 5-4-2-4Z" />
      <path fill="#CD6116" d="m16 34 1-5 3-2v7h-4Zm8 0-1-5-3-2v7h4Z" />
    </svg>
  );
}

const WALLETS: Array<{
  id: WalletId;
  name: string;
  icon: ReactNode;
  color: string;
  help: string;
}> = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: <MetaMaskMark />,
    color: "#E2761B",
    help: "Browser extension or MetaMask mobile",
  },
  {
    id: "binance",
    name: "Binance Web3 Wallet",
    icon: <SiBinance size={25} color="#F3BA2F" />,
    color: "#F3BA2F",
    help: "Binance Web3 browser or app",
  },
];

function getInjectedProvider(walletId: WalletId): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const walletWindow = window as Window & {
    ethereum?: Eip1193Provider;
    BinanceChain?: Eip1193Provider;
  };
  const root = walletWindow.ethereum;
  const providers = [
    ...(Array.isArray(root?.providers) ? root.providers : []),
    ...(root ? [root] : []),
    ...(walletWindow.BinanceChain ? [walletWindow.BinanceChain] : []),
  ].filter((provider, index, all) => all.indexOf(provider) === index);

  if (walletId === "binance") {
    return providers.find((provider) => provider.isBinance || provider.isBinanceWallet)
      ?? walletWindow.BinanceChain
      ?? null;
  }

  return providers.find((provider) => provider.isMetaMask && !provider.isBraveWallet)
    ?? (providers.length === 1 && !providers[0].isBinance ? providers[0] : null);
}

function openWalletBrowser(walletId: WalletId) {
  const currentUrl = window.location.href;
  localStorage.setItem(PENDING_KEY, JSON.stringify({ walletId, ts: Date.now() }));
  const url = walletId === "metamask"
    ? `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}${window.location.search}`
    : `https://www.binance.com/en/web3wallet?dapp=${encodeURIComponent(currentUrl)}`;
  window.location.assign(url);
}

export function WalletConnectModal({ open, onClose, onConnected }: Props) {
  const [busyWallet, setBusyWallet] = useState<WalletId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<WalletConnectResult | null>(null);

  async function connect(walletId: WalletId, resume = false) {
    setError(null);
    setBusyWallet(walletId);
    try {
      let provider: Eip1193Provider | null = getInjectedProvider(walletId);
      if (!provider && walletId === "metamask" && WALLETCONNECT_PROJECT_ID) {
        const wcProvider = await EthereumProvider.init({
          projectId: WALLETCONNECT_PROJECT_ID,
          chains: [1],
          showQrModal: true,
          metadata: {
            name: "Investa Farm",
            description: "Connect a wallet to Investa Farm. No transaction will be sent.",
            url: window.location.origin,
            icons: [`${window.location.origin}/favicon.png`],
          },
        });
        if (!wcProvider.session) await wcProvider.connect();
        provider = wcProvider as unknown as Eip1193Provider;
      }

      if (!provider) {
        if (resume) return;
        openWalletBrowser(walletId);
        return;
      }

      const rawAccounts = await provider.request({
        method: resume ? "eth_accounts" : "eth_requestAccounts",
      });
      const address = Array.isArray(rawAccounts) && typeof rawAccounts[0] === "string"
        ? rawAccounts[0]
        : "";
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error("The wallet did not return a valid account. Unlock it and try again.");
      }

      const result = { address, walletId };
      setConnected(result);
      localStorage.setItem(CONNECTED_KEY, JSON.stringify(result));
      localStorage.removeItem(PENDING_KEY);
      onConnected?.(result);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not connect to that wallet.";
      setError(message);
      if (resume) localStorage.removeItem(PENDING_KEY);
    } finally {
      setBusyWallet(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    try {
      const pending = localStorage.getItem(PENDING_KEY);
      const saved = localStorage.getItem(CONNECTED_KEY);
      const candidate = pending ? JSON.parse(pending) : saved ? JSON.parse(saved) : null;
      if (!candidate || !WALLETS.some((wallet) => wallet.id === candidate.walletId)) return;
      if (pending && (!Number.isFinite(candidate.ts) || Date.now() - candidate.ts > 10 * 60 * 1000)) {
        localStorage.removeItem(PENDING_KEY);
        return;
      }
      const provider = getInjectedProvider(candidate.walletId);
      if (provider) void connect(candidate.walletId, true);
    } catch {
      localStorage.removeItem(PENDING_KEY);
    }
    // Only resume when the modal opens; connect() owns the current attempt state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          aria-label="Close wallet connection dialog"
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby="wallet-connect-title"
          data-testid="wallet-connect-modal"
          className="relative w-full max-w-[430px] rounded-t-3xl bg-background shadow-2xl"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
                <Wallet size={18} className="text-[#0052FF]" />
              </div>
              <div>
                <h3 id="wallet-connect-title" className="font-bold text-base text-foreground">
                  Connect another wallet
                </h3>
                <p className="text-xs text-muted-foreground">MetaMask or Binance Web3</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            >
              <X size={15} />
            </button>
          </div>

          <div className="space-y-3 px-5 py-4 pb-8">
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-800">
              Connecting only. Investa Farm will not request a payment or transaction.
            </div>
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            {connected && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
                <CheckCircle2 size={17} className="shrink-0 text-green-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-green-800">
                    Connected to {WALLETS.find((wallet) => wallet.id === connected.walletId)?.name}
                  </p>
                  <p className="truncate font-mono text-xs text-green-700">{connected.address}</p>
                </div>
              </div>
            )}

            {WALLETS.map((wallet) => (
              <button
                key={wallet.id}
                type="button"
                disabled={busyWallet !== null}
                onClick={() => void connect(wallet.id)}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${wallet.color}18` }}
                >
                  {wallet.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-foreground">{wallet.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{wallet.help}</span>
                </span>
                {busyWallet === wallet.id
                  ? <Loader2 size={16} className="animate-spin text-primary" />
                  : <ExternalLink size={14} className="text-muted-foreground" />}
              </button>
            ))}

            {connected && (
              <button
                type="button"
                onClick={() => {
                  setConnected(null);
                  localStorage.removeItem(CONNECTED_KEY);
                  onConnected?.(null);
                }}
                className="w-full rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground"
              >
                Disconnect wallet
              </button>
            )}
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
