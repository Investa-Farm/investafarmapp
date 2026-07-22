import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Search, Filter, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

export default function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 6000); // tap indication
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[#0f1420] text-white font-body"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="pt-14 px-6 pb-6 h-full flex flex-col">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="font-display text-2xl font-bold mb-1">Secondary Market</h1>
          <p className="text-sm text-gray-400">Trade shares with other investors.</p>
        </motion.div>

        <motion.div 
          className="flex gap-3 mt-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex-1 h-10 bg-white/5 rounded-full flex items-center px-4 border border-white/10 text-sm text-gray-400">
            <Search className="w-4 h-4 mr-2" /> Search farms...
          </div>
          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
            <Filter className="w-4 h-4 text-white" />
          </div>
        </motion.div>

        <div className="flex gap-4 mt-6 overflow-hidden">
          {["All", "Premium", "Discount", "High Yield"].map((tag, i) => (
            <motion.div
              key={tag}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${i === 0 ? 'bg-[#16a34a] text-white' : 'bg-white/5 text-gray-400'}`}
            >
              {tag}
            </motion.div>
          ))}
        </div>

        <div className="mt-8 flex-1 flex flex-col gap-4 relative">
          <ListingCard 
            title="Nakuru Wheat Farm"
            seller="J. Kamau"
            shares="25"
            price="52"
            change="+15.5%"
            isPremium={true}
            delay={0.8}
            isTapped={phase >= 3}
          />
          <ListingCard 
            title="Meru Coffee Estate"
            seller="S. Omondi"
            shares="100"
            price="42"
            change="-8.2%"
            isPremium={false}
            delay={1.0}
          />
          <ListingCard 
            title="Kiambu Maize Farm"
            seller="A. Njoroge"
            shares="50"
            price="48"
            change="+5.0%"
            isPremium={true}
            delay={1.2}
          />
          
          {phase >= 3 && (
            <motion.div
              className="absolute top-[80px] left-[50%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="w-16 h-16 rounded-full border-2 border-[#16a34a] bg-[#16a34a]/30" />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ListingCard({ title, seller, shares, price, change, isPremium, delay, isTapped = false }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: isTapped ? 0.95 : 1, 
        backgroundColor: isTapped ? 'rgba(22, 163, 74, 0.2)' : 'rgba(255, 255, 255, 0.05)',
        borderColor: isTapped ? 'rgba(22, 163, 74, 0.5)' : 'rgba(255, 255, 255, 0.1)'
      }}
      transition={{ duration: 0.4, delay: isTapped ? 0 : delay }}
      className="p-4 rounded-2xl border relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-display font-semibold text-lg">{title}</div>
          <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-white font-bold">{seller.charAt(0)}</span>
            Seller: {seller}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display font-bold text-lg text-white">KES {price}</div>
          <div className={`text-xs flex items-center justify-end font-medium ${isPremium ? 'text-green-400' : 'text-red-400'}`}>
            {isPremium ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {change}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4">
        <div className="bg-[#0f1420] px-3 py-1.5 rounded-lg text-sm border border-white/5">
          <span className="text-gray-400 mr-2">Qty:</span>
          <span className="font-bold">{shares} shares</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#16a34a] flex items-center justify-center text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]">
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
}
