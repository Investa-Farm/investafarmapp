import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ChevronLeft, Leaf, Plus, Minus } from "lucide-react";

export default function Scene1() {
  const [shares, setShares] = useState(10);
  
  useEffect(() => {
    let startTime = Date.now();
    const duration = 2000;
    
    const animateShares = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentShares = Math.floor(10 + (40 * easeOut));
      setShares(currentShares);
      
      if (progress < 1) {
        requestAnimationFrame(animateShares);
      }
    };
    
    const timeout = setTimeout(() => {
      requestAnimationFrame(animateShares);
    }, 1500);
    
    return () => clearTimeout(timeout);
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 w-full h-full flex flex-col bg-[#0f1420]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="pt-14 pb-4 px-6 flex items-center justify-between border-b border-zinc-800">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <ChevronLeft className="w-6 h-6 text-zinc-400" />
        </motion.div>
        <motion.h1 initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="font-space font-medium text-lg text-white">
          Invest
        </motion.h1>
        <div className="w-6 h-6" />
      </div>

      <div className="flex-1 px-6 py-6 overflow-hidden flex flex-col">
        <motion.div 
          className="flex items-center gap-4 mb-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="w-16 h-16 rounded-xl bg-green-900/40 flex items-center justify-center border border-green-800/50">
             <Leaf className="w-8 h-8 text-green-500" />
          </div>
          <div>
             <h2 className="text-xl font-space font-bold text-white mb-1">Kiambu Maize Farm</h2>
             <div className="flex items-center gap-2">
               <span className="text-zinc-400 text-sm">KES 45 / share</span>
               <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
               <span className="text-green-500 text-sm font-medium">18% p.a.</span>
             </div>
          </div>
        </motion.div>

        <motion.div 
          className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 250, damping: 25 }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-600 to-green-400"></div>
          
          <h3 className="text-zinc-400 text-sm font-medium mb-6 text-center">HOW MANY SHARES?</h3>
          
          <div className="flex items-center justify-between mb-8">
            <button className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
               <Minus className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center">
               <motion.span className="text-5xl font-space font-bold text-white mb-2">
                 {shares}
               </motion.span>
               <span className="text-zinc-500 text-sm font-medium">SHARES</span>
            </div>
            <button className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
               <Plus className="w-6 h-6" />
            </button>
          </div>

          <div className="relative h-2 bg-zinc-800 rounded-full mb-8">
            <motion.div 
               className="absolute top-0 left-0 h-full bg-green-500 rounded-full"
               animate={{ width: `\${(shares / 100) * 100}%` }}
               transition={{ ease: "easeOut", duration: 0.1 }}
            ></motion.div>
            <motion.div 
               className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-[0_0_15px_rgba(22,163,74,0.5)] border-2 border-green-500"
               animate={{ left: `calc(\${(shares / 100) * 100}% - 12px)` }}
               transition={{ ease: "easeOut", duration: 0.1 }}
            ></motion.div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-zinc-800/80">
            <span className="text-zinc-400">Total Investment</span>
            <span className="text-xl font-space font-bold text-white">
              KES {(shares * 45).toLocaleString()}
            </span>
          </div>
        </motion.div>

        <div className="flex-1"></div>

        <motion.div 
           className="relative w-full"
           initial={{ y: 40, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ delay: 1.2, type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 rounded-2xl text-center font-bold text-lg text-white shadow-[0_10px_25px_-5px_rgba(22,163,74,0.4)]">
             Review Order
          </div>
          
          <motion.div 
             className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white mix-blend-overlay"
             initial={{ scale: 0, opacity: 0 }}
             animate={{ scale: [0, 1.5], opacity: [0, 0.4, 0] }}
             transition={{ delay: 8.5, duration: 0.6 }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}