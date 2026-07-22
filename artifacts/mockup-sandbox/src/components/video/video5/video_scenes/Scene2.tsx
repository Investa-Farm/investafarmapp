import { motion } from "framer-motion";
import { Wallet, ArrowDownLeft, ArrowUpRight, Plus, X, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

export default function Scene2() {
  const [typedAmount, setTypedAmount] = useState("");
  
  useEffect(() => {
    const amount = "3000";
    let i = 0;
    const interval = setInterval(() => {
      if (i < amount.length) {
        setTypedAmount(amount.substring(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col pt-16 px-5 bg-[#0a0f18]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: 50 }}
      transition={{ duration: 0.4 }}
    >
      {/* Background Wallet View (Blurred) */}
      <div className="absolute inset-0 opacity-30 blur-sm pointer-events-none">
        <div className="pt-16 px-5">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Wallet</h1>
          </div>
          <div className="bg-gradient-to-br from-[#16a34a] to-[#052e16] p-6 rounded-3xl mb-8 h-40" />
        </div>
      </div>

      {/* Modal Overlay */}
      <motion.div
        className="absolute inset-x-0 bottom-0 top-20 bg-[#121826] rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] p-6 border-t border-white/10 flex flex-col"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.2 }}
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
        
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-bold font-['Space_Grotesk']">Top Up Wallet</h2>
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4 text-white/50" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <label className="text-sm text-white/50 mb-2 block">Amount to deposit</label>
          <div className="flex items-center gap-3 border-b-2 border-[#16a34a] pb-2">
            <span className="text-2xl font-bold text-[#d4a017]">KES</span>
            <div className="text-4xl font-bold font-['Space_Grotesk'] flex items-center">
              {typedAmount ? (
                <span>
                  {Number(typedAmount).toLocaleString()}
                </span>
              ) : (
                <span className="text-white/20">0</span>
              )}
              <motion.div
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="w-0.5 h-8 bg-[#16a34a] ml-1"
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          <label className="text-sm text-white/50 mb-2 block">M-Pesa Number</label>
          <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#16a34a]/20 flex items-center justify-center text-[#16a34a]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold tracking-wide">+254 712 345 678</p>
              <p className="text-xs text-[#16a34a]">Primary Number</p>
            </div>
          </div>
        </motion.div>

        <div className="mt-auto pb-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.2, type: "spring" }}
            className="relative"
          >
            <button className="w-full bg-[#16a34a] text-white font-bold py-4 rounded-2xl text-lg shadow-[0_0_20px_rgba(22,163,74,0.3)]">
              Proceed with M-Pesa
            </button>
            {/* Tap Indicator on Button */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.5, 2], opacity: [0, 0.5, 0] }}
              transition={{ delay: 4.8, duration: 0.6, times: [0, 0.5, 1] }}
              className="absolute w-12 h-12 rounded-full border-2 border-white/80 bg-white/40 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
