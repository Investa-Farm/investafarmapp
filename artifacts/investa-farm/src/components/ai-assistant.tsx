import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, Sparkles, Mic, MicOff, Volume2, VolumeX, TrendingUp, Wallet, BarChart3, ArrowRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { getToken, formatKES } from "@/lib/auth";

type Message = {
  role: "user" | "bot" | "action";
  text: string;
  time: string;
  action?: { label: string; path: string; icon?: React.ReactNode };
};

const QUICK_QUESTIONS = [
  "What farms can I invest in?",
  "Open my portfolio",
  "How do I earn returns?",
  "What is Mid-Season exit?",
  "How much to start investing?",
  "Is my money safe?",
];

function getTime() {
  return new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

function getStaticResponse(q: string): { text: string; action?: { label: string; path: string } } | null {
  const lower = q.toLowerCase();
  if (lower.includes("return") || lower.includes("earn") || lower.includes("profit")) {
    return { text: "You earn returns at harvest time:\n\n⚡ Mid-Season — +8–12% in 30–60 days\n🌾 Full Season — up to +28% in ~6 months\n\nReturns are calculated on your total investment and paid to your wallet." };
  }
  if (lower.includes("mid-season") || lower.includes("full season") || lower.includes("exit plan")) {
    return { text: "⚡ Mid-Season Exit: Sell shares back at +10% after 30–60 days — quick, lower risk.\n\n🌾 Full Season Exit: Hold until harvest for up to +28% over ~6 months.\n\nPick your exit type when you invest. Mid-Season is great for first-timers." };
  }
  if (lower.includes("kyc") || lower.includes("verify") || lower.includes("identity")) {
    return { text: "KYC is a one-time identity check required by Kenyan law:\n\n📄 National ID (front & back)\n🤳 Live selfie\n\nDocuments reviewed in 24–48 hours. Once verified you unlock full trading!" };
  }
  if (lower.includes("safe") || lower.includes("risk") || lower.includes("guarantee")) {
    return { text: "Your money is protected by:\n\n🛡️ Farmer Protection Fund (5% of all investments)\n🌦️ Weather insurance partnerships\n✅ KYC-verified farmers only\n\nNote: Agricultural investments carry inherent market risk — always diversify." };
  }
  if (lower.includes("withdraw") || lower.includes("cash out") || lower.includes("mpesa")) {
    return { text: "To withdraw:\n1. Go to Portfolio → select a holding\n2. Tap 'Request Exit'\n3. Approval in 1–5 business days\n4. Funds to your M-Pesa\n\nWallet balance withdraws instantly.", action: { label: "Open Wallet", path: "/wallet" } };
  }
  if (lower.includes("minimum") || lower.includes("how much") || lower.includes("start investing") || lower.includes("how much to")) {
    return { text: "You can start from as little as KES 5,000 — about 50 shares at KES 100/share.\n\nThere's no maximum. Spreading KES 20K–50K across 3–5 farms is ideal for beginners." };
  }
  if (lower.includes("fee") || lower.includes("charge") || lower.includes("cost")) {
    return { text: "Investa Farm charges:\n\n• 1.5% on returns only (not on principal)\n• No deposit fees\n• Standard M-Pesa fees on withdrawal\n\nFor KES 10,000 invested at +10% return, the fee is just KES 15." };
  }
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey") || lower.includes("help")) {
    return { text: "Hello! 👋 I'm your Investa Farm AI voice assistant.\n\nI can:\n🌾 Show you available farm investments\n📊 Open your portfolio\n💰 Help you invest in a specific farm\n🔊 Speak my responses aloud\n\nJust ask or tap the mic to speak!" };
  }
  if (lower.includes("diversif") || lower.includes("strategy") || lower.includes("allocation")) {
    return { text: "Smart diversification strategy:\n\n🌾 60% in stable crops (maize, wheat) — steady +8–10%\n🥑 30% in growth crops (avocado, coffee) — +15–20%\n☕ 10% in premium crops (tea, macadamia) — long-term\n\nThis balances risk and maximises overall returns." };
  }
  return null;
}

export function AiAssistant({ initialQuestion }: { initialQuestion?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text: "Hi! 👋 I'm your Investa Farm AI assistant. I can show available investments, open your portfolio, and even help you invest — just ask or tap 🎤 to speak.",
      time: getTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [listings, setListings] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [, setLocation] = useLocation();
  const token = getToken();

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      fetch("/api/market/primary", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setListings(data); })
        .catch(() => {});
    }
  }, [messages, open, token]);

  useEffect(() => {
    if (initialQuestion && !open) {
      setOpen(true);
      setTimeout(() => sendMessage(initialQuestion), 400);
    }
  }, [initialQuestion]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[🌾⚡📊💰🎤👋📈🛡️🌦️✅🤳📄]/g, ""));
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Google UK English Female"));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const addBotMessage = useCallback((text: string, action?: Message["action"]) => {
    setMessages(prev => [...prev, { role: "bot", text, time: getTime(), action }]);
    speak(text);
  }, [speak]);

  const handleNavAction = useCallback((path: string) => {
    setOpen(false);
    setLocation(path);
  }, [setLocation]);

  const getAIResponse = useCallback(async (q: string) => {
    const lower = q.toLowerCase();

    // Navigation + action intents
    if (lower.includes("open portfolio") || lower.includes("my portfolio") || lower.includes("show portfolio") || lower.includes("view portfolio")) {
      addBotMessage("Opening your portfolio now! 📊 You can see all your farm holdings, returns, and request exits there.");
      setTimeout(() => handleNavAction("/portfolio"), 1200);
      return;
    }

    if (lower.includes("open wallet") || lower.includes("my wallet") || lower.includes("top up") || lower.includes("deposit")) {
      addBotMessage("Taking you to your wallet! 💰 You can top up via M-Pesa or card there.");
      setTimeout(() => handleNavAction("/wallet"), 1200);
      return;
    }

    if (lower.includes("invest in") || lower.includes("buy shares") || lower.includes("invest now")) {
      const cropMatch = listings.find(l =>
        lower.includes(l.cropType?.toLowerCase()) || lower.includes(l.farmName?.toLowerCase())
      );
      if (cropMatch) {
        addBotMessage(`Great choice! I found "${cropMatch.farmName}" — ${cropMatch.cropType} at ${formatKES(cropMatch.pricePerShare)}/share with ${cropMatch.sharesAvailable} shares available. Opening the listing for you now!`, {
          label: `Invest in ${cropMatch.farmName}`,
          path: `/market/${cropMatch.farmId}`,
        });
        return;
      }
      addBotMessage("Taking you to the Primary Market where you can browse all available farm listings and invest!");
      setTimeout(() => handleNavAction("/market/primary"), 1200);
      return;
    }

    if (lower.includes("available") || lower.includes("current farm") || lower.includes("what farm") || lower.includes("show farm") || lower.includes("investments available") || lower.includes("what can i invest")) {
      if (listings.length === 0) {
        addBotMessage("Let me pull up the current live farm listings for you!", { label: "Browse All Farms", path: "/market/primary" });
        return;
      }
      const top3 = listings.slice(0, 3);
      const listText = top3.map(l => `🌾 ${l.farmName} — ${l.cropType} · ${formatKES(l.pricePerShare)}/share · ${l.sharesAvailable} shares left`).join("\n");
      addBotMessage(
        `Here are the top ${top3.length} live farm listings right now:\n\n${listText}\n\nThere are ${listings.length} total listings available.`,
        listings.length > 0 ? { label: "View All Listings", path: "/market/primary" } : undefined
      );
      return;
    }

    if (lower.includes("market") || lower.includes("secondary") || lower.includes("trade")) {
      addBotMessage("The market has two sections:\n\n📊 Primary Market — buy new shares directly from farmers\n🔄 Secondary Market — trade shares between investors\n\nOpening the market for you!", {
        label: "Open Market",
        path: "/market",
      });
      return;
    }

    if (lower.includes("activity") || lower.includes("transactions") || lower.includes("history")) {
      addBotMessage("Taking you to your Activity tab where you can see all transactions and open detailed receipts!", {
        label: "View Activity",
        path: "/activity",
      });
      return;
    }

    // Static responses for common questions
    const staticResp = getStaticResponse(q);
    if (staticResp) {
      addBotMessage(staticResp.text, staticResp.action ? { label: staticResp.action.label, path: staticResp.action.path } : undefined);
      return;
    }

    // Fallback to Groq AI
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: q, context: `Available farms: ${listings.slice(0,3).map(l => l.farmName + " (" + l.cropType + ")").join(", ")}` }),
      });
      if (r.ok) {
        const d = await r.json();
        addBotMessage(d.reply ?? d.message ?? "I can help with that! Try asking about available farms, returns, or I can open your portfolio.");
      } else {
        throw new Error("AI unavailable");
      }
    } catch {
      addBotMessage("That's a great question! I can help you:\n• Show available farm investments\n• Open your portfolio\n• Explain returns and exit options\n\nWhat would you like to know? 🌱");
    }
  }, [listings, addBotMessage, handleNavAction, token]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: "user", text: text.trim(), time: getTime() }]);
    setInput("");
    setTyping(true);
    setTimeout(async () => {
      await getAIResponse(text.trim());
      setTyping(false);
    }, 600 + Math.random() * 400);
  }, [getAIResponse]);

  const startListening = useCallback(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      addBotMessage("Voice input isn't supported on this browser. Please type your question.");
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript) sendMessage(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [addBotMessage, sendMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (!next) window.speechSynthesis?.cancel();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 15 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full shadow-lg shadow-primary/30 pr-4 pl-3 py-3"
            style={{ background: "linear-gradient(135deg, #16a34a, #0f4c35)" }}
          >
            <Bot size={18} className="text-white" />
            <span className="text-white text-xs font-semibold">AI Assistant</span>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
              <Sparkles size={8} className="text-white" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 inset-x-0 z-50"
            style={{ height: "88dvh" }}
          >
            <div className="relative mx-auto w-full max-w-[430px] bg-card rounded-t-3xl shadow-2xl flex flex-col h-full overflow-hidden border border-border/50">
              {/* Header */}
              <div
                className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5"
                style={{ background: "linear-gradient(135deg, #0f4c35, #16a34a)" }}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Bot size={20} className="text-white" />
                  </div>
                  {listening && (
                    <motion.div
                      className="absolute -inset-1 rounded-2xl border-2 border-green-300"
                      animate={{ scale: [1, 1.15, 1], opacity: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">Investa AI Assistant</p>
                  <p className="text-white/70 text-xs flex items-center gap-1">
                    {listening
                      ? <><span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Listening…</>
                      : <><span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" /> Online · Powered by AI</>
                    }
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={toggleVoice}
                    className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center"
                    title={voiceEnabled ? "Mute voice" : "Enable voice"}
                  >
                    {voiceEnabled ? <Volume2 size={14} className="text-white" /> : <VolumeX size={14} className="text-white/60" />}
                  </button>
                  <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                    <X size={16} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
                    {msg.role === "bot" && (
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Bot size={13} className="text-primary" />
                      </div>
                    )}
                    <div className="max-w-[82%]">
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 ${
                          msg.role === "user"
                            ? "bg-primary text-white rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>
                        <p className={`text-[9px] mt-1 ${msg.role === "user" ? "text-white/60" : "text-muted-foreground"}`}>{msg.time}</p>
                      </div>
                      {msg.action && (
                        <button
                          onClick={() => handleNavAction(msg.action!.path)}
                          className="mt-1.5 flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-transform shadow-sm"
                        >
                          <ArrowRight size={12} />
                          {msg.action.label}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {typing && (
                  <div className="flex justify-start items-end gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                      <Bot size={13} className="text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(k => (
                          <div key={k} className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: `${k * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick questions */}
              {messages.length < 3 && (
                <div className="flex-shrink-0 px-4 pb-2">
                  <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick questions:</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {QUICK_QUESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        disabled={typing}
                        className="flex-shrink-0 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full border border-primary/20 whitespace-nowrap active:scale-95 transition-transform disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex-shrink-0 px-4 pb-6 pt-2 border-t border-border bg-card">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <button
                    type="button"
                    onClick={listening ? stopListening : startListening}
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${
                      listening
                        ? "bg-red-500 shadow-lg shadow-red-500/30"
                        : "bg-muted border border-border"
                    }`}
                  >
                    {listening
                      ? <MicOff size={16} className="text-white" />
                      : <Mic size={16} className="text-muted-foreground" />
                    }
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={listening ? "Listening…" : "Ask anything, or tap 🎤"}
                    className="flex-1 border border-border rounded-2xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:border-primary transition-colors"
                    disabled={listening}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || typing || listening}
                    className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform flex-shrink-0"
                  >
                    {typing ? <Loader2 size={15} className="text-white animate-spin" /> : <Send size={15} className="text-white" />}
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
