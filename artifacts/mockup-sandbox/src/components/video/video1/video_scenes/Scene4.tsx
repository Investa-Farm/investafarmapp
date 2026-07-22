import { motion } from "framer-motion";
import { Camera, FileText, CheckCircle2 } from "lucide-react";
import { TouchIndicator } from "../TouchIndicator";

export default function Scene4() {
  return (
    <motion.div 
      className="absolute inset-0 bg-[#0f1420] text-white p-6 pt-24"
      initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: '-100%', filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2 
        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
        className="font-space-grotesk text-3xl font-bold mb-2"
      >
        Identity Verification
      </motion.h2>
      <motion.p 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        className="text-white/50 text-sm mb-10 font-inter"
      >
        Upload your Kenyan National ID
      </motion.p>

      {/* ID Card Box */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, type: "spring", bounce: 0.3 }}
        className="relative h-56 w-full rounded-2xl border-2 border-dashed border-[#16a34a]/40 bg-[#16a34a]/5 flex flex-col items-center justify-center gap-4 overflow-hidden backdrop-blur-sm"
      >
        <motion.div
           animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
           transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
           className="p-5 rounded-full bg-[#16a34a]/10"
        >
          <Camera size={32} className="text-[#16a34a]" />
        </motion.div>
        <span className="font-medium text-[15px] text-white/80 font-inter">Tap to scan front of ID</span>
        <TouchIndicator x="50%" y="50%" delay={2.5} />
        
        {/* Scanned ID state */}
        <motion.div 
          className="absolute inset-0 bg-[#1c2433] flex flex-col items-center justify-center"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ delay: 3.5, duration: 0.8, type: "spring", bounce: 0.2 }}
        >
           <motion.div 
             className="w-56 h-36 bg-gradient-to-br from-white/10 to-white/5 rounded-xl relative overflow-hidden flex items-center justify-center p-3 border border-white/10 shadow-xl"
             initial={{ rotateX: 45, scale: 0.8 }}
             animate={{ rotateX: 0, scale: 1 }}
             transition={{ delay: 4, duration: 0.8, type: "spring" }}
           >
             {/* Fake ID Content */}
             <div className="absolute top-3 left-4 w-12 h-16 bg-white/20 rounded object-cover" />
             <div className="absolute top-3 right-4 w-24 h-3 bg-white/20 rounded" />
             <div className="absolute top-8 right-4 w-16 h-3 bg-white/20 rounded" />
             <div className="absolute top-12 right-4 w-20 h-3 bg-white/20 rounded" />
             <div className="absolute bottom-5 left-4 w-32 h-3 bg-[#d4a017]/50 rounded" />
             
             {/* Scanner line */}
             <motion.div 
                className="absolute top-0 left-0 right-0 h-1 bg-[#16a34a] shadow-[0_0_15px_#16a34a]"
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: [0, 144, 0], opacity: [0, 1, 1, 0] }}
                transition={{ delay: 4.5, duration: 1.5, ease: "easeInOut" }}
             />
           </motion.div>
           
           <motion.div 
             initial={{ opacity: 0, scale: 0, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 5.8, type: "spring", bounce: 0.6 }}
             className="absolute bg-white flex items-center justify-center w-10 h-10 rounded-full bottom-4 right-4 shadow-lg"
           >
             <CheckCircle2 size={24} className="text-[#16a34a]" />
           </motion.div>
        </motion.div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 6.8, type: "spring", bounce: 0.4 }}
        className="absolute bottom-10 left-6 right-6"
      >
        <div className="relative h-14 bg-gradient-to-r from-[#14532d] to-[#16a34a] rounded-2xl flex items-center justify-center font-semibold text-lg overflow-hidden shadow-[0_4px_20px_rgba(22,163,74,0.3)]">
          <span className="font-inter tracking-wide">Submit KYC</span>
          <TouchIndicator x="50%" y="50%" delay={7.5} />
        </div>
      </motion.div>
    </motion.div>
  );
}