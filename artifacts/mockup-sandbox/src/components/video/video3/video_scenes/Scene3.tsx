import { motion } from "framer-motion";
import { ChevronLeft, Wallet, Smartphone, CreditCard, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export default function Scene3() {
  const [selected] = useState('wallet');

  return (
    <motion.div 
      className="absolute inset-0 w-full h-full flex flex-col bg-[#0f1420]"
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="pt-14 pb-4 px-6 flex items-center justify-between border-b border-zinc-800">
        <ChevronLeft className="w-6 h-6 text-zinc-400" />
        <h1 className="font-space font-medium text-lg text-white">Payment Method</h1>
        <div className="w-6 h-6" />
      </div>

      <div className="flex-1 px-6 py-6 flex flex-col">
        <motion.p 
           className="text-zinc-400 text-sm mb-6 uppercase tracking-wider font-medium"
           initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        >
           Select Method
        </motion.p>

        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, type: "spring" }}
            className={`p-5 rounded-2xl border-2 relative overflow-hidden transition-colors duration-300 ${selected === 'wallet' ? 'bg-green-900/20 border-green-500' : 'bg-zinc-900/50 border-zinc-800'}`}
          >
            {selected === 'wallet' && (
              <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 rounded-bl-[100px]" />
            )}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selected === 'wallet' ? 'bg-green-500' : 'bg-zinc-800'}`}>
                  <Wallet className={`w-6 h-6 ${selected === 'wallet' ? 'text-black' : 'text-zinc-400'}`} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Investa Wallet</h3>
                  <p className="text-green-400 text-sm">Available: KES 5,000</p>
                </div>
              </div>
              {selected === 'wallet' ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-zinc-700" />
              )}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, type: "spring" }}
            className={`p-5 rounded-2xl border-2 relative overflow-hidden transition-colors duration-300 bg-zinc-900/50 border-zinc-800`}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-zinc-800`}>
                  <Smartphone className={`w-6 h-6 text-green-500`} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">M-Pesa STK</h3>
                  <p className="text-zinc-400 text-sm">+254 7XX XXX XXX</p>
                </div>
              </div>
              <div className="w-6 h-6 rounded-full border-2 border-zinc-700" />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7, type: "spring" }}
            className={`p-5 rounded-2xl border-2 relative overflow-hidden transition-colors duration-300 bg-zinc-900/50 border-zinc-800`}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-zinc-800`}>
                  <CreditCard className={`w-6 h-6 text-zinc-400`} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Bank Transfer</h3>
                  <p className="text-zinc-400 text-sm">Standard Chartered</p>
                </div>
              </div>
              <div className="w-6 h-6 rounded-full border-2 border-zinc-700" />
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div 
         className="p-6"
         initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.5, type: "spring" }}
      >
        <div className="relative w-full py-4 bg-gradient-to-r from-green-600 to-green-500 rounded-2xl text-center font-bold text-lg text-white shadow-[0_10px_25px_-5px_rgba(22,163,74,0.4)]">
           Pay KES 2,250
           <motion.div 
             className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white mix-blend-overlay"
             initial={{ scale: 0, opacity: 0 }}
             animate={{ scale: [0, 1.5], opacity: [0, 0.4, 0] }}
             transition={{ delay: 8.5, duration: 0.6 }}
           />
        </div>
      </motion.div>
    </motion.div>
  );
}