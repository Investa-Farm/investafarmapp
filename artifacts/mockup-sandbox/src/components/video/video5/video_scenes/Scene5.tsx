import { motion } from "framer-motion";
import { CheckCircle2, Wallet, ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";

export default function Scene5() {
  const [balance, setBalance] = useState(750);
  
  useEffect(() => {
    // Count up animation
    const duration = 1500;
    const startValue = 750;
    const endValue = 3750;
    const startTime = performance.now();
    
    const animateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      setBalance(Math.floor(startValue + (endValue - startValue) * easeProgress));
      
      if (progress < 1) {
        requestAnimationFrame(animateCount);
      }
    };
    
    const timeout = setTimeout(() => requestAnimationFrame(animateCount), 500);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col pt-16 px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold font-['Space_Grotesk']">Wallet</h1>
        <div className="w-10 h-10 rounded-full bg-[#16a34a]/20 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-[#16a34a]" />
        </div>
      </div>

      <motion.div
        className="relative bg-gradient-to-br from-[#16a34a] to-[#052e16] p-6 rounded-3xl mb-8 overflow-hidden shadow-[0_0_30px_rgba(22,163,74,0.3)] border border-[#16a34a]/30"
        animate={{
          scale: [1, 1.02, 1],
          boxShadow: ["0 0 30px rgba(22,163,74,0.3)", "0 0 50px rgba(22,163,74,0.6)", "0 0 30px rgba(22,163,74,0.3)"]
        }}
        transition={{ duration: 1.5, delay: 0.5 }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <p className="text-white/80 text-sm mb-2">Available Balance</p>
        <div className="flex items-end gap-2 mb-6">
          <span className="text-xl font-medium text-[#d4a017]">KES</span>
          <span className="text-4xl font-bold font-['Space_Grotesk'] tracking-tight">
            {balance.toLocaleString()}.00
          </span>
        </div>

        <div className="flex gap-4">
          <button className="flex-1 bg-white/20 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Top Up
          </button>
          <button className="flex-1 bg-black/20 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium">
            <ArrowUpRight className="w-4 h-4" /> Withdraw
          </button>
        </div>
      </motion.div>

      {/* Success Notification */}
      <motion.div
        initial={{ y: -50, opacity: 0, scale: 0.8 }}
        animate={{ y: -160, opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.8 }}
        className="absolute top-1/2 left-5 right-5 bg-white text-black p-4 rounded-2xl flex items-center gap-4 shadow-2xl z-20"
      >
        <div className="w-12 h-12 rounded-full bg-[#16a34a]/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-7 h-7 text-[#16a34a]" />
        </div>
        <div>
          <h3 className="font-bold font-['Space_Grotesk']">Top-up Successful!</h3>
          <p className="text-sm text-gray-600">KES 3,000 received from M-Pesa</p>
        </div>
      </motion.div>

      <div className="flex-1">
        <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
        <div className="space-y-4">
          {/* New Transaction */}
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ delay: 2, duration: 0.5 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#16a34a]/10 border border-[#16a34a]/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#16a34a]/20 text-[#16a34a]">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-sm text-white/90">Wallet Top Up</p>
                  <p className="text-xs text-[#16a34a]">Just now</p>
                </div>
              </div>
              <span className="font-semibold text-sm text-[#16a34a]">
                +KES 3,000
              </span>
            </div>
          </motion.div>
          
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500/20 text-red-500">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm text-white/90">Kiambu Maize Farm</p>
                <p className="text-xs text-white/50">Today, 10:42 AM</p>
              </div>
            </div>
            <span className="font-semibold text-sm text-white">
              -KES 5,000
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
