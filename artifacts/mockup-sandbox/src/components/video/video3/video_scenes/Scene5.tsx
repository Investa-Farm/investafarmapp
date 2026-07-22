import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";

export default function Scene5() {
  return (
    <motion.div 
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#0f1420] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div 
         className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-green-500/30 rounded-full mix-blend-screen filter blur-[60px]"
         initial={{ scale: 0, opacity: 0 }}
         animate={{ scale: [0, 1.2, 1], opacity: [0, 0.8, 0.3] }}
         transition={{ duration: 1.5, ease: "easeOut" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 w-full">
        <motion.div 
           className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(22,163,74,0.6)] mb-8 relative"
           initial={{ scale: 0, rotate: -180 }}
           animate={{ scale: 1, rotate: 0 }}
           transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
        >
           <Check className="w-12 h-12 text-black" strokeWidth={3} />
           
           {[...Array(6)].map((_, i) => (
             <motion.div 
               key={i}
               className="absolute w-2 h-2 bg-green-400 rounded-full"
               initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
               animate={{ 
                 x: Math.cos(i * 60 * Math.PI / 180) * 80,
                 y: Math.sin(i * 60 * Math.PI / 180) * 80,
                 scale: 1.5,
                 opacity: 0
               }}
               transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
             />
           ))}
        </motion.div>

        <motion.h1 
           className="text-3xl font-space font-bold text-white mb-4 leading-tight"
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.8, type: "spring" }}
        >
           You're now a<br/>Farm Owner!
        </motion.h1>

        <motion.p 
           className="text-zinc-400 text-lg mb-10"
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 1.2 }}
        >
           Successfully secured 50 shares of <br/><span className="text-white font-medium">Kiambu Maize Farm</span>
        </motion.p>

        <motion.div 
           className="w-full bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl p-5 flex items-center justify-between"
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 1.8, type: "spring" }}
        >
           <div className="text-left">
              <p className="text-zinc-400 text-sm mb-1">Portfolio Updated</p>
              <p className="font-space font-bold text-xl text-green-500">+ KES 2,250</p>
           </div>
           <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-white" />
           </div>
        </motion.div>
      </div>
    </motion.div>
  );
}