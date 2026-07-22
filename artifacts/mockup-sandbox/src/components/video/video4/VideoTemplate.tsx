import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVideoPlayer } from "../../../lib/video";
import Scene1 from "./video_scenes/Scene1";
import Scene2 from "./video_scenes/Scene2";
import Scene3 from "./video_scenes/Scene3";
import Scene4 from "./video_scenes/Scene4";
import Scene5 from "./video_scenes/Scene5";

const SCENE_DURATIONS = {
  Scene1: 6000,
  Scene2: 8000,
  Scene3: 8000,
  Scene4: 8000,
  Scene5: 10000,
};

export default function VideoTemplate() {
  const { currentScene, sceneName } = useVideoPlayer({ durations: SCENE_DURATIONS });
  
  return (
    <div className="w-full h-screen bg-[#0f1420] flex items-center justify-center overflow-hidden font-sans relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
      `}</style>

      {/* Background Ambient */}
      <div className="absolute inset-0 opacity-20">
        <motion.div 
          className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#16a34a] blur-[100px]"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-[#d4a017] blur-[120px]"
          animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Step Captions */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={sceneName}
          initial={{ opacity: 0, x: -30, filter: "blur(10px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: 30, filter: "blur(10px)" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-20 left-[10%] text-white font-display text-4xl font-bold max-w-lg leading-tight tracking-tight z-50 drop-shadow-2xl"
        >
          {sceneName === "Scene1" && "Step 1: Check your total portfolio value in real-time."}
          {sceneName === "Scene2" && "Step 2: Monitor live performance of your farm holdings."}
          {sceneName === "Scene3" && "Step 3: Get AI-driven insights on your portfolio's growth."}
          {sceneName === "Scene4" && "Step 4: Track steady dividend payouts over time."}
          {sceneName === "Scene5" && "Step 5: Stay updated with live progress from the fields."}
        </motion.div>
      </AnimatePresence>

      {/* Phone Mockup */}
      <div className="relative w-[375px] h-[812px] bg-[#0a0d14] rounded-[50px] shadow-[0_0_80px_rgba(0,0,0,0.5)] border-[8px] border-[#1f2937] overflow-hidden z-10 flex flex-col">
        {/* Phone Notch */}
        <div className="absolute top-0 inset-x-0 h-6 bg-[#1f2937] rounded-b-3xl w-1/2 mx-auto z-50" />
        
        {/* Status bar */}
        <div className="h-12 w-full flex justify-between items-center px-6 pt-2 z-40 text-white/80 text-xs font-body font-medium bg-transparent absolute top-0 left-0 right-0">
          <span>9:41</span>
          <div className="flex gap-1.5 items-center">
            <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor">
              <rect x="0" y="6" width="3" height="4" rx="1" />
              <rect x="4" y="4" width="3" height="6" rx="1" />
              <rect x="8" y="2" width="3" height="8" rx="1" />
              <rect x="12" y="0" width="3" height="10" rx="1" opacity="0.4" />
            </svg>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
              <path d="M7 0C4.5 0 2.2.8 0 2.3L7 10L14 2.3C11.8.8 9.5 0 7 0Z" />
            </svg>
            <svg width="22" height="10" viewBox="0 0 22 10" fill="currentColor">
              <rect width="18" height="10" rx="3" opacity="0.4" />
              <rect x="1" y="1" width="12" height="8" rx="2" />
              <path d="M19 3V7C20.1 7 21 6.1 21 5C21 3.9 20.1 3 19 3Z" />
            </svg>
          </div>
        </div>

        {/* Screen Content */}
        <div className="relative flex-1 w-full bg-[#0a0d14] overflow-hidden pt-12">
          <AnimatePresence mode="popLayout">
            {sceneName === "Scene1" && <Scene1 key="s1" />}
            {sceneName === "Scene2" && <Scene2 key="s2" />}
            {sceneName === "Scene3" && <Scene3 key="s3" />}
            {sceneName === "Scene4" && <Scene4 key="s4" />}
            {sceneName === "Scene5" && <Scene5 key="s5" />}
          </AnimatePresence>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-2 inset-x-0 h-6 w-full flex items-center justify-center bg-transparent z-50 pointer-events-none">
          <div className="w-1/3 h-1 bg-white/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}
