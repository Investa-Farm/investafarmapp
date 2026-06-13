import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, Sparkles, Mic, MicOff, Volume2, VolumeX, TrendingUp, ArrowRight, Loader2, Leaf } from "lucide-react";
import { useLocation } from "wouter";
import { getToken, formatKES } from "@/lib/auth";

type Message = {
  role: "user" | "bot" | "action";
  text: string;
  time: string;
  action?: { label: string; path: string; icon?: React.ReactNode };
};

const INVESTOR_QUICK_QUESTIONS = [
  "What farms can I invest in?",
  "Open my portfolio",
  "How do I earn returns?",
  "What is Mid-Season exit?",
  "How much to start investing?",
  "Is my money safe?",
];

const FARMER_QUICK_QUESTIONS = [
  "How do I get funded?",
  "When will investors see my farm?",
  "What is the 55/45 split?",
  "How do I complete KYC?",
  "How do I post a field update?",
  "What documents do I need?",
];

function getTime() {
  return new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

function getFarmerStaticResponse(q: string): { text: string; action?: { label: string; path: string } } | null {
  const lower = q.toLowerCase();
  if (lower.includes("fund") || lower.includes("capital") || lower.includes("loan") || lower.includes("money")) {
    return { text: "To get funded on Investa Farm:\n\n1️⃣ Complete KYC (National ID + farm docs)\n2️⃣ Apply for funding from your dashboard\n3️⃣ Sign the farmer contract (55/45 split)\n4️⃣ Get listed — investors start buying shares!\n\nFunding arrives within 2–5 days of reaching your target.", action: { label: "Apply for Funding", path: "/farmer/loan-apply" } };
  }
  if (lower.includes("55") || lower.includes("split") || lower.includes("share") || lower.includes("percent")) {
    return { text: "Investa Farm uses a 55/45 revenue split:\n\n🌾 You keep 55% of all harvest revenue\n💰 45% goes to investors who funded your farm\n\nFor example: if your harvest earns KES 200,000:\n• Your share = KES 110,000\n• Investors share = KES 90,000\n\nThis is guaranteed in your signed contract." };
  }
  if (lower.includes("kyc") || lower.includes("verify") || lower.includes("document")) {
    return { text: "KYC for farmers requires:\n\n📄 National ID (front & back)\n🏡 Farm ownership documents or lease agreement\n📋 Recent farm report or crop plan\n\nOnce you upload all documents, our team reviews within 24–48 hours. You'll get an email confirmation!", action: { label: "Start KYC", path: "/farmer/kyc" } };
  }
  if (lower.includes("update") || lower.includes("photo") || lower.includes("investor") || lower.includes("post")) {
    return { text: "Posting regular updates builds investor trust:\n\n📸 Upload field photos (crop progress, harvest)\n📊 Share milestone updates (planting, flowering, harvest)\n\n📈 Farms with weekly updates get funded 3× faster!\n\nYour investors get notified every time you post.", action: { label: "Post an Update", path: "/farmer/updates" } };
  }
  if (lower.includes("listed") || lower.includes("market") || lower.includes("visible")) {
    return { text: "Your farm appears on the investor market after:\n\n✅ KYC approved by admin\n✅ Funding application submitted\n✅ Contract signed\n\nOnce listed, investors can buy shares within minutes. Farms with photos and descriptions get 5× more investors!", action: { label: "View Market Listing", path: "/farmer/market" } };
  }
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey") || lower.includes("help")) {
    return { text: "Hello, Farmer! 👋 I'm your Investa Farm AI farming advisor.\n\nI can help you:\n🌾 Navigate the funding process\n📋 Understand KYC requirements\n💰 Explain the 55/45 revenue split\n📸 Post field updates to attract investors\n\nWhat do you need help with?" };
  }
  if (lower.includes("earn") || lower.includes("profit") || lower.includes("revenue")) {
    return { text: "Your earnings on Investa Farm:\n\n🌾 You earn 55% of all harvest revenue\n💼 No repayment required — investors share the harvest risk\n📈 Post-harvest funds arrive to your wallet in 1–3 days\n\nExample: KES 500,000 harvest → you receive KES 275,000 🎉" };
  }
  return null;
}

function getInvestorStaticResponse(q: string): { text: string; action?: { label: string; path: string } } | null {
  const lower = q.toLowerCase();
  if (lower.includes("return") || lower.includes("earn") || lower.includes("profit")) {
    return { text: "You earn returns at harvest time:\n\n⚡ Mid-Season — +8–12% in 30–60 days\n🌾 Full Season — up to +28% in ~6 months\n\nReturns are calculated on your total investment and paid directly to your wallet as M-Pesa or bank transfer." };
  }
  if (lower.includes("mid-season") || lower.includes("full season") || lower.includes("exit plan")) {
    return { text: "⚡ Mid-Season Exit: Sell shares back at +10% after 30–60 days — quick, lower risk.\n\n🌾 Full Season Exit: Hold until harvest for up to +28% over ~6 months.\n\nPick your exit type when you invest. Mid-Season is perfect for first-timers — lower commitment, steady returns." };
  }
  if (lower.includes("kyc") || lower.includes("verify") || lower.includes("identity")) {
    return { text: "KYC is a one-time identity check required by Kenyan financial law:\n\n📄 National ID (front & back)\n🤳 Live selfie\n\nDocuments reviewed in 24–48 hours. Once verified you unlock full trading — no limits on investment amounts!" };
  }
  if (lower.includes("safe") || lower.includes("risk") || lower.includes("guarantee")) {
    return { text: "Your investment is protected by:\n\n🛡️ Farmer Protection Fund (5% of all investments held in reserve)\n🌦️ Weather insurance partnerships with leading Kenyan insurers\n✅ KYC-verified farmers only — no anonymous listings\n📋 Legally binding harvest contracts\n\nNote: Agricultural investments carry inherent market risk — always diversify across 3–5 farms." };
  }
  if (lower.includes("withdraw") || lower.includes("cash out") || lower.includes("mpesa")) {
    return { text: "To withdraw earnings:\n1. Go to Portfolio → select a holding\n2. Tap 'Request Exit'\n3. Approval in 1–5 business days\n4. Funds sent to your M-Pesa or bank\n\nWallet balance can be withdrawn instantly to M-Pesa.", action: { label: "Open Wallet", path: "/wallet" } };
  }
  if (lower.includes("minimum") || lower.includes("how much") || lower.includes("start investing") || lower.includes("how much to")) {
    return { text: "You can start from as little as KES 5,000 — that's about 50 shares at KES 100/share.\n\n💡 Smart starting strategy:\n• KES 10K in maize (stable, +10%)\n• KES 10K in coffee (growth, +18%)\n• KES 5K in tea (long-term, +14%)\n\nThis gives you diversification from day one!" };
  }
  if (lower.includes("fee") || lower.includes("charge") || lower.includes("cost")) {
    return { text: "Investa Farm charges:\n\n• 1.5% on returns only — never on your principal\n• No deposit fees via M-Pesa\n• Standard M-Pesa fees on withdrawal\n\nFor KES 10,000 invested at +10% return (KES 1,000), the platform fee is just KES 15. You keep KES 985." };
  }
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey") || lower.includes("help")) {
    return { text: "Hello! 👋 I'm your Investa Farm AI investment advisor.\n\nI can:\n🌾 Show you available farm investments\n📊 Open your portfolio & track returns\n💰 Help you invest in a specific farm\n🔊 Speak my responses aloud\n📈 Explain strategies & market conditions\n\nJust ask or tap the mic to speak!" };
  }
  if (lower.includes("diversif") || lower.includes("strategy") || lower.includes("allocation")) {
    return { text: "Smart diversification strategy for Kenya farms:\n\n🌾 50% in stable crops (maize, wheat, beans) — steady +8–10%\n🥑 30% in growth crops (avocado, coffee) — +15–22%\n🍵 20% in premium crops (tea, macadamia) — long-term +16–24%\n\nThis balances risk and maximises overall returns. Spread across 3–5 farms minimum." };
  }
  if (lower.includes("broker") || lower.includes("status") || lower.includes("upgrade")) {
    return { text: "Broker Status unlocks at KES 500,000 portfolio value:\n\n⭐ Bulk share orders with priority allocation\n🚀 First access to new farm listings (24h before public)\n📞 Dedicated relationship manager\n💰 Higher return tiers on select farms\n\nYou're automatically upgraded when you hit the threshold — no application needed!" };
  }
  return null;
}

export function AiAssistant({ initialQuestion, role = "investor" }: { initialQuestion?: string; role?: "investor" | "farmer" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text: role === "farmer"
        ? "Hello, Farmer! 👋 I'm your Investa Farm AI farming advisor. I can guide you through KYC, funding applications, posting updates, and understanding the 55/45 revenue split. What do you need help with?"
        : "Hi! 👋 I'm your Investa Farm AI investment advisor. I can show available investments, open your portfolio, explain returns and exits, and even help you invest — just ask or tap 🎤 to speak.",
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

  const quickQuestions = role === "farmer" ? FARMER_QUICK_QUESTIONS : INVESTOR_QUICK_QUESTIONS;

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      if (role === "investor") {
        fetch("/api/market/primary", { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => { if (Array.isArray(data)) setListings(data); })
          .catch(() => {});
      }
    }
  }, [messages, open, token, role]);

  useEffect(() => {
    if (initialQuestion && !open) {
      setOpen(true);
      setTimeout(() => sendMessage(initialQuestion), 400);
    }
  }, [initialQuestion]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[🌾⚡📊💰🎤👋📈🛡️🌦️✅🤳📄⭐🚀🍵🥑]/g, ""));
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

    if (role === "farmer") {
      if (lower.includes("open dashboard") || lower.includes("my dashboard") || lower.includes("home")) {
        addBotMessage("Taking you to your farmer dashboard! 🌾");
        setTimeout(() => handleNavAction("/farmer/dashboard"), 1000);
        return;
      }
      if (lower.includes("kyc") || lower.includes("verify") || lower.includes("document")) {
        addBotMessage("Let me take you straight to KYC! Upload your National ID and farm documents to get verified.", { label: "Start KYC Now", path: "/farmer/kyc" });
        return;
      }
      if (lower.includes("update") || lower.includes("photo") || lower.includes("post")) {
        addBotMessage("Post a field update to keep investors informed. Farms with frequent updates get funded faster!", { label: "Post Field Update", path: "/farmer/updates" });
        return;
      }
      if (lower.includes("fund") || lower.includes("apply") || lower.includes("loan") || lower.includes("capital")) {
        addBotMessage("I'll take you to the funding application. Make sure your KYC is approved first!", { label: "Apply for Funding", path: "/farmer/loan-apply" });
        return;
      }
      if (lower.includes("market") || lower.includes("listing") || lower.includes("investor")) {
        addBotMessage("Let me show you how your farm looks on the investor market!", { label: "View Farm Listing", path: "/farmer/market" });
        return;
      }
      if (lower.includes("wallet") || lower.includes("earning") || lower.includes("payment")) {
        addBotMessage("Let me open your farmer wallet where you can see earnings and withdrawals!", { label: "Open Farmer Wallet", path: "/farmer/wallet" });
        return;
      }
      const staticResp = getFarmerStaticResponse(q);
      if (staticResp) {
        addBotMessage(staticResp.text, staticResp.action ? { label: staticResp.action.label, path: staticResp.action.path } : undefined);
        return;
      }
    } else {
      if (lower.includes("open portfolio") || lower.includes("my portfolio") || lower.includes("show portfolio") || lower.includes("view portfolio")) {
        addBotMessage("Opening your portfolio now! 📊 See all your farm holdings, unrealised gains, and request exits there.");
        setTimeout(() => handleNavAction("/portfolio"), 1200);
        return;
      }
      if (lower.includes("open wallet") || lower.includes("my wallet") || lower.includes("top up") || lower.includes("deposit")) {
        addBotMessage("Taking you to your wallet! 💰 Top up via M-Pesa or card and withdraw earnings instantly.");
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
        addBotMessage("Taking you to the Primary Market where all available farm listings live!");
        setTimeout(() => handleNavAction("/market/primary"), 1200);
        return;
      }
      if (lower.includes("available") || lower.includes("current farm") || lower.includes("what farm") || lower.includes("show farm") || lower.includes("investments available") || lower.includes("what can i invest")) {
        if (listings.length === 0) {
          addBotMessage("Let me pull up the live farm listings for you!", { label: "Browse All Farms", path: "/market/primary" });
          return;
        }
        const top3 = listings.slice(0, 3);
        const listText = top3.map(l => `🌾 ${l.farmName} — ${l.cropType} · ${formatKES(l.pricePerShare)}/share · ${l.sharesAvailable} shares left`).join("\n");
        addBotMessage(
          `Top ${top3.length} live farm listings right now:\n\n${listText}\n\n${listings.length} total listings available. Click below to browse all!`,
          { label: "View All Listings", path: "/market/primary" }
        );
        return;
      }
      if (lower.includes("activity") || lower.includes("transactions") || lower.includes("history")) {
        addBotMessage("Opening your Activity tab — all transactions, receipts, and investment history!", { label: "View Activity", path: "/activity" });
        return;
      }
      const staticResp = getInvestorStaticResponse(q);
      if (staticResp) {
        addBotMessage(staticResp.text, staticResp.action ? { label: staticResp.action.label, path: staticResp.action.path } : undefined);
        return;
      }
    }

    try {
      const systemContext = role === "farmer"
        ? "You are an expert African agricultural finance advisor for Investa Farm Kenya. Help farmers understand: KYC (National ID + farm docs), 55/45 revenue split (farmer keeps 55%), funding applications, posting field updates, and how investors find their farm. Be concise, use emojis, be encouraging."
        : `You are an expert investment advisor for Investa Farm Kenya. Available farms: ${listings.slice(0,5).map(l => l.farmName + " (" + l.cropType + ", KES " + l.pricePerShare + "/share)").join(", ")}. Help investors understand farm investments, returns (8–28%), KYC, diversification, and exits. Be concise, use emojis.`;

      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: q, context: systemContext }),
      });
      if (r.ok) {
        const d = await r.json();
        addBotMessage(d.reply ?? d.message ?? (role === "farmer"
          ? "I can guide you on KYC, funding applications, field updates, and understanding your earnings. What do you need help with? 🌱"
          : "I can help you find farms to invest in, explain returns, and open your portfolio. What would you like to know? 🌾"
        ));
      } else {
        throw new Error("AI unavailable");
      }
    } catch {
      addBotMessage(role === "farmer"
        ? "Great question! I can help you with:\n• KYC document requirements\n• Funding application process\n• Posting field updates\n• Understanding your 55% revenue share\n\nWhat would you like to explore? 🌱"
        : "Great question! I can help you with:\n• Finding available farm investments\n• Understanding returns and exits\n• Opening your portfolio\n• KYC verification steps\n\nWhat would you like to know? 🌾"
      );
    }
  }, [listings, addBotMessage, handleNavAction, token, role]);

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
      addBotMessage("Voice input isn't supported on this browser. Please type your question instead.");
      return;
    }
    if (recognitionRef.current) recognitionRef.current.abort();
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

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setListening(false); }, []);
  const toggleVoice = () => { const next = !voiceEnabled; setVoiceEnabled(next); if (!next) window.speechSynthesis?.cancel(); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };

  const gradientStyle = role === "farmer"
    ? { background: "linear-gradient(135deg, #0f4c35, #15803d)" }
    : { background: "linear-gradient(135deg, #0f4c35, #16a34a)" };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 15, delay: 0.5 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full shadow-xl shadow-primary/40 flex items-center justify-center"
            style={gradientStyle}
          >
            {/* Pulsing ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: "rgba(22,163,74,0.3)" }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2.8 }}
            />
            {role === "farmer"
              ? <Leaf size={22} className="text-white relative z-10" />
              : <Bot size={22} className="text-white relative z-10" />
            }
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-sm">
              <Sparkles size={9} className="text-white" />
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
              <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5" style={gradientStyle}>
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    {role === "farmer" ? <Leaf size={20} className="text-white" /> : <Bot size={20} className="text-white" />}
                  </div>
                  {listening && (
                    <motion.div
                      className="absolute -inset-1 rounded-full border-2 border-green-300"
                      animate={{ scale: [1, 1.15, 1], opacity: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">{role === "farmer" ? "Farming Advisor" : "Investment Advisor"}</p>
                  <p className="text-white/70 text-xs flex items-center gap-1">
                    {listening
                      ? <><span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Listening…</>
                      : <><span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" /> Online · Powered by AI</>
                    }
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={toggleVoice} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center" title={voiceEnabled ? "Mute voice" : "Enable voice"}>
                    {voiceEnabled ? <Volume2 size={14} className="text-white" /> : <VolumeX size={14} className="text-white/60" />}
                  </button>
                  <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                    <X size={16} className="text-white" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
                    {msg.role === "bot" && (
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                        {role === "farmer" ? <Leaf size={13} className="text-primary" /> : <Bot size={13} className="text-primary" />}
                      </div>
                    )}
                    <div className="max-w-[82%]">
                      <div className={`rounded-2xl px-3.5 py-2.5 ${msg.role === "user" ? "bg-primary text-white rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
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
                      {role === "farmer" ? <Leaf size={13} className="text-primary" /> : <Bot size={13} className="text-primary" />}
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

              {messages.length < 3 && (
                <div className="flex-shrink-0 px-4 pb-2">
                  <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick questions:</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {quickQuestions.map(q => (
                      <button key={q} onClick={() => sendMessage(q)} disabled={typing}
                        className="flex-shrink-0 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full border border-primary/20 whitespace-nowrap active:scale-95 transition-transform disabled:opacity-50">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-shrink-0 px-4 pb-6 pt-2 border-t border-border bg-card">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <button type="button" onClick={listening ? stopListening : startListening}
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${listening ? "bg-red-500 shadow-lg shadow-red-500/30" : "bg-muted border border-border"}`}>
                    {listening ? <MicOff size={16} className="text-white" /> : <Mic size={16} className="text-muted-foreground" />}
                  </button>
                  <input type="text" value={input} onChange={e => setInput(e.target.value)}
                    placeholder={listening ? "Listening…" : role === "farmer" ? "Ask about funding, KYC, earnings…" : "Ask anything, or tap 🎤"}
                    className="flex-1 border border-border rounded-2xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:border-primary transition-colors"
                    disabled={listening} />
                  <button type="submit" disabled={!input.trim() || typing || listening}
                    className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform flex-shrink-0">
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
