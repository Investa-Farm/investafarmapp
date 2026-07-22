import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, Calendar, ArrowUpRight } from "lucide-react";

export default function Scene4() {
  const dividends = [
    { month: "October", amount: 310, date: "Oct 15, 2023" },
    { month: "November", amount: 325, date: "Nov 15, 2023" },
    { month: "December", amount: 340, date: "Dec 15, 2023" },
  ];

  return (
    <motion.div
      className="absolute inset-0 bg-[#0a0d14] font-body text-white"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.8 }}
    >
      <div className="p-6 pt-4">
        <motion.div 
          className="w-12 h-12 rounded-full bg-[#16a34a]/20 flex items-center justify-center mb-4 text-[#4ade80]"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
        >
          <TrendingUp size={24} />
        </motion.div>
        <motion.h2 
          className="text-2xl font-display font-bold mb-1"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
          Dividend History
        </motion.h2>
        <motion.p 
          className="text-white/50 text-sm mb-8"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        >
          Consistent growing returns
        </motion.p>

        <div className="relative">
          {/* Vertical line */}
          <motion.div 
            className="absolute left-[23px] top-4 bottom-4 w-0.5 bg-white/10"
            initial={{ scaleY: 0, originY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
          />

          <div className="space-y-6">
            {dividends.map((div, i) => (
              <motion.div 
                key={div.month}
                className="relative flex gap-4 items-start"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.3, type: "spring" }}
              >
                <div className="relative z-10 w-12 h-12 rounded-full bg-[#1f2937] border-4 border-[#0a0d14] flex items-center justify-center shrink-0 mt-1">
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-[#d4a017]"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8 + i * 0.3 }}
                  />
                </div>
                
                <div className="flex-1 bg-[#1f2937]/40 rounded-2xl p-4 border border-white/5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-sm">{div.month} Payout</h3>
                      <p className="text-white/40 text-xs flex items-center gap-1 mt-1">
                        <Calendar size={10} /> {div.date}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-display font-bold text-[#4ade80]">KES {div.amount}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Scroll indicator or accent */}
      <motion.div 
        className="absolute bottom-10 inset-x-0 flex justify-center"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.5 }}
      >
        <div className="flex items-center gap-2 bg-[#16a34a] text-white px-5 py-3 rounded-full shadow-[0_0_20px_rgba(22,163,74,0.3)] cursor-pointer">
           <span className="font-semibold text-sm">Download Tax Report</span>
           <ArrowUpRight size={16} />
        </div>
      </motion.div>

    </motion.div>
  );
}
