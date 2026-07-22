import { motion } from "framer-motion";
import { X } from "lucide-react";
import TouchIndicator from "../components/TouchIndicator";

export default function Scene2() {
  const cropFilters = ["All", "Maize", "Wheat", "Coffee", "Tea"];
  const regionFilters = ["All", "Nairobi", "Kiambu", "Nakuru", "Meru"];

  return (
    <motion.div 
      className="absolute inset-0 w-full h-full bg-[#0a0e17] flex flex-col font-sans"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background (blurred scene 1) */}
      <div className="absolute inset-0 opacity-40 blur-sm flex flex-col pointer-events-none">
        <div className="px-6 pt-14 pb-4 bg-[#0f1420] border-b border-white/10 z-20 h-32" />
        <div className="flex-1 p-5 flex flex-col gap-5">
           <div className="h-40 bg-[#0f1420] rounded-2xl" />
           <div className="h-40 bg-[#0f1420] rounded-2xl" />
        </div>
      </div>

      <motion.div 
        className="absolute inset-0 bg-black/60 z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Filter Bottom Sheet */}
      <motion.div 
        className="absolute bottom-0 left-0 right-0 bg-[#0f1420] rounded-t-[30px] border-t border-white/10 z-30 flex flex-col pb-10"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.2 }}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-['Space_Grotesk'] font-bold text-xl text-white">Filters</h3>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <X size={16} className="text-white" />
            </div>
          </div>

          {/* Crop Type */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-400 mb-3">Crop Type</h4>
            <div className="flex flex-wrap gap-2">
              {cropFilters.map((crop, i) => {
                const isMaize = crop === "Maize";
                return (
                  <motion.div
                    key={crop}
                    className={`px-4 py-2 rounded-full text-sm font-medium border relative overflow-hidden ${
                      isMaize ? "border-[#16a34a] text-[#16a34a]" : "border-white/10 text-gray-300"
                    }`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                  >
                    {isMaize && (
                      <motion.div 
                        className="absolute inset-0 bg-[#16a34a]/10"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 2.5, duration: 0.4 }}
                      />
                    )}
                    <span className="relative z-10">{crop}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Region */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-400 mb-3">Region</h4>
            <div className="flex flex-wrap gap-2">
              {regionFilters.map((region, i) => {
                const isKiambu = region === "Kiambu";
                return (
                  <motion.div
                    key={region}
                    className={`px-4 py-2 rounded-full text-sm font-medium border relative overflow-hidden ${
                      isKiambu ? "border-[#16a34a] text-[#16a34a]" : "border-white/10 text-gray-300"
                    }`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                  >
                    {isKiambu && (
                      <motion.div 
                        className="absolute inset-0 bg-[#16a34a]/10"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 4.5, duration: 0.4 }}
                      />
                    )}
                    <span className="relative z-10">{region}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ROI Range */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-gray-400 mb-3">Projected ROI</h4>
            <div className="w-full h-2 bg-white/10 rounded-full relative">
              <motion.div 
                className="absolute left-0 top-0 h-full bg-[#16a34a] rounded-full"
                initial={{ width: "100%" }}
                animate={{ width: "60%" }}
                transition={{ delay: 6, duration: 0.8, type: "spring" }}
              />
              <motion.div 
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg border-2 border-[#16a34a]"
                initial={{ left: "100%", x: "-50%" }}
                animate={{ left: "60%", x: "-50%" }}
                transition={{ delay: 6, duration: 0.8, type: "spring" }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500 font-bold">
              <span>10%</span>
              <motion.span 
                animate={{ color: ["#6b7280", "#16a34a"] }} 
                transition={{ delay: 6.5 }}
              >
                22%+
              </motion.span>
            </div>
          </div>

          {/* Apply Button */}
          <motion.div 
            className="w-full py-4 bg-[#16a34a] text-white font-bold rounded-xl shadow-[0_4px_20px_rgba(22,163,74,0.4)] text-center relative overflow-hidden"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            <motion.div 
              className="absolute inset-0 bg-white/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ delay: 8.5, duration: 0.4 }}
            />
            Apply Filters (1 Result)
          </motion.div>
        </div>
      </motion.div>

      {/* Taps */}
      <TouchIndicator x={100} y={500} delay={2.5} /> {/* Tap Maize */}
      <TouchIndicator x={190} y={600} delay={4.5} /> {/* Tap Kiambu */}
      <TouchIndicator x={187} y={740} delay={8.5} /> {/* Tap Apply */}
    </motion.div>
  );
}