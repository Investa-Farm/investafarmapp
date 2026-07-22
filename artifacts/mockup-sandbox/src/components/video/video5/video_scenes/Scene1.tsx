import { motion } from "framer-motion";
import { Wallet, ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";

export default function Scene1() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col pt-16 px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="flex items-center justify-between mb-8"
      >
        <h1 className="text-2xl font-bold font-['Space_Grotesk']">Wallet</h1>
        <div className="w-10 h-10 rounded-full bg-[#16a34a]/20 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-[#16a34a]" />
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6, type: "spring", stiffness: 100 }}
        className="relative bg-gradient-to-br from-[#16a34a] to-[#052e16] p-6 rounded-3xl mb-8 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <p className="text-white/80 text-sm mb-2">Available Balance</p>
        <div className="flex items-end gap-2 mb-6">
          <span className="text-xl font-medium text-[#d4a017]">KES</span>
          <span className="text-4xl font-bold font-['Space_Grotesk'] tracking-tight">750.00</span>
        </div>

        <div className="flex gap-4">
          <button className="flex-1 bg-white/20 hover:bg-white/30 transition-colors py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium">
            <Plus className="w-4 h-4" /> Top Up
          </button>
          <button className="flex-1 bg-black/20 hover:bg-black/30 transition-colors py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium">
            <ArrowUpRight className="w-4 h-4" /> Withdraw
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="flex-1"
      >
        <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
        <div className="space-y-4">
          {[
            { name: "Kiambu Maize Farm", date: "Today, 10:42 AM", amount: "-KES 5,000", type: "out" },
            { name: "Wallet Top Up", date: "Yesterday, 3:15 PM", amount: "+KES 2,500", type: "in" },
            { name: "Meru Coffee Estate", date: "Oct 12, 09:30 AM", amount: "+KES 12,500", type: "in" },
          ].map((tx, i) => (
            <motion.div
              key={i}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
              className="flex items-center justify-between p-3 rounded-2xl bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'in' ? 'bg-[#16a34a]/20 text-[#16a34a]' : 'bg-red-500/20 text-red-500'}`}>
                  {tx.type === 'in' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-medium text-sm text-white/90">{tx.name}</p>
                  <p className="text-xs text-white/50">{tx.date}</p>
                </div>
              </div>
              <span className={`font-semibold text-sm ${tx.type === 'in' ? 'text-[#16a34a]' : 'text-white'}`}>
                {tx.amount}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Tap Indicator */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 2], opacity: [0, 0.5, 0] }}
        transition={{ delay: 4.2, duration: 0.6, times: [0, 0.5, 1] }}
        className="absolute w-12 h-12 rounded-full border-2 border-white/50 bg-white/20 top-[225px] left-12 pointer-events-none"
      />
    </motion.div>
  );
}
