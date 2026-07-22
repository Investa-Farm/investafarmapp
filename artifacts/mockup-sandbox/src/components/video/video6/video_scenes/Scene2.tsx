import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowLeft, Star, ShieldCheck, ChevronRight, Activity } from "lucide-react";

export default function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 1600);
    const t3 = setTimeout(() => setPhase(3), 2400);
    const t4 = setTimeout(() => setPhase(4), 6000); // tap view order book
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[#0f1420] text-white font-body"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100, filter: "blur(5px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#14532d]/40 to-transparent pointer-events-none" />
      
      <div className="pt-14 px-6 pb-6 h-full flex flex-col relative z-10">
        <motion.div 
          className="flex items-center gap-3 mb-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
          <span className="font-display font-medium text-lg text-gray-300">Listing Details</span>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl font-bold mb-2">Nakuru Wheat Farm</h1>
          <div className="flex gap-2">
            <span className="px-2.5 py-1 bg-[#16a34a]/20 text-[#16a34a] rounded text-xs font-bold uppercase tracking-wider">Premium Listing</span>
            <span className="px-2.5 py-1 bg-white/10 text-gray-300 rounded text-xs font-medium">Harvest in 2 months</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 200, damping: 20 }}
          className="bg-gradient-to-br from-[#1a2333] to-[#0f1420] p-5 rounded-2xl border border-white/10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck className="w-24 h-24" />
          </div>
          <div className="text-sm text-gray-400 mb-1">Listed Price per Share</div>
          <div className="font-display text-4xl font-bold text-white mb-1">KES 52.00</div>
          <div className="text-sm font-medium text-green-400 mb-6">+15.5% vs Face Value (KES 45)</div>

          <div className="flex justify-between items-center border-t border-white/10 pt-4">
            <div>
              <div className="text-xs text-gray-400 mb-1">Available Qty</div>
              <div className="font-bold text-xl">25 Shares</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-1">Total Value</div>
              <div className="font-bold text-xl text-[#d4a017]">KES 1,300</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-6 flex items-center p-4 bg-white/5 rounded-2xl border border-white/5"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg font-bold mr-4">JK</div>
          <div className="flex-1">
            <div className="font-bold">J. Kamau</div>
            <div className="flex items-center text-xs text-gray-400 mt-1">
              <Star className="w-3 h-3 text-[#d4a017] fill-[#d4a017] mr-1" />
              <span className="font-medium text-white mr-1">4.9</span> (12 trades) • Verified
            </div>
          </div>
          <ShieldCheck className="w-5 h-5 text-[#16a34a]" />
        </motion.div>

        <div className="mt-auto relative pb-6">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ 
              y: 0, 
              opacity: 1,
              scale: phase >= 4 ? 0.95 : 1,
              backgroundColor: phase >= 4 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'
            }}
            transition={{ delay: phase >= 4 ? 0 : 1.1, duration: 0.3 }}
            className={`w-full py-4 rounded-xl flex items-center justify-between px-6 font-display font-bold text-lg border border-white/10 transition-colors`}
          >
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-gray-300" />
              View Order Book
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </motion.div>

          {phase >= 4 && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="w-16 h-16 rounded-full border-2 border-white bg-white/20" />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
