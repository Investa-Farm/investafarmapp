import { motion } from "framer-motion";
import { Lock } from "lucide-react";

export default function Scene4() {
  return (
    <motion.div 
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#0f1420]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
    >
      <div className="relative w-32 h-32 flex items-center justify-center mb-8">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
           <circle cx="50" cy="50" r="45" fill="none" stroke="#27272a" strokeWidth="4" />
        </svg>
        
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
           <motion.circle 
              cx="50" cy="50" r="45" fill="none" 
              stroke="#16a34a" strokeWidth="4" strokeLinecap="round"
              strokeDasharray="283"
              initial={{ strokeDashoffset: 283 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 6, ease: "easeInOut", delay: 0.5 }}
           />
        </svg>

        <motion.div 
          className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center border border-green-500/30"
          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Lock className="w-8 h-8 text-green-500" />
        </motion.div>
      </div>

      <motion.h2 
         className="text-2xl font-space font-bold text-white mb-2"
         initial={{ opacity: 0, y: 10 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ delay: 1 }}
      >
         Securing your stake...
      </motion.h2>
      
      <motion.p 
         className="text-zinc-400 text-center px-8"
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         transition={{ delay: 1.5 }}
      >
         Allocating 50 shares of <br/>Kiambu Maize
      </motion.p>
    </motion.div>
  );
}