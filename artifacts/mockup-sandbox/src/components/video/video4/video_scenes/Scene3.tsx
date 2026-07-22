import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 bg-[#0a0d14] font-body text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="relative w-full h-[12%] bg-[#052e16] p-6 rounded-b-[30px]" />
      
      {/* Previous holdings behind overlay */}
      <div className="p-6 opacity-30 blur-sm pointer-events-none">
        <h2 className="text-lg font-display font-bold mb-4">Your Holdings</h2>
        <div className="space-y-4">
          {[1,2,3].map((i) => (
             <div key={i} className="h-20 bg-[#1f2937] rounded-2xl" />
          ))}
        </div>
      </div>

      {/* Overlay */}
      <motion.div 
        className="absolute inset-0 bg-[#0a0d14]/80 flex items-center justify-center p-6 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className="bg-gradient-to-br from-[#16a34a]/30 to-[#052e16]/90 border border-[#4ade80]/30 rounded-3xl p-6 w-full relative overflow-hidden shadow-[0_0_50px_rgba(22,163,74,0.2)]"
          initial={{ scale: 0.8, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 20, stiffness: 100, delay: 0.3 }}
        >
          {/* Sparkles bg */}
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Sparkles size={100} className="text-[#d4a017]" />
          </div>

          <div className="w-12 h-12 rounded-full bg-[#d4a017]/20 flex items-center justify-center mb-4">
            <Sparkles size={24} className="text-[#d4a017]" />
          </div>

          <h3 className="font-display font-bold text-xl mb-2">AI Portfolio Insight</h3>
          <p className="text-white/80 text-sm mb-8 leading-relaxed">
            Your portfolio outperforms the category average by <strong className="text-[#4ade80]">4.2%</strong> this month.
          </p>

          <div className="flex items-end gap-6 h-32 mt-4 px-2">
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full relative flex-1 flex items-end justify-center">
                <motion.div 
                  className="w-12 bg-white/20 rounded-t-lg"
                  initial={{ height: 0 }}
                  animate={{ height: "60%" }}
                  transition={{ duration: 1, delay: 0.8 }}
                />
              </div>
              <span className="text-xs text-white/50 font-medium text-center">Market<br/>Avg</span>
            </div>
            
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full relative flex-1 flex items-end justify-center">
                <motion.div 
                  className="w-12 bg-[#4ade80] rounded-t-lg relative"
                  initial={{ height: 0 }}
                  animate={{ height: "100%" }}
                  transition={{ duration: 1, delay: 1, type: "spring" }}
                >
                  <motion.div 
                    className="absolute -top-8 w-full text-center text-[#4ade80] font-bold text-sm"
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 1.5 }}
                  >
                    +4.2%
                  </motion.div>
                </motion.div>
              </div>
              <span className="text-xs text-white/90 font-medium text-center">Your<br/>Portfolio</span>
            </div>
          </div>

          <motion.div 
            className="mt-8 w-full py-3 bg-white/10 rounded-xl text-center text-sm font-semibold border border-white/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            View Full Analysis
          </motion.div>

        </motion.div>
      </motion.div>
    </motion.div>
  );
}
