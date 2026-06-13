import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, Sparkles } from "lucide-react";

type Message = { role: "user" | "bot"; text: string; time: string };

const QUICK_QUESTIONS = [
  "What's the best farm to invest in now?",
  "How do I earn returns?",
  "What is Mid-Season vs Full Season?",
  "How does KYC work?",
  "Is my money safe?",
  "How do I withdraw?",
];

function getTime() {
  return new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

function getResponse(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes("best farm") || lower.includes("recommend") || lower.includes("top farm")) {
    return "Based on current market data, avocado and tea farms have the strongest growth trends with +12–18% projected returns this season. Maize farms offer lower risk with stable +8–10% returns. I'd suggest diversifying across 2–3 crops for balanced exposure. 🌱";
  }
  if (lower.includes("return") || lower.includes("earn") || lower.includes("profit")) {
    return "You earn returns when farmers sell their harvest. You choose your exit:\n\n⚡ Mid-Season — +10% in 30–60 days\n🌾 Full Season — up to +28% at harvest (~6 months)\n\nReturns are calculated on your total investment and paid directly to your wallet.";
  }
  if (lower.includes("mid-season") || lower.includes("full season") || lower.includes("exit")) {
    return "Great question!\n\n⚡ Mid-Season Exit: You sell your shares back at +10% after 30–60 days — fast returns, lower risk.\n\n🌾 Full Season Exit: Hold until harvest for up to +28% over ~6 months — higher returns, longer commitment.\n\nYou pick your exit when you invest. Mid-Season is safer for first-time investors.";
  }
  if (lower.includes("kyc") || lower.includes("verify") || lower.includes("id") || lower.includes("identity")) {
    return "KYC (Know Your Customer) is required by Kenyan law to protect all users. You'll need:\n\n📄 National ID (front & back)\n🤳 Live selfie for identity match\n📋 Financial statement\n\nDocuments are reviewed within 24–48 hours. Once verified, you unlock full trading features!";
  }
  if (lower.includes("safe") || lower.includes("risk") || lower.includes("guarantee") || lower.includes("insur")) {
    return "Your money is protected by several layers:\n\n🛡️ Farmer Protection Fund (5% of all investments)\n🌦️ Weather insurance partnerships\n✅ KYC-verified farmers with field visits\n📊 Diversified crop portfolio\n\nNote: Agricultural investments carry inherent risks. Always diversify across multiple farms.";
  }
  if (lower.includes("withdraw") || lower.includes("cash out") || lower.includes("mpesa") || lower.includes("money out")) {
    return "To withdraw your funds:\n\n1. Go to Portfolio → select a holding\n2. Tap 'Request Exit' (Mid or Full Season)\n3. Wait for approval (1–5 business days)\n4. Funds sent to your M-Pesa or bank\n\nYou can also withdraw from your Investa Wallet anytime — no exit required for undeployed funds.";
  }
  if (lower.includes("minimum") || lower.includes("start") || lower.includes("how much")) {
    return "The minimum investment is KES 5,000 (about 50 shares at KES 100/share). There's no maximum! You can spread investments across multiple farms starting from KES 1,000 per farm.";
  }
  if (lower.includes("fee") || lower.includes("charge") || lower.includes("cost")) {
    return "Investa Farm charges:\n\n• 1.5% on returns (not principal)\n• No deposit fees\n• M-Pesa standard fees on withdrawals\n• No hidden charges\n\nFor example, on a KES 10,000 investment with +10% return, the fee is KES 15. Transparent and fair!";
  }
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return "Hello! 👋 I'm your Investa Farm AI assistant. I can help you understand how to invest in farms, calculate returns, learn about KYC, or find the best farms for your budget. What would you like to know?";
  }
  if (lower.includes("portfolio") || lower.includes("diversif")) {
    return "Smart diversification strategy:\n\n🌾 60% in stable crops (maize, wheat) — steady returns\n🥑 30% in high-growth crops (avocado, coffee) — higher upside\n☕ 10% in premium crops (tea, macadamia) — long-term value\n\nThis balances risk and maximizes your overall return potential.";
  }
  return "That's a great question! I don't have a specific answer for that yet, but I'm learning. For detailed support, contact us at support@investafarm.co.ke. Is there anything else I can help with? 🌱";
}

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Hi! 👋 I'm your Investa Farm Assistant. Ask me anything about investing in farms, earning returns, or how the platform works.", time: getTime() },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", text: text.trim(), time: getTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const botMsg: Message = { role: "bot", text: getResponse(text), time: getTime() };
      setMessages(prev => [...prev, botMsg]);
      setTyping(false);
    }, 800 + Math.random() * 600);
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
            onClick={() => setOpen(true)}
            className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full shadow-lg shadow-primary/30 pr-4 pl-3 py-3"
            style={{ background: "linear-gradient(135deg, #16a34a, #0f4c35)" }}
          >
            <MessageCircle size={18} className="text-white" />
            <span className="text-white text-xs font-semibold">Assistant</span>
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
            style={{ height: "85dvh" }}
          >
            <div className="relative mx-auto w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div
                className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b border-border"
                style={{ background: "linear-gradient(135deg, #16a34a, #0f4c35)" }}
              >
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot size={18} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">Assistant</p>
                  <p className="text-white/70 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                    Always online · Ask me anything
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}
                  >
                    {msg.role === "bot" && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot size={13} className="text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                        msg.role === "user"
                          ? "bg-primary text-white rounded-br-sm"
                          : "bg-gray-100 text-foreground rounded-bl-sm"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>
                      <p className={`text-[9px] mt-1 ${msg.role === "user" ? "text-white/60" : "text-muted-foreground"}`}>
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}
                {typing && (
                  <div className="flex justify-start items-end gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot size={13} className="text-primary" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
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
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {QUICK_QUESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="flex-shrink-0 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full border border-primary/20 whitespace-nowrap active:scale-95 transition-transform"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex-shrink-0 px-4 pb-6 pt-2 border-t border-border">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask about investing…"
                    className="flex-1 border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground bg-gray-50 focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || typing}
                    className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform flex-shrink-0"
                  >
                    <Send size={15} className="text-white" />
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
