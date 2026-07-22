import { motion } from "framer-motion";

export default function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col pt-16 px-5 bg-black/60 backdrop-blur-sm justify-center items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 200, delay: 0.3 }}
        className="w-[90%] bg-[#f4f4f4] rounded-3xl overflow-hidden shadow-2xl relative"
      >
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
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8 + i * 0.1, type: "spring" }}
                className="w-4 h-4 rounded-full border-2 border-[#16a34a] bg-transparent"
              />
            ))}
          </div>

          <div className="flex border-t border-gray-300">
            <button className="flex-1 py-3 text-[#16a34a] font-bold border-r border-gray-300">Cancel</button>
            <button className="flex-1 py-3 text-[#16a34a] font-bold">OK</button>
          </div>
        </div>
        
        {/* Loading overlay to simulate wait before PIN pad appears */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1] }}
          transition={{ duration: 4.8, times: [0, 0.9, 1] }}
          className="absolute inset-0 bg-white/20 z-10"
        />
      </motion.div>
    </motion.div>
  );
}
