import { motion } from "framer-motion";
import { Search, MapPin, Leaf, Filter, ChevronLeft } from "lucide-react";
import maizeImg from "@assets/generated_images/maize_farm.jpg";
import TouchIndicator from "../components/TouchIndicator";

export default function Scene3() {
  return (
    <motion.div 
      className="absolute inset-0 w-full h-full bg-[#0a0e17] flex flex-col font-sans"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="px-6 pt-14 pb-4 bg-[#0f1420] border-b border-white/10 z-20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold font-['Space_Grotesk'] text-[#16a34a]">Investa Farm</h2>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <div className="w-4 h-4 bg-[#d4a017] rounded-full" />
          </div>
        </div>
        
        <div className="flex gap-2 relative overflow-hidden">
          {/* Active Filter Tags */}
          <motion.div 
            className="flex gap-2"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
             <div className="px-3 py-1.5 bg-[#16a34a]/20 border border-[#16a34a]/40 rounded-lg flex items-center gap-1">
               <span className="text-xs font-semibold text-[#16a34a]">Maize</span>
               <XIcon />
             </div>
             <div className="px-3 py-1.5 bg-[#16a34a]/20 border border-[#16a34a]/40 rounded-lg flex items-center gap-1">
               <span className="text-xs font-semibold text-[#16a34a]">Kiambu</span>
               <XIcon />
             </div>
          </motion.div>
        </div>
      </div>

      {/* Filtered Result */}
      <motion.div 
        className="flex-1 px-5 pt-6 flex flex-col relative z-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        <p className="text-sm text-gray-400 mb-4 font-medium">1 farm found</p>

        {/* Hero Card */}
        <motion.div
          className="bg-[#0f1420] rounded-2xl overflow-hidden border border-[#16a34a]/30 shadow-[0_8px_30px_rgba(22,163,74,0.15)] relative"
          whileHover={{ scale: 1.02 }}
        >
          {/* Shine effect */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 z-20 pointer-events-none"
            initial={{ x: "-150%" }}
            animate={{ x: "150%" }}
            transition={{ duration: 1.5, delay: 1, ease: "easeInOut" }}
          />

          <div className="h-48 w-full relative overflow-hidden">
             <img src={maizeImg} alt="Kiambu Maize" className="absolute w-full h-full object-cover opacity-90" />
             <div className="absolute inset-0 bg-gradient-to-t from-[#0f1420] via-[#0f1420]/40 to-transparent" />
             <div className="absolute top-3 right-3 px-2 py-1 bg-[#16a34a] rounded-lg shadow-lg">
               <span className="text-xs font-bold text-white uppercase tracking-wider">High Yield</span>
             </div>
             
             {/* Progress Bar Overlay */}
             <div className="absolute bottom-4 left-4 right-4">
                <h3 className="font-['Space_Grotesk'] font-bold text-2xl leading-tight text-white mb-2">Kiambu Maize Farm</h3>
                
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#16a34a]">78% Funded</span>
                  <span className="text-gray-400">22% Remaining</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-[#16a34a] to-[#22c55e]"
                    initial={{ width: 0 }}
                    animate={{ width: "78%" }}
                    transition={{ duration: 1.5, delay: 1.5, ease: "easeOut" }}
                  />
                </div>
             </div>
          </div>
          
          <div className="p-4 grid grid-cols-2 gap-4 border-t border-white/5 bg-gradient-to-b from-transparent to-[#0a0e17]/50">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Share Price</p>
              <span className="text-2xl font-bold font-['Space_Grotesk'] text-white">KES 45</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Projected ROI</p>
              <span className="text-2xl font-bold text-[#d4a017]">22%</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <TouchIndicator x={187} y={400} delay={4} /> {/* Tap the card */}
    </motion.div>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}