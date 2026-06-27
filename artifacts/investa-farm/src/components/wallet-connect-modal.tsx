/**
 * WalletConnectModal — Multi-wallet popup for USDC payments
 * Supports: MetaMask, Trust Wallet, WalletConnect, Coinbase Wallet
 * Works on mobile via deep links + on desktop via window.ethereum
 */
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, Copy, Check, ExternalLink, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface WalletInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  deepLink?: (address: string, amount: string, chain: string) => string;
  description: string;
}

const BinanceIcon = () => (
  <svg width="24" height="24" viewBox="0 0 126.61 126.61" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g fill="#F3BA2F">
      <path d="M38.73 53.2L63.3 28.58l24.58 24.63 14.3-14.3L63.3 0 24.43 38.9z"/>
      <path d="M0 63.31l14.3-14.31 14.31 14.31-14.31 14.3z"/>
      <path d="M38.73 73.41L63.3 98 87.88 73.41l14.31 14.28-.05.05L63.3 126.61l-38.87-38.9-.17-.17z"/>
      <path d="M98 63.31l14.3-14.31 14.31 14.3-14.31 14.32z"/>
      <path d="M77.83 63.3l-14.53-14.54-10.73 10.74-1.24 1.23-2.55 2.56 14.52 14.52 14.53-14.51z"/>
    </g>
  </svg>
);

const WALLETS: WalletInfo[] = [
  {
    id: "binance",
    name: "Binance Web3 Wallet",
    icon: "binance",
    color: "#F3BA2F",
    deepLink: (addr: string, amt: string) =>
      `bnc://app.binance.com/payment/pay?to=${addr}&amount=${amt}&symbol=USDC`,
    description: "Send USDC directly from your Binance account",
  },
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    color: "#E2761B",
    description: "Browser extension or MetaMask Mobile",
  },
  {
    id: "others",
    name: "Others (Manual Send)",
    icon: "🔗",
    color: "#6366F1",
    description: "Trust Wallet, Coinbase, Phantom, or any USDC wallet",
  },
];

export interface WalletConnectResult {
  address: string;
  walletId: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  depositAddress: string;
  amountUSDC: string;
  chain: string;
  memo?: string;
  onConnected?: (result: WalletConnectResult) => void;
}

export function WalletConnectModal({ open, onClose, depositAddress, amountUSDC, chain, memo, onConnected }: Props) {
  const [step, setStep] = useState<"select" | "metamask" | "deeplink" | "qr">("select");
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasMetaMask = typeof window !== "undefined" && !!(window as any).ethereum;

  useEffect(() => {
    if (!open) { setStep("select"); setError(null); setConnectedAddress(null); }
  }, [open]);

  async function connectMetaMask() {
    setConnecting(true); setError(null);
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error("MetaMask not detected. Install MetaMask or use MetaMask Mobile.");

      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts[0]) throw new Error("No accounts found");
      const address = accounts[0];
      setConnectedAddress(address);
      onConnected?.({ address, walletId: "metamask" });

      // Try to switch to Polygon network
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x89" }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x89",
              chainName: "Polygon Mainnet",
              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
              rpcUrls: ["https://polygon-rpc.com/"],
              blockExplorerUrls: ["https://polygonscan.com/"],
            }],
          });
        }
      }
      setStep("metamask");
    } catch (err: any) {
      setError(err.message ?? "Connection failed");
    } finally { setConnecting(false); }
  }

  function handleDeepLink(wallet: WalletInfo) {
    setSelectedWallet(wallet);
    if (wallet.deepLink) {
      const link = wallet.deepLink(depositAddress, amountUSDC, chain);
      window.location.href = link;
    }
    setStep("deeplink");
  }

  function handleWalletConnect() {
    setSelectedWallet(WALLETS.find(w => w.id === "walletconnect") ?? null);
    setStep("qr");
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(depositAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-end justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl overflow-hidden"
          style={{ maxHeight: "90dvh" }}
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
                <Wallet size={18} className="text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Connect Wallet</h3>
                <p className="text-muted-foreground text-xs">Pay with USDC on {chain}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <X size={15} className="text-foreground" />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 pb-8">
            {/* Amount chip */}
            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3 mb-4">
              <div>
                <p className="text-purple-700 text-xs font-semibold">Amount to send</p>
                <p className="text-purple-900 font-black text-xl">{amountUSDC} USDC</p>
              </div>
              <div className="text-right">
                <p className="text-purple-600 text-xs">{chain} Network</p>
                {memo && <p className="text-purple-700 font-mono text-xs mt-0.5">Memo: {memo}</p>}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 mb-4">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-xs">{error}</p>
              </div>
            )}

            {/* Step: select wallet */}
            {step === "select" && (
              <div className="space-y-2.5">
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Choose your wallet</p>

                {WALLETS.map(wallet => (
                  <button
                    key={wallet.id}
                    onClick={() => {
                      if (wallet.id === "metamask") {
                        if (hasMetaMask) connectMetaMask();
                        else {
                          const deepLink = `https://metamask.app.link/dapp/app.investafarm.com`;
                          window.open(deepLink, "_blank");
                          setSelectedWallet(wallet);
                          setStep("deeplink");
                        }
                      } else if (wallet.id === "others") {
                        setSelectedWallet(wallet);
                        setStep("deeplink");
                      } else {
                        handleDeepLink(wallet);
                      }
                    }}
                    disabled={connecting}
                    className="w-full flex items-center gap-3.5 p-4 rounded-2xl border border-border bg-background hover:bg-muted/40 active:scale-[0.98] transition-all"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: `${wallet.color}18` }}
                    >
                      {wallet.icon === "binance" ? <BinanceIcon /> : wallet.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-foreground font-bold text-sm">{wallet.name}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{wallet.description}</p>
                    </div>
                    {wallet.id === "metamask" && hasMetaMask && (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Detected</span>
                    )}
                    {connecting && wallet.id === "metamask" && (
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    )}
                  </button>
                ))}

                {/* Manual copy option */}
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">Or send manually</p>
                  <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2">
                    <p className="text-foreground font-mono text-xs flex-1 break-all leading-relaxed">{depositAddress}</p>
                    <button onClick={copyAddress} className="flex-shrink-0 w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center">
                      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} className="text-muted-foreground" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step: MetaMask connected */}
            {step === "metamask" && connectedAddress && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                  <CheckCircle2 size={36} className="text-green-600 mx-auto mb-2" />
                  <p className="text-green-800 font-bold text-sm">MetaMask Connected!</p>
                  <p className="text-green-600 text-xs mt-1 font-mono">{connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-foreground font-semibold text-sm">Send {amountUSDC} USDC to:</p>
                  <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2">
                    <p className="text-foreground font-mono text-xs flex-1 break-all">{depositAddress}</p>
                    <button onClick={copyAddress} className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center">
                      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} className="text-muted-foreground" />}
                    </button>
                  </div>
                  {memo && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                      <p className="text-amber-700 text-xs"><strong>Memo:</strong> {memo} (required)</p>
                    </div>
                  )}
                </div>

                <a
                  href={`https://polygonscan.com/address/${depositAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-purple-600 text-xs font-semibold"
                >
                  View on PolygonScan <ExternalLink size={11} />
                </a>

                <button onClick={onClose}
                  className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-transform text-sm">
                  I've Sent — Back to Confirm
                </button>
              </div>
            )}

            {/* Step: Deep link sent */}
            {step === "deeplink" && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: `${selectedWallet?.color ?? "#6366F1"}18` }}>
                  {selectedWallet?.icon === "binance"
                    ? <BinanceIcon />
                    : <span className="text-3xl">{selectedWallet?.icon}</span>}
                </div>
                <div>
                  <p className="text-foreground font-bold text-base">Opening {selectedWallet?.name}</p>
                  <p className="text-muted-foreground text-sm mt-1">If the app didn't open, send manually to:</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2 text-left">
                  <p className="text-foreground font-mono text-xs flex-1 break-all">{depositAddress}</p>
                  <button onClick={copyAddress} className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center">
                    {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} className="text-muted-foreground" />}
                  </button>
                </div>
                {memo && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-left">
                    <p className="text-amber-700 text-xs"><strong>Important — Include Memo:</strong> {memo}</p>
                  </div>
                )}
                <button onClick={() => setStep("select")} className="w-full border border-border text-foreground font-semibold py-3 rounded-2xl text-sm active:scale-95">
                  ← Try Another Wallet
                </button>
              </div>
            )}

            {/* Step: WalletConnect QR */}
            {step === "qr" && (
              <div className="space-y-4 text-center">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <p className="text-blue-800 font-bold text-sm mb-2">WalletConnect</p>
                  <p className="text-blue-600 text-xs mb-3">Open any WalletConnect-compatible wallet and scan the QR code, or copy the deposit address below.</p>
                  {/* Simulated QR placeholder */}
                  <div className="w-40 h-40 bg-white rounded-xl border-2 border-blue-200 mx-auto flex items-center justify-center mb-2">
                    <div className="grid grid-cols-8 gap-0.5 p-2 w-full h-full">
                      {Array.from({ length: 64 }).map((_, i) => (
                        <div key={i} className="rounded-[1px]" style={{ background: Math.random() > 0.5 ? "#1e3a5f" : "transparent" }} />
                      ))}
                    </div>
                  </div>
                  <p className="text-blue-600 text-[10px]">Scan with Trust Wallet, Rainbow, Argent, or any WC wallet</p>
                </div>

                <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2 text-left">
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider mr-2">Address</p>
                  <p className="text-foreground font-mono text-xs flex-1 break-all">{depositAddress}</p>
                  <button onClick={copyAddress} className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center">
                    {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} className="text-muted-foreground" />}
                  </button>
                </div>

                <button onClick={() => setStep("select")} className="w-full border border-border text-foreground font-semibold py-3 rounded-2xl text-sm active:scale-95">
                  ← Back
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
