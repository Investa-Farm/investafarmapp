/**
 * AiAgentModal — conversational AI investment assistant
 *
 * User chats naturally ("invest 20k for 3 months") → agent confirms
 * parameters → user taps Confirm → agent places investments automatically
 * and streams results back as chat messages.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Bot, Send, CheckCircle2, Loader2, TrendingUp,
  AlertCircle, Zap, ChevronRight, Mic, MicOff,
} from "lucide-react";
import { formatKES, getToken } from "@/lib/auth";
import { getCropImage } from "@/lib/crops";
import { useLocation } from "wouter";
import { nonceHeaders } from "@/lib/nonce";
import { useQueryClient } from "@tanstack/react-query";
import { getListPrimaryMarketQueryKey } from "@workspace/api-client-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface InvestAction {
  type: "invest";
  budget: number;
  months: number;
  risk: "low" | "medium" | "high";
  maxFarms: number;
}

interface InvestResult {
  farmName: string;
  cropType: string;
  shares: number;
  total: number;
  aiReason: string;
  confidence: number;
  status: "done" | "failed";
}

type MessageRole = "user" | "bot";
interface Message {
  id: number;
  role: MessageRole;
  text: string;
  action?: InvestAction;           // pending confirmation
  results?: InvestResult[];        // investment results
  isTyping?: boolean;
  isError?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const RISK_LABELS: Record<string, string> = {
  low: "🛡️ Conservative",
  medium: "⚖️ Balanced",
  high: "🚀 Aggressive",
};

const EXIT_LABEL = (months: number) =>
  months <= 3 ? "Wide Season (~45 days)" : "Full Season (~6 mo)";

const EXIT_TYPE = (months: number): "wide_season" | "full_season" =>
  months <= 3 ? "wide_season" : "full_season";

let msgId = 0;
const nextId = () => ++msgId;

const GREETINGS = [
  "Hey! I'm Investa 🌿 — your AI investment assistant. Tell me how much you'd like to invest and for how long, and I'll pick the best farms for you.",
  "Hi there! I'm Investa, your AI farm advisor 🌱. Just say something like \"invest 20,000 for 3 months\" and I'll handle the rest.",
];

// ── Props ──────────────────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void; }

// ── Component ──────────────────────────────────────────────────────────────
export function AiAgentModal({ open, onClose }: Props) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const token = getToken();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isInvesting, setIsInvesting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<number | null>(null);
  const [listening, setListening] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Greet on open
  useEffect(() => {
    if (!open) return;
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]!;
    setMessages([{ id: nextId(), role: "bot", text: greeting }]);
    setInput("");
    setIsSending(false);
    setIsInvesting(false);
    setPendingActionId(null);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // ── Add a bot message ─────────────────────────────────────────────────
  const addBot = useCallback(
    (text: string, extras: Partial<Message> = {}) => {
      const id = nextId();
      // Show typing indicator first
      setMessages(prev => [...prev, { id, role: "bot", text: "", isTyping: true }]);
      setTimeout(() => {
        setMessages(prev =>
          prev.map(m => m.id === id ? { ...m, text, isTyping: false, ...extras } : m)
        );
      }, 600);
      return id;
    },
    []
  );

  // ── Send a user message ────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending || isInvesting) return;
      const userMsg: Message = { id: nextId(), role: "user", text: text.trim() };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      setIsSending(true);

      // Check if user is confirming a pending action
      const confirmWords = /^(yes|go|do it|confirm|ok|sure|proceed|yep|yeah|invest|execute|run)\b/i;
      const denyWords = /^(no|cancel|stop|nope|don't|never|back)\b/i;

      if (pendingActionId !== null) {
        if (confirmWords.test(text.trim())) {
          setIsSending(false);
          // Find the pending action
          const pending = messages.find(m => m.id === pendingActionId);
          if (pending?.action) {
            runInvestment(pending.action);
          }
          setPendingActionId(null);
          return;
        }
        if (denyWords.test(text.trim())) {
          setPendingActionId(null);
          setIsSending(false);
          addBot("No problem! Let me know if you'd like to adjust the budget, time period, or risk level.");
          return;
        }
      }

      try {
        // Build conversation history for Groq context
        const history = messages
          .filter(m => !m.isTyping)
          .map(m => ({ role: m.role === "user" ? "user" : "assistant" as const, content: m.text }))
          .slice(-8);

        const r = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: text.trim(), history }),
        });

        if (!r.ok) throw new Error(`Server error ${r.status}`);
        const data = await r.json() as { reply: string; action?: InvestAction | null };

        const id = nextId();
        setMessages(prev => [...prev, { id, role: "bot", text: "", isTyping: true }]);

        setTimeout(() => {
          setMessages(prev =>
            prev.map(m =>
              m.id === id
                ? { ...m, text: data.reply, isTyping: false, action: data.action ?? undefined }
                : m
            )
          );
          if (data.action) setPendingActionId(id);
        }, 600);
      } catch {
        addBot("Sorry, I couldn't connect right now. Please try again.", { isError: true });
      } finally {
        setIsSending(false);
      }
    },
    [isSending, isInvesting, messages, pendingActionId, token, addBot]
  );

  // ── Run investment from a confirmed action ─────────────────────────────
  const runInvestment = useCallback(
    async (action: InvestAction) => {
      setIsInvesting(true);
      const typingId = nextId();
      setMessages(prev => [...prev, { id: typingId, role: "bot", text: "", isTyping: true }]);

      try {
        // 1. Fetch listings
        const listingsResp = await fetch("/api/market/primary", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!listingsResp.ok) throw new Error("Could not load market listings.");
        const raw = await listingsResp.json();
        const listings: any[] = (Array.isArray(raw) ? raw : raw.listings ?? [])
          .filter((l: any) => l.sharesAvailable > 0);
        if (!listings.length) throw new Error("No active farm listings right now. Try again later.");

        // 2. AI scoring
        const scoreResp = await fetch("/api/agent/score", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            listings,
            risk: action.risk,
            budget: action.budget,
            maxFarms: action.maxFarms,
          }),
        });
        if (!scoreResp.ok) throw new Error("AI scoring unavailable.");
        const { selected } = await scoreResp.json() as {
          selected: Array<{ id: number; reason: string; confidence: number; suggestedShares: number; suggestedAmount: number }>;
        };
        if (!selected?.length) throw new Error("AI couldn't find suitable farms for your parameters.");

        // Replace typing indicator with "starting" message
        setMessages(prev =>
          prev.map(m =>
            m.id === typingId
              ? { ...m, text: `Found ${selected.length} farm${selected.length !== 1 ? "s" : ""}. Placing investments now…`, isTyping: false }
              : m
          )
        );
        await new Promise(r => setTimeout(r, 400));

        // 3. Place each investment
        const results: InvestResult[] = [];
        const exitType = EXIT_TYPE(action.months);

        for (const sel of selected) {
          const listing = listings.find((l: any) => l.id === sel.id);
          if (!listing) continue;

          // "Investing…" indicator per farm
          const farmTypingId = nextId();
          setMessages(prev => [
            ...prev,
            { id: farmTypingId, role: "bot", text: "", isTyping: true },
          ]);
          await new Promise(r => setTimeout(r, 350));

          let status: "done" | "failed" = "failed";
          try {
            const buyResp = await fetch("/api/market/buy", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...nonceHeaders(),
              },
              body: JSON.stringify({
                listingId: listing.id,
                quantity: sel.suggestedShares,
                exitType,
              }),
            });
            if (buyResp.ok) status = "done";
          } catch {}

          const result: InvestResult = {
            farmName: listing.farmName,
            cropType: listing.cropType,
            shares: sel.suggestedShares,
            total: sel.suggestedAmount,
            aiReason: sel.reason,
            confidence: sel.confidence,
            status,
          };
          results.push(result);

          // Replace typing with result card
          setMessages(prev =>
            prev.map(m =>
              m.id === farmTypingId
                ? { ...m, text: "", isTyping: false, results: [result] }
                : m
            )
          );
          await new Promise(r => setTimeout(r, 200));
        }

        const succeeded = results.filter(r => r.status === "done");
        const totalSpent = succeeded.reduce((s, r) => s + r.total, 0);

        // Invalidate caches
        qc.invalidateQueries({ queryKey: getListPrimaryMarketQueryKey() });
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["portfolio-summary"] });

        if (succeeded.length === 0) {
          addBot("I couldn't place any investments — your wallet balance may be too low or listings sold out. Please top up and try again.", { isError: true });
        } else {
          addBot(
            `✅ Done! I invested ${formatKES(totalSpent)} across ${succeeded.length} farm${succeeded.length !== 1 ? "s" : ""}. Check your portfolio to track returns.`
          );
        }
      } catch (e: any) {
        setMessages(prev => prev.filter(m => m.id !== typingId));
        addBot(e.message ?? "Something went wrong. Please try again.", { isError: true });
      } finally {
        setIsInvesting(false);
      }
    },
    [token, qc, addBot]
  );

  // ── Tap confirm button on action card ─────────────────────────────────
  const handleConfirm = useCallback(
    (action: InvestAction, msgId: number) => {
      setPendingActionId(null);
      // Dismiss the action card
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, action: undefined } : m));
      runInvestment(action);
    },
    [runInvestment]
  );

  // ── Voice input (best-effort, no crash if unavailable) ────────────────
  const toggleVoice = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-KE";
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const txt = e.results[0]?.[0]?.transcript ?? "";
      if (txt) setInput(txt);
    };
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }, [listening]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const hasPending = pendingActionId !== null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={!isInvesting ? onClose : undefined}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl flex flex-col"
            style={{ height: "88dvh" }}
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div
              className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0 rounded-t-3xl"
              style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 60%, #16a34a 100%)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <Bot size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">Investa AI</p>
                  <p className="text-green-200 text-[10px]">
                    {isInvesting ? "Placing investments…" : isSending ? "Thinking…" : "Your investment assistant"}
                  </p>
                </div>
              </div>
              {!isInvesting && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20"
                >
                  <X size={14} className="text-white" />
                </button>
              )}
            </div>

            {/* ── Messages ───────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: "none" }}>
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {/* Bot avatar */}
                    {msg.role === "bot" && (
                      <div className="w-7 h-7 rounded-full flex-shrink-0 mr-2 mt-0.5 flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #052e16, #16a34a)" }}>
                        <Bot size={13} className="text-white" />
                      </div>
                    )}

                    <div className={`max-w-[82%] ${msg.role === "user" ? "" : "space-y-2"}`}>

                      {/* Typing indicator */}
                      {msg.isTyping && (
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 inline-flex items-center gap-1">
                          {[0, 1, 2].map(i => (
                            <motion.div key={i}
                              className="w-1.5 h-1.5 rounded-full bg-green-600"
                              animate={{ y: [0, -4, 0] }}
                              transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Text bubble */}
                      {!msg.isTyping && msg.text && (
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "text-white rounded-tr-sm"
                            : msg.isError
                              ? "bg-red-50 border border-red-200 text-red-700 rounded-tl-sm"
                              : "bg-muted text-foreground rounded-tl-sm"
                        }`}
                          style={msg.role === "user"
                            ? { background: "linear-gradient(135deg, #14532d, #16a34a)" }
                            : undefined}
                        >
                          {msg.text}
                        </div>
                      )}

                      {/* Investment action confirm card — only show for the active pending message */}
                      {msg.action && !msg.isTyping && msg.id === pendingActionId && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="rounded-2xl border-2 overflow-hidden"
                          style={{ borderColor: "#16a34a" }}
                        >
                          {/* Card header */}
                          <div className="px-4 py-3 flex items-center gap-2"
                            style={{ background: "linear-gradient(135deg, #052e16, #14532d)" }}>
                            <Zap size={14} className="text-green-300" />
                            <p className="text-white text-xs font-bold">Investment Plan</p>
                          </div>
                          {/* Details */}
                          <div className="bg-background px-4 py-3 space-y-1.5">
                            {[
                              ["Budget",    formatKES(msg.action.budget)],
                              ["Duration",  EXIT_LABEL(msg.action.months)],
                              ["Risk",      RISK_LABELS[msg.action.risk] ?? msg.action.risk],
                              ["Farms",     `Up to ${msg.action.maxFarms}`],
                            ].map(([label, val]) => (
                              <div key={label} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-semibold text-foreground">{val}</span>
                              </div>
                            ))}
                          </div>
                          {/* Confirm / cancel */}
                          <div className="px-4 pb-4 pt-2 flex gap-2 bg-background">
                            <button
                              onClick={() => handleConfirm(msg.action!, msg.id)}
                              className="flex-1 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                              style={{ background: "linear-gradient(135deg, #14532d, #16a34a)" }}
                            >
                              <Zap size={13} /> Confirm & Invest
                            </button>
                            <button
                              onClick={() => {
                                setPendingActionId(null);
                                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, action: undefined } : m));
                                addBot("No problem — let me know if you'd like to change the amount, time, or risk level.");
                              }}
                              className="px-3 py-2.5 rounded-xl bg-muted text-muted-foreground text-xs font-semibold active:scale-95 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {/* Investment result cards */}
                      {msg.results?.map((r, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className={`rounded-2xl border overflow-hidden ${
                            r.status === "done" ? "border-green-200 bg-green-50/40" : "border-red-200 bg-red-50/30"
                          }`}>
                          <div className="flex items-center gap-3 p-3">
                            <div className="relative flex-shrink-0">
                              <img src={getCropImage(r.cropType)} alt={r.cropType}
                                className="w-11 h-11 rounded-xl object-cover" />
                              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center ${
                                r.status === "done" ? "bg-green-500" : "bg-red-500"
                              }`}>
                                {r.status === "done"
                                  ? <CheckCircle2 size={10} className="text-white" />
                                  : <X size={9} className="text-white" />}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">{r.farmName}</p>
                              <p className="text-muted-foreground text-[10px]">{r.cropType} · {r.shares} shares</p>
                              <p className="text-muted-foreground/70 text-[9px] italic mt-0.5 line-clamp-1">🤖 {r.aiReason}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`font-bold text-sm ${r.status === "failed" ? "text-red-500 line-through" : "text-foreground"}`}>
                                {formatKES(r.total)}
                              </p>
                              {r.status === "done" && (
                                <p className="text-green-600 text-[9px] font-bold flex items-center justify-end gap-0.5 mt-0.5">
                                  <TrendingUp size={8} /> {r.confidence}% conf.
                                </p>
                              )}
                            </div>
                          </div>
                          {/* Confidence bar */}
                          <div className="px-3 pb-2.5">
                            <div className="h-1 bg-border rounded-full overflow-hidden">
                              <motion.div className="h-full rounded-full bg-green-500"
                                initial={{ width: 0 }} animate={{ width: `${r.confidence}%` }}
                                transition={{ duration: 0.6 }} />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Quick suggestions (when idle, no pending action) */}
              {messages.length === 1 && !isSending && (
                <div className="flex flex-wrap gap-2 pl-9">
                  {[
                    "Invest 10,000 for 3 months",
                    "Low risk, 6 months",
                    "How do returns work?",
                    "What's the minimum?",
                  ].map(s => (
                    <button key={s}
                      onClick={() => sendMessage(s)}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-full border border-green-600/30 text-green-700 bg-green-50 hover:bg-green-100 active:scale-95 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* View Portfolio CTA after done */}
              {messages.some(m => m.results?.some(r => r.status === "done")) && !isInvesting && (
                <div className="flex justify-center pl-9">
                  <button
                    onClick={() => { onClose(); setLocation("/portfolio"); }}
                    className="text-xs font-bold text-white px-5 py-2.5 rounded-full flex items-center gap-1.5 active:scale-95 transition-all shadow-md"
                    style={{ background: "linear-gradient(135deg, #14532d, #16a34a)" }}
                  >
                    View Portfolio <ChevronRight size={13} />
                  </button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* ── Input bar ──────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-4 pb-6 pt-3 border-t border-border bg-background flex items-center gap-2">
              <button
                onClick={toggleVoice}
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  listening
                    ? "bg-green-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  hasPending
                    ? "Type 'yes' to confirm or 'cancel'…"
                    : isInvesting
                      ? "Investing…"
                      : "Ask me anything or say 'invest 20k for 3 months'…"
                }
                disabled={isInvesting}
                className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/40 placeholder:text-muted-foreground/60 disabled:opacity-50"
              />

              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isSending || isInvesting}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-all active:scale-95 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #14532d, #16a34a)" }}
              >
                {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
