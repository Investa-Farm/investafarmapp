/**
 * useVideoPlayer — cycles through scenes with configurable per-scene durations.
 * Copied from mockup-sandbox so videos can be rendered inline without the proxy.
 */
import { useEffect, useRef, useState } from "react";

export type SceneDurations = Record<string, number>;

export function useVideoPlayer({ durations }: { durations: SceneDurations }) {
  const keys = Object.keys(durations);
  const [currentScene, setCurrentScene] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let sceneIndex = 0;

    function advance() {
      const key = keys[sceneIndex]!;
      const duration = durations[key]!;
      timerRef.current = setTimeout(() => {
        sceneIndex = (sceneIndex + 1) % keys.length;
        setCurrentScene(sceneIndex);
        advance();
      }, duration);
    }

    advance();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { currentScene, sceneName: keys[currentScene] ?? keys[0]! };
}
