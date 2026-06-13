import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { getToken, formatKES } from "@/lib/auth";

type VoiceOrbProps = {
  section?: string;
  itemName?: string;
  role?: "investor" | "farmer";
  farmData?: { name: string; cropType: string; pricePerShare: number; returnRate?: string } | null;
};

type SectionCtx = { greeting: string; intro: string; tip?: string };

const SECTION_CTX: Record<string, SectionCtx> = {
  market: {
    greeting: "Jambo! Karibu kwenye soko la mashamba.",
    intro: "Welcome to the farm market! I can tell you about any listing here — returns, risk levels, or how to invest. Just ask me!",
    tip: "Try asking: 'Which farm has the best returns?' or 'How do I invest?'",
  },
  "farm-detail": {
    greeting: "Jambo! Habari about this shamba?",
    intro: "I can explain this farm's performance, crop growth stage, projected returns, and help you decide whether to invest. Nikusaidie?",
    tip: "Ask me about the Mid-Season or Full Season exit, or say 'invest' to get started.",
  },
  portfolio: {
    greeting: "Habari! Your portfolio is looking good.",
    intro: "I can explain your holdings, unrealised gains, and when to exit for the best returns. Asante for using Investa Farm!",
    tip: "Ask me 'when should I exit?' or 'explain my P&L'.",
  },
  wallet: {
    greeting: "Jambo! This is your Investa Wallet — mkoba wako.",
    intro: "I can help you top up via M-Pesa, explain how withdrawals work, and track your balance. Pesa yako iko salama!",
    tip: "Ask me 'how do I add money?' or 'when do my returns arrive?'",
  },
  profile: {
    greeting: "Karibu! How can I help you today?",
    intro: "I can guide you through KYC verification, explain broker status, and help with account settings.",
    tip: "Ask me 'how do I get verified?' or 'what is broker status?'",
  },
  farmer: {
    greeting: "Jambo, Mkulima! Habari za shamba lako?",
    intro: "I'm your farming advisor. I can help with KYC documents, funding applications, and understanding your 55% revenue share. Karibu sana!",
    tip: "Ask me 'how do I get funded?' or 'explain the 55/45 split'.",
  },
  "farmer-dashboard": {
    greeting: "Habari, Mkulima! Welcome to your dashboard.",
    intro: "Here you can see your farm's funding progress, investor activity, and field updates. Kila kitu kiko hapa!",
    tip: "Ask me about your funding progress or how to attract more investors.",
  },
  news: {
    greeting: "Jambo! Here are today's agriculture news.",
    intro: "I can summarise any article or explain how Kenya's commodity prices affect your investments. Habari nzuri!",
    tip: "Ask me 'how does maize price affect my returns?'",
  },
  default: {
    greeting: "Jambo! Mimi ni msaidizi wako wa Investa Farm.",
    intro: "I'm your Investa Farm voice assistant. I can help you invest in farms, understand returns, and navigate the app. Press the mic and ask anything!",
    tip: "Say 'show me available farms' or 'explain how returns work'.",
  },
};

const FEMALE_VOICE_KEYWORDS = [
  "Samantha", "Google UK English Female", "Microsoft Zira",
  "Karen", "Moira", "Victoria", "Tessa", "Fiona", "Female",
  "en-GB", "en-AU", "en-ZA",
];

function pickFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  for (const kw of FEMALE_VOICE_KEYWORDS) {
    const v = voices.find(v => v.name.includes(kw) || v.voiceURI.includes(kw));
    if (v) return v;
  }
  const enFemale = voices.find(v => v.lang.startsWith("en") && (v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("woman")));
  return enFemale ?? voices.find(v => v.lang.startsWith("en")) ?? null;
}

function speak(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(
    text.replace(/[🌾⚡📊💰🎤👋📈🛡️🌦️✅🤳📄⭐🚀🍵🥑🌱]/g, "")
  );
  utt.lang = "en-KE";
  utt.rate = 0.9;
  utt.pitch = 1.2;
  utt.volume = 1;
  const setVoice = () => {
    const v = pickFemaleVoice();
    if (v) utt.voice = v;
  };
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) setVoice();
  else window.speechSynthesis.addEventListener("voiceschanged", setVoice, { once: true });
  if (onEnd) utt.onend = onEnd;
  window.speechSynthesis.speak(utt);
}

function getStaticResponse(q: string, role: string): string | null {
  const l = q.toLowerCase();
  if (l.includes("jambo") || l.includes("hello") || l.includes("hi") || l.includes("habari")) {
    return role === "farmer"
      ? "Jambo, Mkulima! Karibu sana. I can help you with KYC, funding, field updates, and your 55% revenue share. What do you need?"
      : "Jambo! Karibu Investa Farm. I can show you available farms, explain returns, open your portfolio, or help you invest. What can I do for you?";
  }
  if (l.includes("return") || l.includes("earn") || l.includes("faida")) {
    return "Nzuri swali! You earn returns at harvest: Mid-Season gives you plus 8 to 12 percent in 30 to 60 days, or Full Season gives up to plus 28 percent in about 6 months. Returns are paid directly to your Investa Wallet, M-Pesa ready. Asante!";
  }
  if (l.includes("invest") || l.includes("buy") || l.includes("share") || l.includes("nunua")) {
    return "Nzuri! To invest: go to the Primary Market, pick a farm, tap BUY, choose your exit type — Mid-Season or Full Season — then confirm. Minimum is KES 5,000, which is about 50 shares. Haraka — good farms fill up fast!";
  }
  if (l.includes("kyc") || l.includes("verify") || l.includes("document")) {
    return "KYC ni muhimu sana! You need your National ID front and back, plus a live selfie. Upload from your Profile tab. Review takes 24 to 48 hours, then you unlock full trading with no limits. Karibu!";
  }
  if (l.includes("safe") || l.includes("risk") || l.includes("salama")) {
    return "Pesa yako iko salama! Your investment is protected by the Farmer Protection Fund — 5 percent of all investments in reserve — plus weather insurance and legally binding harvest contracts. Always diversify across 3 to 5 farms for best results.";
  }
  if (l.includes("wallet") || l.includes("mkoba") || l.includes("pesa") || l.includes("money") || l.includes("mpesa")) {
    return "Your Investa Wallet is your money hub! You can top up via M-Pesa, Visa, or Mastercard through Paystack. Withdrawals go back to your M-Pesa within 1 to 2 business days. Pesa yako, wakati wako!";
  }
  if (l.includes("55") || l.includes("split") || l.includes("farmer earn") || l.includes("revenue")) {
    return role === "farmer"
      ? "Habari nzuri! You keep 55 percent of all harvest revenue. Investors take 45 percent. For a KES 200,000 harvest, you get KES 110,000! No loans, no repayment — just harvest and earn. Asante sana Investa Farm!"
      : "Farmers keep 55 percent of all harvest revenue. You as an investor earn from the 45 percent investor pool, proportional to your shares. It's a fair deal for everyone — wakulima na wawekezaji!";
  }
  if (l.includes("explain") || l.includes("this section") || l.includes("what is this") || l.includes("where am i")) {
    return null;
  }
  if (l.includes("minimum") || l.includes("how much") || l.includes("start")) {
    return "Unaweza kuanza na KES 5,000 tu — that's about 50 shares at KES 100 each. Smart strategy: spread across 3 farms — maize for stability, avocado for growth, and coffee for premium returns. Karibu!";
  }
  return null;
}

export function AiAssistant({ initialQuestion, role = "investor" }: { initialQuestion?: string; role?: "investor" | "farmer" }) {
  return <VoiceOrb section="default" role={role} />;
}

export function VoiceOrb({ section = "default", itemName = "", role = "investor", farmData = null }: VoiceOrbProps) {
  const [visible, setVisible] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>();
  const recognitionRef = useRef<any>(null);
  const token = getToken();

  const ctx = SECTION_CTX[section] ?? SECTION_CTX.default;

  const resetHideTimer = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 60000);
  }, []);

  useEffect(() => {
    setVisible(false);
    setBubble(null);
    const t = setTimeout(() => {
      setVisible(true);
      resetHideTimer();
    }, 1800);
    return () => { clearTimeout(t); clearTimeout(hideTimer.current); };
  }, [section, resetHideTimer]);

  const showBubble = useCallback((text: string, duration = 5000) => {
    setBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), duration);
  }, []);

  const doSpeak = useCallback((text: string) => {
    setSpeaking(true);
    showBubble(text, Math.max(4000, text.length * 60));
    speak(text, () => setSpeaking(false));
  }, [showBubble]);

  const handleOrbPress = useCallback(() => {
    resetHideTimer();
    setVisible(true);
    if (speaking) { window.speechSynthesis?.cancel(); setSpeaking(false); return; }
    let greeting = ctx.greeting;
    if (farmData) {
      greeting = `Jambo! This is ${farmData.name} — a ${farmData.cropType} shamba. ${ctx.intro}`;
    } else {
      greeting = `${ctx.greeting} ${ctx.intro}`;
    }
    if (ctx.tip) greeting += ` ${ctx.tip}`;
    doSpeak(greeting);
  }, [ctx, farmData, speaking, doSpeak, resetHideTimer]);

  const handleMicPress = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    resetHideTimer();
    setVisible(true);
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) { doSpeak("Samahani! Voice input is not supported on this browser. Please try Chrome."); return; }

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-KE";

    rec.onresult = async (e: any) => {
      const transcript = (e.results[0]?.[0]?.transcript ?? "").trim();
      if (!transcript) return;
      showBubble(`"${transcript}"`, 3000);
      setListening(false);

      const lower = transcript.toLowerCase();
      if (lower.includes("go back") || lower.includes("previous") || lower.includes("rudi") || lower.includes("repeat")) {
        doSpeak(`Sawa! ${ctx.greeting} ${ctx.intro}`);
        return;
      }

      const staticReply = getStaticResponse(transcript, role);
      if (staticReply) { doSpeak(staticReply); return; }

      try {
        const sectionContext = farmData
          ? `User is viewing farm: ${farmData.name}, crop: ${farmData.cropType}, price: KES ${farmData.pricePerShare}/share. ${ctx.intro}`
          : `User is on the ${section} section. ${ctx.intro}`;

        const r = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: transcript, context: sectionContext }),
        });
        if (r.ok) {
          const d = await r.json();
          doSpeak(d.reply ?? "Samahani, sijui jibu. Please try again!");
        } else { throw new Error(); }
      } catch {
        doSpeak("Samahani! I had trouble connecting. Try asking again — niulize tena!");
      }
    };

    rec.onend = () => { setListening(false); };
    rec.onerror = () => { setListening(false); doSpeak("Samahani, sikukusikia. Please press the mic and try again!"); };

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    setPulse(true);
    setTimeout(() => setPulse(false), 300);
  }, [listening, doSpeak, showBubble, ctx, section, farmData, role, token, resetHideTimer]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed z-40 flex flex-col items-center gap-2 pointer-events-none"
          style={{ bottom: "5.2rem", right: "1rem" }}
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          transition={{ type: "spring", damping: 18, stiffness: 260 }}
        >
          {/* Speech bubble */}
          <AnimatePresence>
            {bubble && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                className="pointer-events-none max-w-[200px] bg-white/95 backdrop-blur-md rounded-2xl rounded-br-sm px-3 py-2 shadow-xl border border-green-100"
              >
                <p className="text-gray-800 text-[11px] leading-relaxed font-medium">{bubble}</p>
                <div className="absolute -bottom-1.5 right-4 w-3 h-3 bg-white rotate-45 border-r border-b border-green-100 shadow-sm" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Orb container */}
          <motion.div
            animate={{
              y: listening ? [0, -4, 0, -4, 0] : speaking ? [0, -6, 0, -3, 0] : [0, -5, 0, -3, 0],
              rotate: listening ? [0, 0, 0] : [0, -2, 0, 2, 0],
            }}
            transition={{
              duration: listening ? 0.5 : speaking ? 0.8 : 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="pointer-events-auto flex items-center gap-1.5"
          >
            {/* Main orb */}
            <motion.button
              onClick={handleOrbPress}
              whileTap={{ scale: 0.88 }}
              className="relative w-12 h-12 rounded-full flex items-center justify-center select-none outline-none"
              style={{
                background: listening
                  ? "linear-gradient(135deg, #dc2626, #ef4444)"
                  : speaking
                  ? "linear-gradient(135deg, #0369a1, #0ea5e9)"
                  : "linear-gradient(135deg, #052e16, #16a34a)",
                boxShadow: listening
                  ? "0 0 0 4px rgba(239,68,68,0.25), 0 4px 20px rgba(239,68,68,0.4)"
                  : speaking
                  ? "0 0 0 4px rgba(14,165,233,0.25), 0 4px 20px rgba(14,165,233,0.4)"
                  : "0 0 0 3px rgba(34,197,94,0.2), 0 4px 18px rgba(22,163,74,0.45)",
              }}
            >
              {/* Ripple when listening */}
              {listening && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-red-400"
                    animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-red-300"
                    animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
                  />
                </>
              )}
              {/* Sound waves when speaking */}
              {speaking && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-sky-300"
                  animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
              <span className="text-xl select-none">
                {listening ? "🎤" : speaking ? "🔊" : "🤖"}
              </span>
            </motion.button>

            {/* Mic button */}
            <motion.button
              onPointerDown={(e) => handleMicPress(e as any)}
              whileTap={{ scale: 0.85 }}
              className="w-8 h-8 rounded-full flex items-center justify-center shadow-md"
              style={{
                background: listening
                  ? "linear-gradient(135deg, #dc2626, #b91c1c)"
                  : "rgba(255,255,255,0.92)",
                boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
              }}
            >
              {listening
                ? <MicOff size={13} className="text-white" />
                : <Mic size={13} className="text-green-700" />
              }
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
