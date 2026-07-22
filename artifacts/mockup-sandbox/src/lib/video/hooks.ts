import { useEffect, useRef, useState } from "react";

export type SceneDurations = Record<string, number>;

export function useVideoPlayer({ durations }: { durations: SceneDurations }) {
  const keys = Object.keys(durations);
  const [currentScene, setCurrentScene] = useState(0);
  const hasStoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Signal recording start on mount
    (window as unknown as Record<string, (() => void) | undefined>).startRecording?.();

    let sceneIndex = 0;

    function advance() {
      const key = keys[sceneIndex];
      const duration = durations[key];

      timerRef.current = setTimeout(() => {
        sceneIndex++;

        if (sceneIndex >= keys.length) {
          // First full pass done — stop recording once
          if (!hasStoppedRef.current) {
            hasStoppedRef.current = true;
            (window as unknown as Record<string, (() => void) | undefined>).stopRecording?.();
          }
          // Loop back to scene 0
          sceneIndex = 0;
          setCurrentScene(0);
          advance();
        } else {
          setCurrentScene(sceneIndex);
          advance();
        }
      }, duration);
    }

    advance();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { currentScene, sceneName: keys[currentScene] };
}
