import { motion } from "framer-motion";

export function TouchIndicator({ x, y, delay, repeatDelay = 0 }: { x: string | number; y: string | number; delay: number, repeatDelay?: number }) {
  return (
    <motion.div
      className="absolute z-50 rounded-full border-2 border-white pointer-events-none"
      style={{ left: x, top: y, x: "-50%", y: "-50%" }}
      initial={{ width: 0, height: 0, opacity: 0.8 }}
      animate={{ width: 60, height: 60, opacity: 0 }}
      transition={{ 
        duration: 0.6, 
        delay, 
        ease: "easeOut",
        repeat: repeatDelay > 0 ? Infinity : 0,
        repeatDelay
      }}
    >
      <motion.div 
        className="w-full h-full rounded-full bg-white/30"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2, delay }}
      />
    </motion.div>
  );
}