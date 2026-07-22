import { AnimatePresence, motion } from "framer-motion";
import { useVideoPlayer } from "../../../lib/video";
import Scene1 from "./video_scenes/Scene1";
import Scene2 from "./video_scenes/Scene2";
import Scene3 from "./video_scenes/Scene3";
import Scene4 from "./video_scenes/Scene4";
import Scene5 from "./video_scenes/Scene5";
import PhoneFrame from "./components/PhoneFrame";

const SCENE_DURATIONS = {
  scene1: 10000,
  scene2: 10000,
  scene3: 6000,
  scene4: 7000,
  scene5: 8000,
};

const captions = [
  "Step 1: Browse available agribusiness projects",
  "Step 2: Filter by crop type and region",
  "Step 3: Select a verified high-yield farm",
  "Step 4: Review farm details and funding progress",
  "Step 5: Track real-time share price performance"
];

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
    <div className="w-full h-screen bg-[#020408] flex items-center justify-center overflow-hidden font-sans relative">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
          .font-sans { font-family: 'Inter', sans-serif; }
        `}
      </style>
      {/* Background cinematic effects */}
      <div className="absolute inset-0 z-0 opacity-40">
         <div className="absolute top-0 left-1/4 w-[50vw] h-[50vh] bg-[#16a34a]/20 rounded-full blur-[150px] mix-blend-screen" />
         <div className="absolute bottom-0 right-1/4 w-[40vw] h-[40vh] bg-[#d4a017]/10 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      <div className="relative z-10 flex items-center gap-16">
        <PhoneFrame>
          <AnimatePresence mode="popLayout" initial={false}>
            {currentScene === 0 && <Scene1 key="scene1" />}
            {currentScene === 1 && <Scene2 key="scene2" />}
            {currentScene === 2 && <Scene3 key="scene3" />}
            {currentScene === 3 && <Scene4 key="scene4" />}
            {currentScene === 4 && <Scene5 key="scene5" />}
          </AnimatePresence>
        </PhoneFrame>

        {/* Captions Panel for desktop/widescreen context */}
        <div className="w-[400px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScene}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <h1 className="font-['Space_Grotesk'] font-bold text-4xl text-white leading-tight">
                {captions[currentScene].split(': ')[0]}
                <span className="block text-[#16a34a] mt-2">{captions[currentScene].split(': ')[1]}</span>
              </h1>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}