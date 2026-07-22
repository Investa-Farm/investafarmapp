import { AnimatePresence, motion } from "framer-motion";
import { useVideoPlayer } from "../../../lib/video/hooks";
import Scene1 from "./video_scenes/Scene1";
import Scene2 from "./video_scenes/Scene2";
import Scene3 from "./video_scenes/Scene3";
import Scene4 from "./video_scenes/Scene4";
import Scene5 from "./video_scenes/Scene5";

const SCENE_DURATIONS = {
  scene1: 5000,
  scene2: 9000,
  scene3: 8500,
  scene4: 8500,
  scene5: 8000,
};

export default function VideoTemplate() {
  const { currentScene, sceneName } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="w-full h-screen bg-[#0f1420] flex items-center justify-center overflow-hidden text-white relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
        .font-space-grotesk { font-family: 'Space Grotesk', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
      `}</style>
      
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-40">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(\${import.meta.env.BASE_URL}attached_assets/generated_images/farm_bg.jpg)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1420] via-[#0f1420]/80 to-[#052e16]/50" />
      </div>
      
      {/* Step Captions (outside phone) */}
      <AnimatePresence mode="popLayout">
        <StepCaption sceneName={sceneName} key={sceneName} />
      </AnimatePresence>

      {/* Phone Mockup Frame */}
      <div className="relative z-10 w-[375px] h-[812px] bg-black rounded-[50px] border-[12px] border-[#0a0a0a] shadow-[0_0_80px_rgba(22,163,74,0.15)] overflow-hidden flex flex-col transform-gpu">
        {/* Status Bar */}
        <div className="h-7 w-full absolute top-0 z-50 flex justify-between px-6 pt-2 text-[10px] font-medium text-white/80 font-inter">
          <span>9:41</span>
          <div className="flex gap-1.5 items-center">
            <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
               <path d="M1 9L13 9V1H1V9Z" stroke="currentColor" strokeWidth="1" />
               <path d="M1 9L13 1" stroke="currentColor" strokeWidth="1" />
            </svg>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
               <path d="M1.5 8.5C3.5 8.5 5.5 8.5 7.5 8.5C9.5 8.5 11.5 8.5 13.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
               <path d="M4 6C5.5 6 7 6 8.5 6C10 6 11.5 6 13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Dynamic Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[30px] bg-[#0a0a0a] rounded-b-3xl z-50 shadow-sm" />

        {/* Scene Content */}
        <div className="flex-1 relative bg-[#0f1420] overflow-hidden font-inter">
          <AnimatePresence mode="popLayout">
             {sceneName === "scene1" && <Scene1 key="scene1" />}
             {sceneName === "scene2" && <Scene2 key="scene2" />}
             {sceneName === "scene3" && <Scene3 key="scene3" />}
             {sceneName === "scene4" && <Scene4 key="scene4" />}
             {sceneName === "scene5" && <Scene5 key="scene5" />}
          </AnimatePresence>
        </div>
        
        {/* Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-[4px] bg-white/40 rounded-full z-50" />
      </div>
    </div>
  );
}

function StepCaption({ sceneName }: { sceneName: string }) {
  const captions = {
    scene1: "Farm-to-Wallet Returns",
    scene2: "Step 1: Fast & secure registration",
    scene3: "Step 2: Instant M-Pesa verification",
    scene4: "Step 3: Quick KYC compliance",
    scene5: "Ready to grow your wealth",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -30, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="absolute left-[8vw] md:left-[15vw] top-1/2 -translate-y-1/2 max-w-sm z-20 pointer-events-none"
    >
      <div className="text-[#d4a017] text-sm font-bold tracking-widest uppercase mb-4 font-inter">Investa Farm</div>
      <h2 className="text-4xl md:text-5xl font-bold text-white font-space-grotesk leading-[1.1] drop-shadow-lg">
        {captions[sceneName as keyof typeof captions]}
      </h2>
    </motion.div>
  );
}