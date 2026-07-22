import React from "react";
import { motion } from "framer-motion";
import { Leaf, Wheat, Coffee } from "lucide-react";

const holdings = [
  { name: "Kiambu Maize Farm", shares: 50, value: 5000, pl: "+850", icon: Leaf, color: "text-[#4ade80]", bg: "bg-[#16a34a]/20" },
  { name: "Nakuru Wheat Project", shares: 30, value: 8400, pl: "+420", icon: Wheat, color: "text-[#d4a017]", bg: "bg-[#d4a017]/20" },
  { name: "Meru Coffee Estate", shares: 20, value: 5050, pl: "-120", icon: Coffee, color: "text-red-400", bg: "bg-red-400/20" },
];

export default function Scene2() {
  return (
    <motion.div
      className="absolute inset-0 bg-[#0a0d14] font-body text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Header shrinks up */}
      <motion.div
        className="relative w-full bg-[#052e16] p-6 pt-2 pb-6 rounded-b-[30px]"
        initial={{ height: "45%" }}
        animate={{ height: "12%" }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="absolute inset-0 opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        
        <div className="relative flex justify-between w-full items-center h-full pt-4">
          <motion.span 
            className="font-display font-bold text-white"
            initial={{ fontSize: "36px", y: 40 }}
            animate={{ fontSize: "20px", y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            KES 18,450
          </motion.span>
          <motion.span
            className="text-[#4ade80] font-semibold text-sm bg-white/10 px-2 py-1 rounded-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            +12.4%
          </motion.span>
        </div>
      </motion.div>

      <div className="p-6">
        <motion.h2 
          className="text-lg font-display font-bold mb-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          Your Holdings
        </motion.h2>

        <div className="space-y-4">
          {holdings.map((h, i) => (
            <motion.div
              key={h.name}
              className="bg-[#1f2937]/40 rounded-2xl p-4 border border-white/5 flex items-center justify-between"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.2, type: "spring" }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${h.bg}`}>
                  <h.icon className={h.color} size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{h.name}</h3>
                  <p className="text-white/50 text-xs">{h.shares} Shares</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold font-display">KES {h.value.toLocaleString()}</p>
                <p className={`text-xs font-semibold ${h.pl.startsWith('+') ? 'text-[#4ade80]' : 'text-red-400'}`}>
                  {h.pl.startsWith('+') ? '▲' : '▼'} {h.pl}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Tap indicator on Nakuru */}
      <motion.div
        className="absolute top-[45%] right-[20%] w-12 h-12 rounded-full border-2 border-white/50 z-50 pointer-events-none"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.5, 2], opacity: [0, 1, 0] }}
        transition={{ duration: 1, delay: 3, repeat: 1, repeatDelay: 1 }}
      />
    </motion.div>
  );
}
