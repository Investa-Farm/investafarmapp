import { motion } from "framer-motion";
import { ChevronLeft, Receipt, CheckCircle2, TrendingUp, Calendar, Lock } from "lucide-react";

export default function Scene2() {
  const staggerItem = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      className="absolute inset-0 w-full h-full flex flex-col bg-[#0f1420]"
      initial={{ opacity: 0, x: "100%" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="pt-14 pb-4 px-6 flex items-center justify-between border-b border-zinc-800">
        <ChevronLeft className="w-6 h-6 text-zinc-400" />
        <h1 className="font-space font-medium text-lg text-white">Order Summary</h1>
        <div className="w-6 h-6" />
      </div>

      <div className="flex-1 px-6 py-6 overflow-y-auto overflow-x-hidden flex flex-col pb-32">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 20 }}
          className="flex justify-center mb-8"
        >
          <div className="w-20 h-20 rounded-full bg-zinc-900 border-4 border-zinc-800 flex items-center justify-center relative shadow-[0_0_30px_rgba(212,160,23,0.15)]">
             <Receipt className="w-8 h-8 text-[#d4a017]" />
             <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-[#0f1420] flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-white" />
             </div>
          </div>
        </motion.div>

        <motion.h2 
           className="text-center font-space text-4xl font-bold mb-8 text-white"
           initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        >
          KES 2,250
        </motion.h2>

        <motion.div 
           className="space-y-4"
           variants={{ show: { transition: { staggerChildren: 0.15, delayChildren: 0.8 } } }}
           initial="hidden" animate="show"
        >
          <motion.div variants={staggerItem} className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/80 flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-green-900/30 flex items-center justify-center">
                 <Lock className="w-5 h-5 text-green-500" />
               </div>
               <div>
                 <p className="text-zinc-400 text-sm">Asset</p>
                 <p className="font-medium text-white">Kiambu Maize (50)</p>
               </div>
             </div>
          </motion.div>

          <motion.div variants={staggerItem} className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/80 flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-[#d4a017]/10 flex items-center justify-center">
                 <TrendingUp className="w-5 h-5 text-[#d4a017]" />
               </div>
               <div>
                 <p className="text-zinc-400 text-sm">Projected Return</p>
                 <p className="font-medium text-[#d4a017]">18% (KES 405)</p>
               </div>
             </div>
          </motion.div>

          <motion.div variants={staggerItem} className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/80 flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-blue-900/20 flex items-center justify-center">
                 <Calendar className="w-5 h-5 text-blue-400" />
               </div>
               <div>
                 <p className="text-zinc-400 text-sm">Lock-up Period</p>
                 <p className="font-medium text-white">6 Months</p>
               </div>
             </div>
          </motion.div>
        </motion.div>
      </div>

      <motion.div 
         className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#0f1420] via-[#0f1420] to-transparent pt-12"
         initial={{ y: 100, opacity: 0 }}
         animate={{ y: 0, opacity: 1 }}
         transition={{ delay: 2, type: "spring", stiffness: 200, damping: 20 }}
      >
        <div className="relative w-full py-4 bg-white rounded-2xl text-center font-bold text-lg text-black">
           Confirm & Pay
           <motion.div 
             className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-black/20 mix-blend-overlay"
             initial={{ scale: 0, opacity: 0 }}
             animate={{ scale: [0, 1.5], opacity: [0, 1, 0] }}
             transition={{ delay: 6.5, duration: 0.6 }}
           />
        </div>
      </motion.div>
    </motion.div>
  );
}