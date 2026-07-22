import { motion } from "framer-motion";
import { ChevronLeft, Share2, Info, TrendingUp, Calendar, ShieldCheck, MapPin } from "lucide-react";
import maizeImg from "@assets/generated_images/maize_farm.jpg";
import TouchIndicator from "../components/TouchIndicator";

export default function Scene4() {
  return (
    <motion.div 
      className="absolute inset-0 w-full h-full bg-[#0a0e17] flex flex-col font-sans overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Hero Image mapping from Scene 3's card */}
      <motion.div 
        className="w-full relative z-0 origin-top"
        initial={{ height: 192 }} // matches h-48 from previous
        animate={{ height: 320 }} // expands
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.img 
          src={maizeImg} 
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0.9, scale: 1 }}
          animate={{ opacity: 0.7, scale: 1.05 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17]/60 to-black/40" />
      </motion.div>

      {/* Floating Header */}
      <motion.div 
        className="absolute top-14 left-0 right-0 px-5 flex justify-between items-center z-20"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20">
          <ChevronLeft size={20} className="text-white" />
        </div>
        <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20">
          <Share2 size={18} className="text-white" />
        </div>
      </motion.div>

      {/* Content pushes up */}
      <motion.div 
        className="absolute inset-0 z-10 flex flex-col"
        initial={{ y: 150 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex-1" /> {/* Spacer to push content down over the image */}
        
        <div className="px-6 pb-6 pt-10 bg-gradient-to-t from-[#0a0e17] via-[#0a0e17] to-transparent">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-[#16a34a]/20 text-[#16a34a] text-[10px] font-bold uppercase tracking-wider rounded border border-[#16a34a]/30">Active Funding</span>
              <span className="flex items-center gap-1 text-gray-300 text-xs"><MapPin size={12}/> Kiambu</span>
            </div>
            <h1 className="font-['Space_Grotesk'] font-bold text-3xl text-white leading-tight mb-4">Kiambu Maize Farm</h1>
          </motion.div>

          {/* Funding Status Box */}
          <motion.div 
            className="bg-[#0f1420] rounded-2xl p-5 border border-white/10 shadow-xl mb-6 relative overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, type: "spring", bounce: 0.4 }}
          >
            {/* Subtle bg glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#16a34a]/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

            <div className="flex justify-between items-end mb-4 relative z-10">
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1">Funded Amount</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold font-['Space_Grotesk'] text-white">KES 3.9M</span>
                  <span className="text-sm text-gray-500">/ 5M</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-[#16a34a]">78%</span>
              </div>
            </div>
            
            <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden mb-3 border border-white/5 relative z-10">
              <motion.div 
                className="h-full bg-gradient-to-r from-[#16a34a] to-[#22c55e] relative"
                initial={{ width: 0 }}
                animate={{ width: "78%" }}
                transition={{ duration: 1.5, delay: 1 }}
              >
                {/* Shine effect on progress bar */}
                <motion.div 
                  className="absolute inset-0 w-[20%] bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                  animate={{ x: ["-200%", "500%"] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                />
              </motion.div>
            </div>
            
            <div className="flex justify-between text-xs text-gray-400 font-medium relative z-10">
              <span className="flex items-center gap-1"><Info size={12} /> 246 Investors</span>
              <span>12 Days Left</span>
            </div>
          </motion.div>

          {/* Key Stats Grid */}
          <motion.div 
            className="grid grid-cols-3 gap-3 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <StatCard icon={<TrendingUp size={16} className="text-[#d4a017]" />} label="Proj. ROI" value="22%" />
            <StatCard icon={<Calendar size={16} className="text-blue-400" />} label="Duration" value="6 Mo" />
            <StatCard icon={<ShieldCheck size={16} className="text-[#16a34a]" />} label="Risk" value="Low" />
          </motion.div>

        </div>
      </motion.div>

      {/* Floating CTA (Starts offscreen, slides up) */}
      <motion.div 
        className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#050810] via-[#050810] to-transparent z-30"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ delay: 1.2, type: "spring", bounce: 0.2 }}
      >
        <div className="w-full py-4 bg-[#16a34a] text-white font-bold rounded-xl shadow-[0_4px_20px_rgba(22,163,74,0.4)] flex justify-between items-center px-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-white/80">Share Price</span>
            <span className="text-xl font-['Space_Grotesk']">KES 45</span>
          </div>
          <span className="text-lg">Invest Now</span>
        </div>
      </motion.div>

      <TouchIndicator x={300} y={450} delay={4.5} /> {/* Tap stats/chart area to trigger next scene */}
    </motion.div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-[#0f1420] border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
      <div className="mb-2 bg-white/5 p-2 rounded-lg">{icon}</div>
      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}