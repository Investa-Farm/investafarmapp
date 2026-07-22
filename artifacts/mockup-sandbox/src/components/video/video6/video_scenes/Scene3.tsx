import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 1500);
    const t3 = setTimeout(() => setPhase(3), 2500);
    const t4 = setTimeout(() => setPhase(4), 6500); // tap to buy
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[#0f1420] text-white font-body"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="pt-14 px-6 pb-8 h-full flex flex-col relative z-10">
        <motion.div 
          className="flex items-center justify-between mb-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
            <span className="font-display font-medium text-lg">Order Book</span>
          </div>
          <span className="text-xs font-medium text-gray-400 bg-white/10 px-2 py-1 rounded">Live</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mb-6"
        >
          <div className="text-gray-400 text-sm mb-1">Nakuru Wheat Farm</div>
          <div className="font-display text-4xl font-bold text-white">KES 52.00</div>
          <div className="text-xs text-green-400 mt-1 flex items-center justify-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> Last trade: KES 51.50
          </div>
        </motion.div>

        {/* Depth Chart Mockup */}
        <motion.div 
          className="h-32 w-full flex items-end justify-center gap-1 mb-8 relative"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        >
          {/* Bids */}
          <div className="flex-1 flex items-end gap-[2px] justify-end opacity-80 h-full">
            {[20, 35, 45, 60, 80, 100, 70, 50, 30].map((h, i) => (
              <motion.div 
                key={`bid-${i}`} 
                className="w-full bg-[#16a34a] rounded-t-sm" 
                initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.7 + i * 0.05 }}
              />
            ))}
          </div>
          <div className="w-px h-full bg-white/20 mx-2" />
          {/* Asks */}
          <div className="flex-1 flex items-end gap-[2px] justify-start opacity-80 h-full">
            {[40, 60, 75, 90, 100, 85, 65, 45, 25].map((h, i) => (
              <motion.div 
                key={`ask-${i}`} 
                className="w-full bg-red-500 rounded-t-sm" 
                initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 1.0 + i * 0.05 }}
              />
            ))}
          </div>
          
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-[#0f1420] to-transparent pointer-events-none" />
        </motion.div>

        <div className="flex text-xs text-gray-400 mb-2 px-4 uppercase font-bold tracking-wider">
          <div className="flex-1">Bid (Buy)</div>
          <div className="flex-1 text-right">Ask (Sell)</div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className="flex">
            {/* Bids list */}
            <div className="flex-1 flex flex-col gap-1 pr-2 border-r border-white/5">
              {[
                { price: "51.50", qty: "100" },
                { price: "51.00", qty: "45" },
                { price: "50.50", qty: "200" },
                { price: "50.00", qty: "150" },
                { price: "49.50", qty: "50" },
              ].map((row, i) => (
                <motion.div 
                  key={`bid-row-${i}`}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.3 + i * 0.1 }}
                  className="flex justify-between py-1.5 px-2 bg-[#16a34a]/10 rounded text-sm relative overflow-hidden"
                >
                  <div className="absolute right-0 top-0 bottom-0 bg-[#16a34a]/20" style={{ width: `${(parseInt(row.qty)/200)*100}%` }} />
                  <span className="text-[#16a34a] font-bold z-10">{row.price}</span>
                  <span className="text-gray-300 z-10">{row.qty}</span>
                </motion.div>
              ))}
            </div>
            
            {/* Asks list */}
            <div className="flex-1 flex flex-col gap-1 pl-2">
              {[
                { price: "52.00", qty: "25", active: true },
                { price: "52.50", qty: "110" },
                { price: "53.00", qty: "60" },
                { price: "54.00", qty: "300" },
                { price: "55.00", qty: "150" },
              ].map((row, i) => (
                <motion.div 
                  key={`ask-row-${i}`}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.5 + i * 0.1 }}
                  className={`flex justify-between py-1.5 px-2 rounded text-sm relative overflow-hidden ${row.active ? 'bg-white/10 ring-1 ring-white/30' : 'bg-red-500/10'}`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 ${row.active ? 'bg-white/10' : 'bg-red-500/20'}`} style={{ width: `${(parseInt(row.qty)/300)*100}%` }} />
                  <span className="text-gray-300 z-10">{row.qty}</span>
                  <span className={`${row.active ? 'text-white font-bold' : 'text-red-400 font-bold'} z-10`}>{row.price}</span>
                  
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-auto pt-4 relative">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ 
              y: 0, 
              opacity: 1,
              scale: phase >= 4 ? 0.95 : 1
            }}
            transition={{ delay: phase >= 4 ? 0 : 2.0, duration: 0.3 }}
            className={`w-full py-4 font-display text-lg font-bold rounded-xl shadow-[0_4px_20px_rgba(22,163,74,0.4)] transition-colors flex items-center justify-center ${phase >= 4 ? 'bg-[#14532d] text-white' : 'bg-[#16a34a] text-white'}`}
          >
            Buy 25 Shares @ 52.00
          </motion.div>

          {phase >= 4 && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 mt-2"
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="w-16 h-16 rounded-full border-2 border-white bg-white/30" />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
