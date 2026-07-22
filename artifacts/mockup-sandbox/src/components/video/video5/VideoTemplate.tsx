import { AnimatePresence, motion } from "framer-motion";
import { useVideoPlayer } from "../../../lib/video";
import Scene1 from "./video_scenes/Scene1";
import Scene2 from "./video_scenes/Scene2";
import Scene3 from "./video_scenes/Scene3";
import Scene4 from "./video_scenes/Scene4";
import Scene5 from "./video_scenes/Scene5";

const SCENE_DURATIONS = {
  wallet: 3500,
  topup: 4000,
  mpesa: 4000,
  pin: 3500,
  success: 4000,
};

const bgPositions = [
  { x: "30vw", y: "20vh", scale: 2.2 },
  { x: "70vw", y: "60vh", scale: 1.4 },
  { x: "10vw", y: "40vh", scale: 1.8 },
  { x: "60vw", y: "15vh", scale: 1.1 },
  { x: "40vw", y: "70vh", scale: 2.0 },
];

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });
  const keys = Object.keys(SCENE_DURATIONS);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a1628]">
      {/* Persistent ambient layer */}
      <motion.div
        className="absolute rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{
          width: "50vw",
          height: "50vw",
          background: "radial-gradient(circle, #16a34a, transparent)",
        }}
        animate={bgPositions[currentScene]}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        className="absolute rounded-full blur-2xl opacity-10 pointer-events-none"
        style={{
          width: "30vw",
          height: "30vw",
          background: "radial-gradient(circle, #d4a017, transparent)",
          right: 0,
          bottom: 0,
        }}
        animate={{
          x: ["-5vw", "5vw", "-3vw", "8vw", "-5vw"][currentScene],
          y: ["-5vh", "10vh", "-8vh", "5vh", "-10vh"][currentScene],
        }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />

      {/* Persistent accent line */}
      <motion.div
        className="absolute h-[2px] bg-gradient-to-r from-transparent via-[#16a34a] to-transparent pointer-events-none"
        animate={{
          top: ["15%", "25%", "75%", "50%", "30%"][currentScene],
          left: ["10%", "5%", "20%", "0%", "15%"][currentScene],
          width: ["40%", "60%", "30%", "80%", "50%"][currentScene],
          opacity: [0.6, 0.8, 0.4, 0.9, 0.7][currentScene],
        }}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Scene content */}
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="wallet" />}
        {currentScene === 1 && <Scene2 key="topup" />}
        {currentScene === 2 && <Scene3 key="mpesa" />}
        {currentScene === 3 && <Scene4 key="pin" />}
        {currentScene === 4 && <Scene5 key="success" />}
      </AnimatePresence>
    </div>
  );
}
