import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ShieldCheck, Fingerprint, Lock } from "lucide-react";

export default function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 2000); // Slide up to authenticate
    const t3 = setTimeout(() => setPhase(3), 3500); // Authenticating...
    const t4 = setTimeout(() => setPhase(4), 5500); // Authenticated!
    const t5 = setTimeout(() => setPhase(5), 7500); // Next scene transition
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[#0f1420] text-white font-body"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -50, filter: "blur(10px)" }}
      transition={{ duration: 0.6 }}
    >
      {/* Background showing previous screen blurred (simulated with a gradient) */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#14532d]/20 to-[#0f1420] blur-xl opacity-50" />
      
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0" />

      {/* Bottom Sheet Modal */}
      <motion.div 
        className="absolute bottom-0 inset-x-0 bg-[#1a2030] rounded-t-[32px] p-6 z-10 border-t border-white/10"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.3 }}
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        >
          <h2 className="font-display text-2xl font-bold mb-1">Confirm Purchase</h2>
          <p className="text-gray-400 text-sm mb-6">Nakuru Wheat Farm • Secondary Market</p>

          <div className="bg-[#0f1420] rounded-xl p-4 border border-white/5 mb-6">
            <div className="flex justify-between mb-3 text-sm">
              <span className="text-gray-400">Order Type</span>
              <span className="font-medium text-white">Instant Buy</span>
            </div>
            <div className="flex justify-between mb-3 text-sm">
              <span className="text-gray-400">Quantity</span>
              <span className="font-medium text-white">25 Shares</span>
            </div>
            <div className="flex justify-between mb-4 text-sm">
              <span className="text-gray-400">Price per share</span>
              <span className="font-medium text-white">KES 52.00</span>
            </div>
            
            <div className="h-px bg-white/10 w-full mb-4" />
            
            <div className="flex justify-between items-end">
              <span className="text-gray-300 font-medium">Total Cost</span>
              <span className="font-display font-bold text-2xl text-[#d4a017]">KES 1,300</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="bg-[#16a34a]/10 border border-[#16a34a]/30 rounded-xl p-4 flex items-start gap-3 mb-8"
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }}
        >
          <Lock className="w-5 h-5 text-[#16a34a] mt-0.5" />
          <div className="text-sm text-gray-300">
            <span className="font-bold text-white">Instant Settlement.</span> Funds will be deducted from your wallet immediately.
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          className="relative pb-6"
        >
          {phase < 2 ? (
            <div className="w-full py-4 bg-[#16a34a] text-white font-bold text-lg font-display rounded-xl text-center shadow-[0_4px_20px_rgba(22,163,74,0.4)] relative overflow-hidden">
              <motion.div 
                className="absolute inset-0 bg-white/20"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
              Swipe to Confirm
            </div>
          ) : (
            <motion.div 
              className="w-full flex flex-col items-center justify-center py-2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <motion.div 
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-500 ${phase >= 4 ? 'bg-[#16a34a]' : 'bg-[#1a2030] border-2 border-[#16a34a]'}`}
                animate={phase === 3 ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                transition={{ duration: 0.5, repeat: phase === 3 ? Infinity : 0 }}
              >
                {phase >= 4 ? (
                  <ShieldCheck className="w-8 h-8 text-white" />
                ) : (
                  <Fingerprint className="w-8 h-8 text-[#16a34a]" />
                )}
              </motion.div>
              <div className="mt-3 text-sm font-medium text-center">
                {phase >= 4 ? (
                  <span className="text-[#16a34a] font-bold">Authenticated</span>
                ) : (
                  <span className="text-gray-400">Authenticating...</span>
                )}
              </div>
            </motion.div>
          )}

          {phase === 1 && (
            <motion.div
              className="absolute top-1/2 left-10 -translate-y-1/2 pointer-events-none z-50"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.5, opacity: [0, 1, 0], x: [0, 150] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            >
              <div className="w-8 h-8 rounded-full border-2 border-white bg-white/50 shadow-lg" />
            </motion.div>
          )}
        </motion.div>

      </motion.div>
    </motion.div>
  );
}
