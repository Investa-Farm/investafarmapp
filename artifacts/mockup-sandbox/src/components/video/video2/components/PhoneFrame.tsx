import { ReactNode } from "react";
import { motion } from "framer-motion";

export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <motion.div 
      className="relative w-[375px] h-[812px] bg-[#050810] rounded-[50px] shadow-2xl border-[8px] border-[#1f2937] overflow-hidden z-10 flex flex-col shrink-0 ring-1 ring-white/10"
      initial={{ scale: 0.9, opacity: 0, rotateY: -10, perspective: 1000 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Dynamic Island / Notch */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[110px] h-[30px] bg-black rounded-[20px] z-[100] flex items-center justify-center shadow-lg">
        <div className="w-[8px] h-[8px] rounded-full bg-[#111827] ring-1 ring-white/10 ml-auto mr-4 flex items-center justify-center">
            <div className="w-[4px] h-[4px] rounded-full bg-blue-900/40" />
        </div>
      </div>

      {/* Screen Area */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-[#0a0e17] text-white">
        {children}
      </div>

      {/* Home Indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[130px] h-[5px] bg-white/30 rounded-full z-[100]" />
    </motion.div>
  );
}