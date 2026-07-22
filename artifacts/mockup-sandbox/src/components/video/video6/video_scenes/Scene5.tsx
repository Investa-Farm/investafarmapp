import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, FileText, ArrowRight, Bell } from "lucide-react";

export default function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1000);
    const t2 = setTimeout(() => setPhase(2), 2500); // Show details
    const t3 = setTimeout(() => setPhase(3), 4000); // Show notification
    const t4 = setTimeout(() => setPhase(4), 5500); // Show portfolio button
    const t5 = setTimeout(() => setPhase(5), 7000); // click button
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[#16a34a] text-white font-body"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, type: "spring", damping: 20 }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#22c55e_0%,#14532d_100%)]" />
      
      {/* Confetti or particle effect in background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={`confetti-${i}`}
            className="absolute w-2 h-2 rounded-full bg-white"
            initial={{ 
              top: "100%", 
              left: `${Math.random() * 100}%`,
              scale: Math.random() * 2 + 0.5
            }}
            animate={{ 
              top: "-10%",
              left: `${Math.random() * 100}%`,
            }}
            transition={{ 
              duration: Math.random() * 2 + 2, 
              delay: Math.random() * 1,
              ease: "easeOut"
            }}
          />
        ))}
      </div>

      <div className="relative z-10 h-full flex flex-col items-center justify-center p-6 text-center pt-20">
        
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          className="w-24 h-24 rounded-full bg-white flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(255,255,255,0.4)] mx-auto"
        >
          <CheckCircle2 className="w-12 h-12 text-[#16a34a]" />
        </motion.div>

        <motion.h1 
          className="font-display text-4xl font-bold mb-2 text-white"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        >
          Trade Executed!
        </motion.h1>
        
        <motion.p 
          className="text-white/80 text-lg mb-10"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
        >
          You bought 25 shares of Nakuru Wheat
        </motion.p>

        <div className="w-full max-w-sm space-y-4">
          <AnimatePresence>
            {phase >= 1 && (
              <motion.div
                initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0f1420] flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#d4a017]" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">Digital Certificate</div>
                    <div className="text-xs text-white/70">Ownership transferred</div>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-white" />
              </motion.div>
            )}

            {phase >= 2 && (
              <motion.div
                initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring" }}
                className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0f1420] flex items-center justify-center">
                    <Bell className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">Seller Notified</div>
                    <div className="text-xs text-white/70">J. Kamau received funds</div>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          className="absolute bottom-10 inset-x-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: phase >= 4 ? 1 : 0, y: phase >= 4 ? 0 : 30 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative">
            <motion.div 
              className={`w-full py-4 font-display text-lg font-bold rounded-xl flex items-center justify-center gap-2 shadow-xl transition-transform ${phase >= 5 ? 'scale-95 bg-gray-100 text-[#14532d]' : 'bg-white text-[#14532d]'}`}
            >
              View My Portfolio
              <ArrowRight className="w-5 h-5" />
            </motion.div>
            {phase >= 5 && (
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
                initial={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: 4, opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <div className="w-16 h-16 rounded-full border-2 border-[#16a34a] bg-black/10" />
              </motion.div>
            )}
          </div>
        </motion.div>
        
      </div>
    </motion.div>
  );
}
