import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { getToken } from "@/lib/auth";

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

function speak(text: string, onEnd?: () => void) {
  if (!window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(
    text.replace(/[🌾⚡📊💰🎤👋📈🛡️🌦️✅🤳📄⭐🚀🍵🥑🌱]/g, "")
  );
  utt.lang = "en-KE";
  utt.rate = 0.9;
  utt.pitch = 1.2;
  utt.volume = 1;
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
  if (l.includes("minimum") || l.includes("how much") || l.includes("start")) {
    return "Unaweza kuanza na KES 5,000 tu — that's about 50 shares at KES 100 each. Smart strategy: spread across 3 farms — maize for stability, avocado for growth, and coffee for premium returns. Karibu!";
  }
  return null;
}

export function AiAssistant({ initialQuestion, role = "investor" }: { initialQuestion?: string; role?: "investor" | "farmer" }) {
  return <VoiceOrb section="default" role={role} />;
}

export function VoiceOrb({ section = "default", itemName = "", role = "investor", farmData = null }: VoiceOrbProps) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const token = getToken();
  const ctx = SECTION_CTX[section] ?? SECTION_CTX.default;

  const doSpeak = useCallback((text: string) => {
    setSpeaking(true);
    speak(text, () => setSpeaking(false));
  }, []);

  const handleMicPress = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();

    if (speaking) { window.speechSynthesis?.cancel(); setSpeaking(false); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      const greeting = farmData
        ? `Jambo! This is ${farmData.name} — a ${farmData.cropType} shamba. ${ctx.intro}`
        : `${ctx.greeting} ${ctx.intro}`;
      doSpeak(greeting);
      return;
    }

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-KE";

    rec.onresult = async (e: any) => {
      const transcript = (e.results[0]?.[0]?.transcript ?? "").trim();
      if (!transcript) return;
      setListening(false);

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

    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); doSpeak("Samahani, sikukusikia. Please press the mic and try again!"); };

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, speaking, doSpeak, ctx, section, farmData, role, token]);

  const isActive = listening || speaking;

  return (
    <motion.div
      className="fixed z-40 pointer-events-none"
      style={{ bottom: "5.5rem", right: "1rem" }}
      animate={{ y: isActive ? [0, -3, 0] : [0, -4, 0, -2, 0] }}
      transition={{ duration: isActive ? 0.6 : 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.button
        onPointerDown={handleMicPress}
        whileTap={{ scale: 0.8 }}
        className="pointer-events-auto relative flex items-center justify-center rounded-full select-none outline-none"
        style={{
          width: 36,
          height: 36,
          background: listening
            ? "linear-gradient(135deg, #dc2626, #ef4444)"
            : speaking
            ? "linear-gradient(135deg, #0369a1, #0ea5e9)"
            : "linear-gradient(135deg, #052e16, #16a34a)",
          boxShadow: listening
            ? "0 0 0 3px rgba(239,68,68,0.3), 0 2px 10px rgba(239,68,68,0.4)"
            : speaking
            ? "0 0 0 3px rgba(14,165,233,0.3), 0 2px 10px rgba(14,165,233,0.4)"
            : "0 2px 10px rgba(22,163,74,0.45)",
        }}
      >
        {listening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-red-400"
              animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-red-300"
              animate={{ scale: [1, 2.0], opacity: [0.4, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: 0.3 }}
            />
          </>
        )}
        {speaking && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-sky-300"
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 0.7, repeat: Infinity }}
          />
        )}
        {listening
          ? <MicOff size={15} className="text-white" />
          : <Mic size={15} className="text-white" />
        }
      </motion.button>
    </motion.div>
  );
}
