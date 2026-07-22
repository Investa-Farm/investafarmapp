import { motion } from "framer-motion";

export default function TouchIndicator({ x, y, delay = 0 }: { x: number, y: number, delay?: number }) {
  return (
    <div className="absolute z-[200] pointer-events-none" style={{ left: x, top: y }}>
      <motion.div
        className="w-12 h-12 bg-white/40 rounded-full -ml-6 -mt-6 border border-white"
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 1.5, opacity: 0 }}
        transition={{ delay, duration: 0.6, ease: "easeOut" }}
      />
      <motion.div
        className="absolute top-0 left-0 w-6 h-6 bg-white/60 rounded-full -ml-3 -mt-3"
        initial={{ scale: 0, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{ delay: delay + 0.1, duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}