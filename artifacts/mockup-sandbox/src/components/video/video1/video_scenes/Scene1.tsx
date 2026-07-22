import { motion } from "framer-motion";
import { Leaf } from "lucide-react";

export default function Scene1() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#052e16] via-[#14532d] to-[#16a34a] text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 1.2, type: "spring", bounce: 0.4 }}
        className="mb-6 w-24 h-24 bg-white/10 rounded-[28px] border border-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl relative overflow-hidden"
      >
        <motion.div 
           className="absolute inset-0 bg-gradient-to-tr from-[#d4a017]/20 to-transparent" 
           animate={{ opacity: [0.3, 0.6, 0.3] }}
           transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <Leaf size={48} className="text-[#d4a017] relative z-10" />
      </motion.div>
      
      <div className="overflow-hidden mb-2">
        <motion.h1
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="font-space-grotesk text-4xl font-bold tracking-tight"
        >
          Investa<span className="text-[#d4a017]">Farm</span>
        </motion.h1>
      </div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.4, duration: 1 }}
        className="h-[1px] w-12 bg-[#d4a017] mb-4"
      />

      <motion.p
        initial={{ opacity: 0, filter: "blur(5px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ delay: 1.8, duration: 1 }}
        className="font-inter text-white/90 font-medium tracking-widest uppercase text-xs"
      >
        Farm-to-Wallet Returns
      </motion.p>
    </motion.div>
  );
}