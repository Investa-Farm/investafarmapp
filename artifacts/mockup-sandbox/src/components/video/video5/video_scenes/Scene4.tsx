import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function Scene4() {
  const [pins, setPins] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPins(1), 1000),
      setTimeout(() => setPins(2), 1500),
      setTimeout(() => setPins(3), 2000),
      setTimeout(() => setPins(4), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col pt-16 px-5 bg-black/60 backdrop-blur-sm justify-center items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="w-[90%] bg-[#f4f4f4] rounded-3xl overflow-hidden shadow-2xl relative mb-12">
        <div className="bg-[#16a34a] p-4 text-center">
          <h3 className="text-white font-bold text-lg font-['Space_Grotesk']">M-PESA</h3>
        </div>
        <div className="p-6 text-[#1a1a1a]">
          <p className="text-[15px] font-medium text-center leading-relaxed mb-6">
            Do you want to pay KSh 3,000 to<br/>
            <strong>Investa Farm</strong><br/>
            Account: TopUp<br/>
            Enter M-PESA PIN
          </p>

          <div className="flex gap-2 justify-center mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-colors duration-200 ${
                  i < pins ? "bg-[#16a34a] border-[#16a34a]" : "bg-transparent border-2 border-gray-400"
                }`}
              />
            ))}
          </div>

          <div className="flex border-t border-gray-300">
            <button className="flex-1 py-3 text-gray-400 font-bold border-r border-gray-300">Cancel</button>
            <button className="flex-1 py-3 text-[#16a34a] font-bold">OK</button>
          </div>
        </div>
      </div>

      {/* Simulated PIN Pad input area (off screen or invisible) */}
      
      {/* Tap Indicators mapping to the PIN entry timings */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 2], opacity: [0, 0.5, 0] }}
        transition={{ delay: 1, duration: 0.4 }}
        className="absolute w-10 h-10 rounded-full border-2 border-white/50 bg-white/20 bottom-40 left-12 pointer-events-none"
      />
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 2], opacity: [0, 0.5, 0] }}
        transition={{ delay: 1.5, duration: 0.4 }}
        className="absolute w-10 h-10 rounded-full border-2 border-white/50 bg-white/20 bottom-32 left-1/2 pointer-events-none"
      />
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 2], opacity: [0, 0.5, 0] }}
        transition={{ delay: 2.0, duration: 0.4 }}
        className="absolute w-10 h-10 rounded-full border-2 border-white/50 bg-white/20 bottom-24 right-16 pointer-events-none"
      />
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 2], opacity: [0, 0.5, 0] }}
        transition={{ delay: 2.5, duration: 0.4 }}
        className="absolute w-10 h-10 rounded-full border-2 border-white/50 bg-white/20 bottom-40 right-20 pointer-events-none"
      />

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 2], opacity: [0, 0.5, 0] }}
        transition={{ delay: 3.5, duration: 0.4 }}
        className="absolute w-12 h-12 rounded-full border-2 border-[#16a34a] bg-[#16a34a]/30 top-[350px] right-20 pointer-events-none z-50"
      />

    </motion.div>
  );
}
