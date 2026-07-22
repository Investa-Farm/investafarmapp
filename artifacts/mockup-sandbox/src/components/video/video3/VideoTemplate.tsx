import { AnimatePresence, motion } from "framer-motion";
import { useVideoPlayer } from "../../../lib/video/hooks";
import Scene1 from "./video_scenes/Scene1";
import Scene2 from "./video_scenes/Scene2";
import Scene3 from "./video_scenes/Scene3";
import Scene4 from "./video_scenes/Scene4";
import Scene5 from "./video_scenes/Scene5";

const SCENE_DURATIONS = {
  scene1: 10000,
  scene2: 8000,
  scene3: 10000,
  scene4: 8000,
  scene5: 14000,
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="w-full h-screen bg-[#0f1420] flex items-center justify-center overflow-hidden font-inter relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      <motion.div 
        className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen opacity-20 filter blur-[100px]"
        style={{ background: 'radial-gradient(circle, #16a34a, transparent)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-screen opacity-10 filter blur-[100px]"
        style={{ background: 'radial-gradient(circle, #d4a017, transparent)' }}
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      
      <div className="absolute left-10 top-1/2 -translate-y-1/2 max-w-sm z-10 hidden md:block text-white">
         <motion.div animate={{ opacity: currentScene === 0 ? 1 : 0.4 }} className="mb-6 transition-opacity duration-500">
           <h2 className="text-3xl font-space font-bold text-green-500 mb-2">Step 1: Choose Stake</h2>
           <p className="text-zinc-400 text-lg">Select the number of shares to purchase in Kiambu Maize Farm.</p>
         </motion.div>
         <motion.div animate={{ opacity: currentScene === 1 ? 1 : 0.4 }} className="mb-6 transition-opacity duration-500">
           <h2 className="text-3xl font-space font-bold text-green-500 mb-2">Step 2: Review Order</h2>
           <p className="text-zinc-400 text-lg">Verify the projected dividends, cost, and lock-up terms.</p>
         </motion.div>
         <motion.div animate={{ opacity: currentScene === 2 ? 1 : 0.4 }} className="mb-6 transition-opacity duration-500">
           <h2 className="text-3xl font-space font-bold text-green-500 mb-2">Step 3: Secure Payment</h2>
           <p className="text-zinc-400 text-lg">Pay seamlessly using your Investa Wallet balance.</p>
         </motion.div>
         <motion.div animate={{ opacity: (currentScene === 3 || currentScene === 4) ? 1 : 0.4 }} className="mb-6 transition-opacity duration-500">
           <h2 className="text-3xl font-space font-bold text-green-500 mb-2">Step 4: Confirm</h2>
           <p className="text-zinc-400 text-lg">Your stake is secured. Track returns directly in your portfolio.</p>
         </motion.div>
      </div>

      <div className="relative w-[375px] h-[812px] bg-black rounded-[50px] shadow-2xl border-[8px] border-zinc-800 overflow-hidden flex flex-col z-20" style={{ transform: 'scale(0.85)', transformOrigin: 'center center' }}>
         <div className="absolute top-0 w-full h-[44px] flex justify-between items-center px-6 z-50 text-white font-medium text-xs">
           <span>9:41</span>
           <div className="flex gap-2 items-center">
             <div className="w-4 h-3 flex items-end gap-[1px]">
               <div className="w-[3px] h-[4px] bg-white rounded-sm"></div>
               <div className="w-[3px] h-[6px] bg-white rounded-sm"></div>
               <div className="w-[3px] h-[8px] bg-white rounded-sm"></div>
               <div className="w-[3px] h-[10px] bg-white rounded-sm"></div>
             </div>
             <div className="w-4 h-3 relative">
               <div className="absolute inset-0 border border-white rounded-[2px] opacity-50"></div>
               <div className="absolute top-[2px] left-[2px] right-[2px] bottom-[2px] bg-white rounded-[1px]"></div>
             </div>
           </div>
         </div>

         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150px] h-[30px] bg-black rounded-b-[20px] z-50 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full absolute bg-zinc-900 opacity-20"></div>
         </div>

         <div className="flex-1 w-full relative bg-[#0f1420] text-white">
           <AnimatePresence mode="sync">
             {currentScene === 0 && <Scene1 key="scene1" />}
             {currentScene === 1 && <Scene2 key="scene2" />}
             {currentScene === 2 && <Scene3 key="scene3" />}
             {currentScene === 3 && <Scene4 key="scene4" />}
             {currentScene === 4 && <Scene5 key="scene5" />}
           </AnimatePresence>
         </div>

         <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[5px] bg-white rounded-full opacity-50 z-50"></div>
      </div>
    </div>
  );
}