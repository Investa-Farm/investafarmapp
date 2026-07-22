import { motion } from "framer-motion";
import { User, Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { TouchIndicator } from "../TouchIndicator";

const TypingText = ({ text, delay, duration }: { text: string; delay: number, duration: number }) => {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    let timer = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayed(text.substring(0, i + 1));
        i++;
        if (i === text.length) clearInterval(interval);
      }, duration / text.length);
      return () => clearInterval(interval);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [text, delay, duration]);
  return <>{displayed}</>;
};

export default function Scene2() {
  return (
    <motion.div 
      className="absolute inset-0 bg-[#0f1420] text-white p-6 pt-24"
      initial={{ opacity: 0, x: '100%', filter: "blur(10px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: '-100%', filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2 
        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
        className="font-space-grotesk text-3xl font-bold mb-2"
      >
        Create Account
      </motion.h2>
      <motion.p 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        className="text-white/50 text-sm mb-10 font-inter"
      >
        Join the future of agribusiness
      </motion.p>

      <div className="space-y-6">
        <InputField 
          icon={<User size={18} />} label="Full Name" 
          value={<TypingText text="David Kamau" delay={1.5} duration={1000} />}
          activeDelay={1.5}
        />
        <InputField 
          icon={<Mail size={18} />} label="Email Address" 
          value={<TypingText text="david.k@example.com" delay={3.0} duration={1200} />}
          activeDelay={3.0}
        />
        <InputField 
          icon={<Phone size={18} />} label="Phone Number" 
          value={<TypingText text="+254 712 345 678" delay={4.8} duration={1200} />}
          activeDelay={4.8}
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 6.5, type: "spring", bounce: 0.4 }}
        className="absolute bottom-10 left-6 right-6"
      >
        <div className="relative h-14 bg-gradient-to-r from-[#14532d] to-[#16a34a] rounded-2xl flex items-center justify-center font-semibold text-lg overflow-hidden shadow-[0_4px_20px_rgba(22,163,74,0.3)]">
          <motion.div 
             className="absolute inset-0 bg-white/20" 
             initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ delay: 7.5, duration: 0.6, ease: "easeInOut" }} 
          />
          <span className="font-inter tracking-wide">Continue</span>
          <TouchIndicator x="50%" y="50%" delay={7.6} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function InputField({ icon, label, value, activeDelay }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: activeDelay - 0.5, duration: 0.6, ease: "easeOut" }}
      className="relative"
    >
      <label className="block text-[11px] font-semibold text-white/60 mb-1.5 ml-1 uppercase tracking-wider font-inter">{label}</label>
      <motion.div 
        className="flex items-center gap-3 px-4 h-14 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm"
        animate={{ 
          borderColor: ['rgba(255,255,255,0.1)', 'rgba(212,160,23,0.8)', 'rgba(255,255,255,0.1)'],
          backgroundColor: ['rgba(255,255,255,0.05)', 'rgba(212,160,23,0.05)', 'rgba(255,255,255,0.05)']
        }}
        transition={{ delay: activeDelay, duration: 1.5, times: [0, 0.2, 1], ease: "easeInOut" }}
      >
        <span className="text-[#d4a017]/80">{icon}</span>
        <span className="text-white/95 font-medium font-inter text-[15px]">{value}</span>
      </motion.div>
    </motion.div>
  );
}