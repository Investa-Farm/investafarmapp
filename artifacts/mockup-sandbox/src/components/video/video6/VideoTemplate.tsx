import { AnimatePresence, motion } from "framer-motion";
import { useVideoPlayer } from "../../../lib/video/hooks";
import Scene1 from "./video_scenes/Scene1";
import Scene2 from "./video_scenes/Scene2";
import Scene3 from "./video_scenes/Scene3";
import Scene4 from "./video_scenes/Scene4";
import Scene5 from "./video_scenes/Scene5";

const SCENE_DURATIONS = {
  scene1: 8000,
  scene2: 8000,
  scene3: 9000,
  scene4: 10000,
  scene5: 10000,
};

export default function VideoTemplate() {
  const { currentScene, sceneName } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="w-full h-screen bg-[#0f1420] overflow-hidden flex items-center justify-center font-sans text-white relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* Background ambient effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-[#16a34a]/10 blur-[120px]"
          animate={{ x: currentScene === 4 ? '40vw' : '0vw', y: currentScene === 2 ? '20vh' : '0vh' }}
          transition={{ duration: 10, ease: "linear" }}
        />
        <motion.div 
          className="absolute top-[40%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-[#d4a017]/5 blur-[120px]"
          animate={{ x: currentScene === 1 ? '-20vw' : '0vw', y: currentScene === 3 ? '-20vh' : '0vh' }}
          transition={{ duration: 10, ease: "linear" }}
        />
      </div>

      {/* Captions */}
      <div className="absolute left-[10vw] top-1/2 -translate-y-1/2 w-[28vw] z-10 flex flex-col gap-6">
        <AnimatePresence mode="popLayout">
          {currentScene === 0 && (
            <motion.div key="c0" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50, filter: "blur(10px)" }} transition={{ duration: 0.8 }}>
              <h2 className="font-display text-4xl font-bold text-[#16a34a] mb-2 uppercase tracking-wider">Step 1</h2>
              <p className="font-display text-5xl font-bold leading-tight">Browse the Secondary Market</p>
              <p className="font-body text-xl text-gray-400 mt-4">Find discounted shares from other investors looking to exit early.</p>
            </motion.div>
          )}
          {currentScene === 1 && (
            <motion.div key="c1" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50, filter: "blur(10px)" }} transition={{ duration: 0.8 }}>
              <h2 className="font-display text-4xl font-bold text-[#16a34a] mb-2 uppercase tracking-wider">Step 2</h2>
              <p className="font-display text-5xl font-bold leading-tight">Review Listings</p>
              <p className="font-body text-xl text-gray-400 mt-4">Check seller ratings and see shares listed at a premium or discount.</p>
            </motion.div>
          )}
          {currentScene === 2 && (
            <motion.div key="c2" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50, filter: "blur(10px)" }} transition={{ duration: 0.8 }}>
              <h2 className="font-display text-4xl font-bold text-[#16a34a] mb-2 uppercase tracking-wider">Step 3</h2>
              <p className="font-display text-5xl font-bold leading-tight">Analyze the Order Book</p>
              <p className="font-body text-xl text-gray-400 mt-4">View market depth and see real-time bids and asks for farm shares.</p>
            </motion.div>
          )}
          {currentScene === 3 && (
            <motion.div key="c3" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50, filter: "blur(10px)" }} transition={{ duration: 0.8 }}>
              <h2 className="font-display text-4xl font-bold text-[#16a34a] mb-2 uppercase tracking-wider">Step 4</h2>
              <p className="font-display text-5xl font-bold leading-tight">Buy Instantly</p>
              <p className="font-body text-xl text-gray-400 mt-4">Confirm your purchase with a single tap for instant settlement.</p>
            </motion.div>
          )}
          {currentScene === 4 && (
            <motion.div key="c4" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50, filter: "blur(10px)" }} transition={{ duration: 0.8 }}>
              <h2 className="font-display text-4xl font-bold text-[#16a34a] mb-2 uppercase tracking-wider">Step 5</h2>
              <p className="font-display text-5xl font-bold leading-tight">Trade Executed</p>
              <p className="font-body text-xl text-gray-400 mt-4">Shares are instantly transferred to your portfolio. The seller is notified.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Phone Mockup Frame */}
      <div className="relative z-20 w-[375px] h-[812px] bg-[#05080f] rounded-[50px] shadow-[0_0_0_12px_#1a2030,0_0_0_14px_#2a3241,0_40px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden">
        
        {/* Dynamic header / status bar */}
        <div className="absolute top-0 inset-x-0 h-12 z-50 flex items-center justify-between px-6 bg-gradient-to-b from-[#05080f]/80 to-transparent pointer-events-none">
          <div className="text-white text-xs font-display font-medium">9:41</div>
          <div className="flex gap-1.5 items-center">
            <div className="w-4 h-3 flex items-end gap-[1px]">
              <div className="w-1 h-1 bg-white rounded-sm"></div>
              <div className="w-1 h-1.5 bg-white rounded-sm"></div>
              <div className="w-1 h-2 bg-white rounded-sm"></div>
              <div className="w-1 h-3 bg-white rounded-sm"></div>
            </div>
            <div className="w-3 h-3 rounded-full border border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
            <div className="w-5 h-2.5 rounded-sm border border-white relative">
              <div className="absolute inset-[1px] bg-white rounded-[1px] w-[70%]"></div>
            </div>
          </div>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full z-50 pointer-events-none"></div>

        <AnimatePresence mode="popLayout">
          {currentScene === 0 && <Scene1 key="s0" />}
          {currentScene === 1 && <Scene2 key="s1" />}
          {currentScene === 2 && <Scene3 key="s2" />}
          {currentScene === 3 && <Scene4 key="s3" />}
          {currentScene === 4 && <Scene5 key="s4" />}
        </AnimatePresence>
      </div>

    </div>
  );
}
