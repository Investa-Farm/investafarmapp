import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { TouchIndicator } from "../TouchIndicator";

export default function Scene3() {
  return (
    <motion.div 
      className="absolute inset-0 bg-[#0f1420] text-white p-6 pt-24"
      initial={{ opacity: 0, x: '100%', filter: "blur(10px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(5px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2 
        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
        className="font-space-grotesk text-3xl font-bold mb-2"
      >
        Verify Phone
      </motion.h2>
      <motion.p 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        className="text-white/50 text-sm mb-12 font-inter"
      >
        Enter the 6-digit code sent to<br/><span className="text-white font-medium">+254 712 345 678</span>
      </motion.p>

      <div className="flex justify-between gap-2 mb-8 relative z-10">
        {[4, 9, 2, 0, 1, 5].map((digit, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 + i * 0.1, duration: 0.5, type: "spring" }}
            className="w-11 h-14 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-xl font-bold font-space-grotesk relative overflow-hidden backdrop-blur-sm"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 4 + i * 0.15, type: "spring", bounce: 0.6 }}
            >
              {digit}
            </motion.span>
            
            {/* Active state border indicator */}
            <motion.div 
               className="absolute inset-0 border-[1.5px] border-[#d4a017] rounded-xl pointer-events-none opacity-0"
               animate={{ opacity: [0, 1, 0], scale: [1, 1.05, 1] }}
               transition={{ delay: 3.8 + i * 0.15, duration: 0.4 }}
            />
          </motion.div>
        ))}
      </div>

      {/* M-PESA Notification Banner */}
      <motion.div
        initial={{ y: -200, opacity: 0, rotateX: 20 }}
        animate={{ y: 20, opacity: 1, rotateX: 0 }}
        exit={{ y: -200, opacity: 0, rotateX: -20 }}
        transition={{ delay: 2.2, duration: 0.8, type: "spring", bounce: 0.5 }}
        className="absolute top-0 left-4 right-4 bg-[#1c2433]/90 backdrop-blur-xl rounded-[20px] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)] border border-white/10 flex gap-3 z-50 overflow-hidden"
      >
        <div className="w-10 h-10 rounded-full bg-[#16a34a] flex items-center justify-center shrink-0 text-white font-bold text-[10px] tracking-tighter shadow-inner">
          M-PESA
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-0.5">
            <span className="font-semibold text-[13px] text-white font-inter">Messages</span>
            <span className="text-[10px] text-white/40">now</span>
          </div>
          <p className="text-[12px] text-white/80 leading-relaxed font-inter">
            <strong className="text-white font-semibold">492015</strong> is your Investa Farm verification code. Do not share it.
          </p>
        </div>
        
        {/* Shine effect on notification */}
        <motion.div 
           className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-[200%] h-full skew-x-[-20deg]"
           initial={{ x: '-100%' }}
           animate={{ x: '100%' }}
           transition={{ delay: 2.8, duration: 1, ease: "easeInOut" }}
        />
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 5.5, type: "spring", bounce: 0.4 }}
        className="absolute bottom-10 left-6 right-6"
      >
        <div className="relative h-14 bg-gradient-to-r from-[#14532d] to-[#16a34a] rounded-2xl flex items-center justify-center font-semibold text-lg overflow-hidden shadow-[0_4px_20px_rgba(22,163,74,0.3)]">
          <span className="font-inter tracking-wide">Verify Code</span>
          <TouchIndicator x="50%" y="50%" delay={6.5} />
        </div>
      </motion.div>
    </motion.div>
  );
}