import React from "react";
import { motion } from "framer-motion";
import { Sprout, Sun, Tractor, ChevronRight } from "lucide-react";

export default function Scene5() {
  const updates = [
    { stage: "Planting Phase", date: "2 weeks ago", icon: Sprout, status: "completed", desc: "Seeds sown across 50 acres. Soil moisture at optimal 42%." },
    { stage: "Growing Phase", date: "Present", icon: Sun, status: "active", desc: "Crops are sprouting. First round of organic fertilizer applied." },
    { stage: "Harvest Phase", date: "Est. in 3 months", icon: Tractor, status: "upcoming", desc: "Projected yield: 120 tonnes. Buyers secured." },
  ];

  return (
    <motion.div
      className="absolute inset-0 bg-[#0a0d14] font-body text-white flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Header */}
      <div className="relative h-48 rounded-b-[40px] overflow-hidden shrink-0 mt-[-10px]">
        <motion.div 
          className="absolute inset-0"
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ duration: 8, ease: "linear" }}
        >
          {/* We'll use a CSS gradient as placeholder for farm image */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#16a34a] to-[#052e16] opacity-80" />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05]" />
        </motion.div>
        
        <div className="absolute inset-0 p-6 flex flex-col justify-end pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          >
            <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold mb-2 border border-white/10">
              Kiambu Maize Farm
            </div>
            <h2 className="text-2xl font-display font-bold">Live Progress</h2>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-hidden relative">
        <motion.div 
          className="absolute left-[39px] top-6 bottom-10 w-0.5 bg-white/10"
          initial={{ scaleY: 0, originY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.5, delay: 0.5 }}
        />

        <div className="space-y-6 relative z-10">
          {updates.map((update, i) => {
            const isActive = update.status === "active";
            const isCompleted = update.status === "completed";
            
            return (
              <motion.div 
                key={update.stage}
                className="flex gap-4 relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.4 }}
              >
                <div className="relative z-10 shrink-0">
                  <motion.div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2
                      ${isActive ? 'bg-[#16a34a] border-[#4ade80] text-white shadow-[0_0_15px_rgba(74,222,128,0.5)]' : 
                        isCompleted ? 'bg-[#1f2937] border-[#16a34a] text-[#4ade80]' : 
                        'bg-[#1f2937] border-white/10 text-white/30'}`}
                    animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                    transition={isActive ? { repeat: Infinity, duration: 2 } : {}}
                  >
                    <update.icon size={18} />
                  </motion.div>
                </div>

                <div className={`flex-1 pt-1 pb-4 ${i !== updates.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="flex justify-between items-center mb-1">
                    <h3 className={`font-semibold ${isActive ? 'text-[#4ade80]' : isCompleted ? 'text-white' : 'text-white/40'}`}>
                      {update.stage}
                    </h3>
                    <span className="text-xs text-white/40">{update.date}</span>
                  </div>
                  <p className={`text-sm leading-relaxed ${isActive || isCompleted ? 'text-white/70' : 'text-white/30'}`}>
                    {update.desc}
                  </p>
                  
                  {isActive && (
                    <motion.div 
                      className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#d4a017] cursor-pointer bg-[#d4a017]/10 w-fit px-3 py-1.5 rounded-full"
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.5 }}
                    >
                      View Live Camera <ChevronRight size={14} />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  );
}
