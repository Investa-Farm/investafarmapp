import { motion } from "framer-motion";
import { User, TrendingUp, ChevronRight, Leaf } from "lucide-react";
import { TouchIndicator } from "../TouchIndicator";

export default function Scene5() {
  return (
    <motion.div 
      className="absolute inset-0 bg-[#0f1420] text-white flex flex-col"
      initial={{ opacity: 0, x: '100%', filter: "blur(10px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Glow Effect behind content */}
      <motion.div 
        className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] bg-[#16a34a]/30 blur-[100px] rounded-full pointer-events-none"
        initial={{ opacity: 0, scale: 0.5, y: -50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 2, delay: 0.5, ease: "easeOut" }}
      />

      <div className="px-6 pt-20 pb-6 relative z-10 h-full flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.8, ease: "easeOut" }}
          className="flex justify-between items-center mb-8"
        >
          <div>
            <p className="text-white/60 text-[13px] mb-1 font-inter uppercase tracking-wider font-semibold">Good morning,</p>
            <h2 className="font-space-grotesk text-3xl font-bold tracking-tight">Kamau</h2>
          </div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-12 h-12 bg-gradient-to-br from-[#16a34a]/20 to-[#052e16] rounded-full flex items-center justify-center border border-[#16a34a]/30 shadow-lg"
          >
            <User size={20} className="text-[#d4a017]" />
          </motion.div>
        </motion.div>

        {/* Portfolio Card */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: -15 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 1.5, duration: 1, type: "spring", bounce: 0.4 }}
          className="bg-gradient-to-br from-[#052e16] via-[#14532d] to-[#16a34a] p-6 rounded-[28px] border border-[#16a34a]/50 mb-10 relative overflow-hidden shadow-[0_20px_40px_rgba(5,46,22,0.6)]"
        >
          <motion.div 
            className="absolute -right-8 -top-8 text-white/5 rotate-12"
            animate={{ rotate: 20 }} transition={{ duration: 12, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
          >
            <Leaf size={140} />
          </motion.div>
          <p className="text-white/80 text-[13px] font-semibold tracking-wider uppercase mb-2 relative z-10 font-inter">Total Portfolio Value</p>
          <div className="flex items-end gap-2 relative z-10 mb-5">
            <span className="text-[#d4a017] text-lg font-bold mb-1.5 font-inter">KES</span>
            <motion.h3 
               className="font-space-grotesk text-5xl font-bold tracking-tighter"
               initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2, duration: 0.8 }}
            >
              0.00
            </motion.h3>
          </div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 2.6, duration: 0.6 }}
            className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[12px] font-semibold font-inter text-white"
          >
            <TrendingUp size={14} className="text-[#d4a017]" />
            Ready to grow
          </motion.div>
        </motion.div>

        <motion.h4 
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 3.2, duration: 0.6 }}
          className="font-space-grotesk font-bold text-xl mb-4"
        >
          First Investment
        </motion.h4>

        {/* Investment Nudge */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.6, type: "spring", bounce: 0.5 }}
          className="bg-[#1c2433] rounded-[20px] p-4 flex items-center gap-4 border border-white/5 relative overflow-hidden shadow-xl"
        >
          <div className="w-16 h-16 bg-[#16a34a]/20 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden border border-[#16a34a]/30">
             <Leaf size={28} className="text-[#16a34a] relative z-10" />
          </div>
          <div className="flex-1">
            <h5 className="font-space-grotesk font-bold text-[15px] mb-1">Meru Coffee Estate</h5>
            <p className="text-white/50 text-[12px] font-medium font-inter">18% return • 6 months</p>
          </div>
          <motion.div 
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            animate={{ x: [0, 5, 0] }}
            transition={{ delay: 5, duration: 1.5, repeat: Infinity }}
          >
            <ChevronRight size={18} className="text-white/80" />
          </motion.div>
          
          <motion.div 
             className="absolute inset-0 border-2 border-[#16a34a]/40 rounded-[20px] pointer-events-none"
             initial={{ opacity: 0, scale: 1.05 }}
             animate={{ opacity: [0, 1, 0], scale: [1, 1.02, 1] }}
             transition={{ delay: 5, duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <TouchIndicator x="85%" y="50%" delay={6} />
        </motion.div>
      </div>
    </motion.div>
  );
}