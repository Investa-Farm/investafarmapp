import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, Bell } from "lucide-react";

export default function Scene1() {
  return (
    <motion.div
      className="absolute inset-0 bg-[#0a0d14] font-body text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative h-[45%] w-full rounded-b-[40px] overflow-hidden p-6 pt-2">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #052e16, #14532d, #16a34a)' }} />
        
        {/* Subtle noise/texture */}
        <div className="absolute inset-0 opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

        <div className="relative z-10 flex justify-between items-center mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
              <span className="font-display font-bold">JD</span>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20 relative"
          >
            <Bell size={20} />
            <div className="absolute top-2 right-2 w-2 h-2 bg-[#d4a017] rounded-full" />
          </motion.div>
        </div>

        <motion.div className="relative z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <p className="text-white/70 text-sm font-medium mb-1">Total Portfolio Value</p>
          <div className="flex items-end gap-2">
            <span className="font-display font-bold text-4xl">KES 18,450</span>
          </div>
          
          <motion.div 
            className="inline-flex items-center gap-1.5 mt-4 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.6 }}
          >
            <TrendingUp size={16} className="text-[#4ade80]" />
            <span className="text-sm font-semibold text-[#4ade80]">+12.4% ROI</span>
          </motion.div>
        </motion.div>

        {/* Abstract Chart Background */}
        <motion.svg className="absolute bottom-0 left-0 w-full h-32 opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
          <motion.path 
            d="M0 100 L0 80 Q 25 60 50 70 T 100 30 L100 100 Z"
            fill="url(#gradient)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
          />
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </motion.svg>
      </div>

      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="bg-[#1f2937]/50 rounded-2xl p-5 border border-white/5"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display font-semibold">Quick Actions</h3>
          </div>
          <div className="flex gap-4">
            <div className="flex-1 bg-[#16a34a]/20 text-[#4ade80] text-center py-3 rounded-xl font-medium">Invest</div>
            <div className="flex-1 bg-white/5 text-white/80 text-center py-3 rounded-xl font-medium">Withdraw</div>
          </div>
        </motion.div>
      </div>
      
      {/* Tap indicator */}
      <motion.div
        className="absolute bottom-[20%] right-[30%] w-12 h-12 rounded-full border-2 border-white/50 z-50 pointer-events-none"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.5, 2], opacity: [0, 1, 0] }}
        transition={{ duration: 1, delay: 3, repeat: 1, repeatDelay: 1 }}
      />
    </motion.div>
  );
}
