/**
 * WalletConnectModal — in-app Web3 wallet connection for USDC payments
 *
 * HOW IT WORKS
 * ─────────────
 * All modern mobile wallets (MetaMask, Coinbase Wallet, Binance Web3) inject
 * `window.ethereum` when you load a page inside their built-in browser.
 * So the correct flow on mobile is:
 *   1. User taps their wallet → we redirect the CURRENT tab into that wallet's
 *      in-app browser (not a _blank tab) via its deep-link URL.
 *   2. The wallet loads Investa Farm; window.ethereum is now available.
 *   3. We auto-detect the flag set before redirect and auto-connect.
 *   4. User approves in-wallet → ERC-20 transfer sent → txHash returned.
 *
 * On desktop with a browser extension (MetaMask, Coinbase Wallet):
 *   window.ethereum is already injected → connect inline, no redirect needed.
 */
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Wallet, Copy, Check, AlertCircle, CheckCircle2,
  Loader2, ExternalLink, ArrowRight, Zap,
} from "lucide-react";

// ── USDC contract on Polygon Mainnet ──────────────────────────────────────────
const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const POLYGON_CHAIN_ID = "0x89"; // 137

// ── ERC-20 helpers (no ethers/web3 dependency) ───────────────────────────────
function encodeTransfer(to: string, usdcAmount: string): string {
  const selector = "a9059cbb"; // keccak256("transfer(address,uint256)")[0:4]
  const toHex = to.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
  const amt = BigInt(Math.round(parseFloat(usdcAmount) * 1_000_000)); // 6 decimals
  const amtHex = amt.toString(16).padStart(64, "0");
  return `0x${selector}${toHex}${amtHex}`;
}

async function getUsdcBalance(eth: any, address: string): Promise<string> {
  try {
    const addrHex = address.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
    const data = `0x70a08231${addrHex}`; // balanceOf(address)
    const result: string = await eth.request({
      method: "eth_call",
      params: [{ to: USDC_POLYGON, data }, "latest"],
    });
    if (!result || result === "0x" || result === "0x0") return "0.00";
    return (Number(BigInt(result)) / 1_000_000).toFixed(2);
  } catch {
    return "?.??";
  }
}

// ── Deep-link URLs that open THIS page inside each wallet's in-app browser ───
function walletBrowserLink(walletId: string): string {
  const host = window.location.hostname;
  if (walletId === "metamask") {
    // metamask.app.link/dapp/<host> opens the site in MetaMask's browser
    return `https://metamask.app.link/dapp/${host}`;
  }
  if (walletId === "coinbase") {
    // Coinbase Wallet universal link
    return `https://go.cb-wallet.io/wsegue?cb_url=${encodeURIComponent(window.location.href)}`;
  }
  if (walletId === "binance") {
    // Binance Web3 DApp browser
    return `https://www.binance.com/en/web3wallet?dapp=${encodeURIComponent(host)}`;
  }
  return window.location.href;
}

// ── Wallet catalogue ──────────────────────────────────────────────────────────
interface WalletDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
}

const WALLETS: WalletDef[] = [
  { id: "metamask",  name: "MetaMask",            emoji: "🦊", color: "#E2761B", description: "Browser extension or MetaMask Mobile" },
  { id: "coinbase",  name: "Coinbase Wallet",      emoji: "🔵", color: "#0052FF", description: "Coinbase Wallet app or browser extension" },
  { id: "binance",   name: "Binance Web3 Wallet",  emoji: "🟡", color: "#F3BA2F", description: "Send USDC from your Binance account" },
];

const LS_KEY = "investa_wallet_connect_pending";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface WalletConnectResult {
  address: string;
  walletId: string;
  txHash?: string;
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

type Step =
  | "select"
  | "connecting"
  | "connected"
  | "sending"
  | "sent"
  | "opening_app";

export function WalletConnectModal({
  open, onClose, depositAddress, amountUSDC, chain, memo, onConnected,
}: Props) {
  const [step, setStep] = useState<Step>("select");
  const [selectedWallet, setSelectedWallet] = useState<WalletDef | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const eth = typeof window !== "undefined" ? (window as any).ethereum : null;
  const hasProvider = !!eth;

  // Detect which wallet injected window.ethereum
  const injectedName = eth?.isMetaMask ? "MetaMask"
    : eth?.isCoinbaseWallet ? "Coinbase Wallet"
    : eth?.isBinance ? "Binance Web3"
    : hasProvider ? "Web3 Wallet"
    : null;

  // Auto-connect if we were redirected from a wallet browser
  useEffect(() => {
    if (!open) return;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
      const { walletId, ts } = JSON.parse(raw);
      if (Date.now() - ts < 5 * 60 * 1000 && eth) {
        localStorage.removeItem(LS_KEY);
        const w = WALLETS.find(x => x.id === walletId);
        if (w) { setSelectedWallet(w); void connectInApp(w); }
      }
    } catch { localStorage.removeItem(LS_KEY); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      setStep("select"); setError(null); setConnectedAddress(null);
      setUsdcBalance(null); setTxHash(null); setSelectedWallet(null);
    }
  }, [open]);

  // ── Connect via injected provider ──────────────────────────────────────────
  async function connectInApp(wallet: WalletDef) {
    setSelectedWallet(wallet);
    setStep("connecting");
    setError(null);
    try {
      if (!eth) throw new Error("No Web3 provider detected.");

      // Request accounts
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts[0]) throw new Error("No accounts returned");
      const address = accounts[0];

      // Switch to Polygon
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: POLYGON_CHAIN_ID }] });
      } catch (sw: any) {
        if (sw?.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: POLYGON_CHAIN_ID,
              chainName: "Polygon Mainnet",
              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
              rpcUrls: ["https://polygon-rpc.com/"],
              blockExplorerUrls: ["https://polygonscan.com/"],
            }],
          });
        }
        // ignore other switch errors — user may decline network switch
      }

      // Fetch USDC balance
      const bal = await getUsdcBalance(eth, address);
      setConnectedAddress(address);
      setUsdcBalance(bal);
      setStep("connected");
      onConnected?.({ address, walletId: wallet.id });
    } catch (err: any) {
      setError(err?.message ?? "Connection failed");
      setStep("select");
    }
  }

  // ── Send ERC-20 transfer ───────────────────────────────────────────────────
  async function sendUsdcTx() {
    if (!eth || !connectedAddress || !depositAddress) return;
    setStep("sending");
    setError(null);
    try {
      const data = encodeTransfer(depositAddress, amountUSDC);
      const hash: string = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: connectedAddress,
          to: USDC_POLYGON,
          data,
          // Let MetaMask estimate gas
        }],
      });
      setTxHash(hash);
      setStep("sent");
      onConnected?.({ address: connectedAddress, walletId: selectedWallet?.id ?? "unknown", txHash: hash });
    } catch (err: any) {
      setError(err?.message ?? "Transaction failed or was rejected");
      setStep("connected");
    }
  }

  // ── Open wallet's in-app browser ──────────────────────────────────────────
  function openWalletBrowser(wallet: WalletDef) {
    localStorage.setItem(LS_KEY, JSON.stringify({ walletId: wallet.id, ts: Date.now() }));
    setSelectedWallet(wallet);
    setStep("opening_app");
    // Navigate the CURRENT tab (not _blank) — mobile deep link
    window.location.href = walletBrowserLink(wallet.id);
  }

  // ── Copy helpers ──────────────────────────────────────────────────────────
  async function copyText(text: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
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
          style={{ maxHeight: "92dvh" }}
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
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Wallet size={18} className="text-[#0052FF]" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Connect Wallet</h3>
                <p className="text-muted-foreground text-xs">Send {amountUSDC} USDC on {chain}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <X size={15} />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 pb-8 space-y-4">
            {/* Amount chip */}
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
              <div>
                <p className="text-blue-700 text-xs font-semibold">Amount to send</p>
                <p className="text-blue-900 font-black text-xl">{amountUSDC} USDC</p>
              </div>
              <div className="text-right">
                <p className="text-blue-600 text-xs">{chain}</p>
                {memo && <p className="text-blue-700 font-mono text-xs mt-0.5">Memo: {memo}</p>}
              </div>
            </div>

            {/* Injected provider badge */}
            {injectedName && step === "select" && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                <p className="text-green-700 text-xs font-semibold">{injectedName} detected — you can connect directly</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-xs">{error}</p>
              </div>
            )}

            {/* ── STEP: SELECT ─────────────────────────────────────────── */}
            {step === "select" && (
              <div className="space-y-2.5">
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Choose your wallet</p>

                {WALLETS.map(w => (
                  <button
                    key={w.id}
                    onClick={() => hasProvider ? connectInApp(w) : openWalletBrowser(w)}
                    className="w-full flex items-center gap-3.5 p-4 rounded-2xl border border-border bg-background hover:bg-muted/40 active:scale-[0.98] transition-all"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: `${w.color}18` }}
                    >
                      {w.emoji}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-foreground font-bold text-sm">{w.name}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{w.description}</p>
                    </div>
                    {hasProvider ? (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                        Connect
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                        Open <ExternalLink size={8} />
                      </span>
                    )}
                  </button>
                ))}

                {/* Manual fallback */}
                <div className="pt-3 border-t border-border">
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">Or send manually</p>
                  <div className="bg-muted/50 rounded-xl p-3 flex items-center gap-2">
                    <p className="text-foreground font-mono text-xs flex-1 break-all leading-relaxed">{depositAddress}</p>
                    <button onClick={() => copyText(depositAddress)} className="flex-shrink-0 w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center">
                      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} className="text-muted-foreground" />}
                    </button>
                  </div>
                  {memo && <p className="text-amber-600 text-[10px] mt-1.5 font-medium">Include memo: <strong>{memo}</strong></p>}
                </div>
              </div>
            )}

            {/* ── STEP: CONNECTING ─────────────────────────────────────── */}
            {step === "connecting" && (
              <div className="py-8 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                  style={{ background: `${selectedWallet?.color ?? "#6366F1"}18` }}>
                  {selectedWallet?.emoji}
                </div>
                <div>
                  <p className="text-foreground font-bold">Connecting to {selectedWallet?.name}</p>
                  <p className="text-muted-foreground text-sm mt-1">Approve the connection in your wallet…</p>
                </div>
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            )}

            {/* ── STEP: CONNECTED ──────────────────────────────────────── */}
            {step === "connected" && connectedAddress && (
              <div className="space-y-4">
                {/* Wallet card */}
                <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${selectedWallet?.color ?? "#6366F1"}22, ${selectedWallet?.color ?? "#6366F1"}08)`, border: `1px solid ${selectedWallet?.color ?? "#6366F1"}30` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
                      style={{ background: `${selectedWallet?.color ?? "#6366F1"}20` }}>
                      {selectedWallet?.emoji}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{selectedWallet?.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <p className="text-green-600 text-xs font-semibold">Connected</p>
                      </div>
                    </div>
                    <CheckCircle2 size={20} className="text-green-600 ml-auto" />
                  </div>
                  <div className="space-y-2">
                    <div className="bg-background/70 rounded-xl p-2.5 flex items-center justify-between">
                      <p className="text-muted-foreground text-[11px]">Address</p>
                      <p className="text-foreground font-mono text-xs font-semibold">
                        {connectedAddress.slice(0, 6)}…{connectedAddress.slice(-4)}
                      </p>
                    </div>
                    <div className="bg-background/70 rounded-xl p-2.5 flex items-center justify-between">
                      <p className="text-muted-foreground text-[11px]">USDC Balance (Polygon)</p>
                      <p className="text-foreground font-bold text-sm">{usdcBalance ?? "…"} USDC</p>
                    </div>
                  </div>
                </div>

                {/* Send instruction */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
                  <p className="text-blue-800 font-bold text-sm">Send {amountUSDC} USDC to:</p>
                  <div className="bg-white rounded-xl border border-blue-200 p-2.5 flex items-center gap-2">
                    <p className="text-foreground font-mono text-xs flex-1 break-all">{depositAddress}</p>
                    <button onClick={() => copyText(depositAddress)} className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      {copied ? <Check size={12} className="text-[#1652F0]" /> : <Copy size={12} className="text-[#1652F0]" />}
                    </button>
                  </div>
                  {memo && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2">
                      <p className="text-amber-700 text-xs"><strong>⚠ Memo required:</strong> {memo}</p>
                    </div>
                  )}
                </div>

                {usdcBalance !== null && parseFloat(usdcBalance) < parseFloat(amountUSDC) && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                    <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-xs">Insufficient USDC balance ({usdcBalance} USDC). You need {amountUSDC} USDC.</p>
                  </div>
                )}

                <button
                  onClick={sendUsdcTx}
                  disabled={usdcBalance !== null && parseFloat(usdcBalance) < parseFloat(amountUSDC)}
                  className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#1652F0,#2D56FA)", boxShadow: "0 6px 20px rgba(22,82,240,0.35)" }}
                >
                  <Zap size={16} />
                  Send {amountUSDC} USDC via {selectedWallet?.name}
                </button>

                <button onClick={() => setStep("select")} className="w-full text-muted-foreground text-xs font-medium underline underline-offset-2">
                  ← Use a different wallet
                </button>
              </div>
            )}

            {/* ── STEP: SENDING ────────────────────────────────────────── */}
            {step === "sending" && (
              <div className="py-8 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                  style={{ background: `${selectedWallet?.color ?? "#6366F1"}18` }}>
                  {selectedWallet?.emoji}
                </div>
                <div>
                  <p className="text-foreground font-bold">Approve in {selectedWallet?.name}</p>
                  <p className="text-muted-foreground text-sm mt-1">Check your wallet for the transaction prompt…</p>
                </div>
                <Loader2 size={24} className="animate-spin text-[#1652F0]" />
                <p className="text-muted-foreground text-xs">Sending {amountUSDC} USDC on Polygon</p>
              </div>
            )}

            {/* ── STEP: SENT ───────────────────────────────────────────── */}
            {step === "sent" && txHash && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                  <CheckCircle2 size={40} className="text-green-600 mx-auto mb-3" />
                  <p className="text-green-800 font-bold text-base">Transaction Sent!</p>
                  <p className="text-green-700 text-xs mt-1">Your USDC is on its way. We'll verify and credit your KES wallet.</p>
                </div>

                <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Transaction Hash</p>
                  <div className="flex items-center gap-2">
                    <p className="text-foreground font-mono text-xs flex-1 break-all">{txHash}</p>
                    <button onClick={() => copyText(txHash)} className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center flex-shrink-0">
                      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                <a
                  href={`https://polygonscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-blue-600 text-xs font-semibold"
                >
                  View on PolygonScan <ExternalLink size={11} />
                </a>

                <button
                  onClick={onClose}
                  className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-transform text-sm flex items-center justify-center gap-2"
                >
                  <ArrowRight size={16} /> Back to Confirm Payment
                </button>
              </div>
            )}

            {/* ── STEP: OPENING WALLET APP ─────────────────────────────── */}
            {step === "opening_app" && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto"
                  style={{ background: `${selectedWallet?.color ?? "#6366F1"}18` }}>
                  {selectedWallet?.emoji}
                </div>
                <div>
                  <p className="text-foreground font-bold text-base">Opening {selectedWallet?.name}</p>
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                    {selectedWallet?.name} will open and load Investa Farm inside its browser.
                    The wallet will connect automatically — you won't leave the app.
                  </p>
                </div>

                <div className="bg-muted/60 rounded-2xl p-4 text-left space-y-2">
                  {[
                    `${selectedWallet?.name} opens and loads this page`,
                    "Tap Connect Wallet → your wallet",
                    "Approve the connection",
                    "Send USDC with one tap — all within the app",
                  ].map((t, i) => (
                    <div key={t} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                      <p className="text-foreground text-xs font-medium">{t}</p>
                    </div>
                  ))}
                </div>

                <a
                  href={walletBrowserLink(selectedWallet?.id ?? "metamask")}
                  className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                  style={{ background: `${selectedWallet?.color ?? "#6366F1"}` }}
                  onClick={() => {
                    localStorage.setItem(LS_KEY, JSON.stringify({ walletId: selectedWallet?.id, ts: Date.now() }));
                  }}
                >
                  Open {selectedWallet?.name} <ExternalLink size={14} />
                </a>

                <button
                  onClick={() => { if (eth) connectInApp(selectedWallet!); else setStep("select"); }}
                  className="w-full py-3 rounded-2xl border-2 border-border text-foreground font-semibold text-sm active:scale-95"
                >
                  {eth ? "Already in wallet browser — Connect Now" : "← Choose a different wallet"}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
