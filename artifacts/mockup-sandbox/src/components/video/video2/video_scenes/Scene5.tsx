import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip, YAxis } from "recharts";
import { ChevronLeft, ArrowUpRight, Activity } from "lucide-react";
import TouchIndicator from "../components/TouchIndicator";

const data = [
  { day: '1', price: 42 },
  { day: '5', price: 42.5 },
  { day: '10', price: 42.2 },
  { day: '15', price: 43.1 },
  { day: '20', price: 43.8 },
  { day: '25', price: 44.5 },
  { day: '30', price: 45.0 },
];

export default function Scene5() {
  return (
    <motion.div 
      className="absolute inset-0 w-full h-full bg-[#0a0e17] flex flex-col font-sans"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "-100%" }}
      transition={{ type: "spring", bounce: 0, duration: 0.6 }}
    >
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center gap-4 border-b border-white/10 relative z-20 bg-[#0f1420]">
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
          <ChevronLeft size={20} className="text-white" />
        </div>
        <div>
          <h2 className="font-['Space_Grotesk'] font-bold text-lg text-white">Share Price History</h2>
          <p className="text-xs text-gray-400">Kiambu Maize Farm</p>
        </div>
      </div>

      <div className="flex-1 p-5 relative z-10 overflow-hidden">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <motion.div 
          className="relative z-10 mt-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-sm text-gray-400 font-medium mb-1">Current Price</p>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-bold font-['Space_Grotesk'] text-white tracking-tight">
                  <span className="text-2xl text-gray-500 font-medium">KES</span> 45<span className="text-xl text-gray-400">.00</span>
                </span>
              </div>
            </div>
            
            <motion.div 
              className="flex items-center gap-1 bg-[#16a34a]/20 text-[#16a34a] px-3 py-1.5 rounded-lg border border-[#16a34a]/30 mb-1"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: "spring", bounce: 0.5 }}
            >
              <ArrowUpRight size={16} />
              <span className="font-bold text-sm">+7.1%</span>
            </motion.div>
          </div>
          <p className="text-xs text-gray-500">Past 30 days performance</p>
        </motion.div>

        {/* Chart Area */}
        <motion.div 
          className="w-full h-64 mt-6 relative z-10"
          initial={{ opacity: 0, scaleY: 0.5, transformOrigin: "bottom" }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
        >
          {/* Animated drawing line behind recharts for initial load effect */}
          <motion.div 
            className="absolute inset-0 z-0 bg-[#0a0e17] origin-right"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ delay: 0.6, duration: 1.5, ease: "easeInOut" }}
          />
          
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="day" hide />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                itemStyle={{ color: '#16a34a', fontWeight: 'bold' }}
              />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke="#16a34a" 
                strokeWidth={4}
                fillOpacity={1} 
                fill="url(#colorPrice)" 
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Live indicator dot at the end of the line */}
          <motion.div 
            className="absolute right-0 top-[20%] w-3 h-3 bg-white rounded-full shadow-[0_0_15px_#16a34a] border-2 border-[#16a34a]"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2, duration: 0.3 }}
          >
            <motion.div 
              className="absolute inset-0 bg-white rounded-full"
              animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
          </motion.div>
        </motion.div>

        {/* Order Book Snippet */}
        <motion.div 
          className="mt-8 bg-[#0f1420] rounded-xl border border-white/5 overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <Activity size={14} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Live Order Book</span>
          </div>
          
          <div className="grid grid-cols-2 text-xs">
             <div className="p-3 border-r border-white/5">
                <div className="flex justify-between text-gray-500 mb-2">
                  <span>Size</span>
                  <span>Bid</span>
                </div>
                {[
                  { size: 120, price: 44.90, delay: 1.2 },
                  { size: 45, price: 44.85, delay: 1.3 },
                  { size: 300, price: 44.70, delay: 1.4 }
                ].map((row, i) => (
                  <motion.div 
                    key={i} 
                    className="flex justify-between font-mono mb-1.5"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: row.delay }}
                  >
                    <span className="text-gray-400">{row.size}</span>
                    <span className="text-[#16a34a]">{row.price.toFixed(2)}</span>
                  </motion.div>
                ))}
             </div>
             <div className="p-3">
                <div className="flex justify-between text-gray-500 mb-2">
                  <span>Ask</span>
                  <span>Size</span>
                </div>
                {[
                  { size: 85, price: 45.10, delay: 1.2 },
                  { size: 210, price: 45.20, delay: 1.3 },
                  { size: 50, price: 45.35, delay: 1.4 }
                ].map((row, i) => (
                  <motion.div 
                    key={i} 
                    className="flex justify-between font-mono mb-1.5"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: row.delay }}
                  >
                    <span className="text-red-400">{row.price.toFixed(2)}</span>
                    <span className="text-gray-400">{row.size}</span>
                  </motion.div>
                ))}
             </div>
          </div>
        </motion.div>

      </div>

      <TouchIndicator x={330} y={700} delay={5} /> 
    </motion.div>
  );
}