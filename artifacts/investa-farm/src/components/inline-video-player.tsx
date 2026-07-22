/**
 * InlineVideoPlayer — renders demo videos directly as React components,
 * bypassing the /__mockup proxy so they work in both dev and production.
 *
 * Each video is lazy-loaded so only the one being watched is bundled into
 * the initial chunk.
 */
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

const Videos = {
  1: lazy(() => import("../../../mockup-sandbox/src/components/video/video1/VideoTemplate")),
  2: lazy(() => import("../../../mockup-sandbox/src/components/video/video2/VideoTemplate")),
  3: lazy(() => import("../../../mockup-sandbox/src/components/video/video3/VideoTemplate")),
  4: lazy(() => import("../../../mockup-sandbox/src/components/video/video4/VideoTemplate")),
  5: lazy(() => import("../../../mockup-sandbox/src/components/video/video5/VideoTemplate")),
  6: lazy(() => import("../../../mockup-sandbox/src/components/video/video6/VideoTemplate")),
} as const;

function VideoSpinner() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0f1420] gap-3">
      <Loader2 size={28} className="animate-spin text-[#16a34a]" />
      <p className="text-white/60 text-sm">Loading demo…</p>
    </div>
  );
}

interface InlineVideoPlayerProps {
  videoNum: 1 | 2 | 3 | 4 | 5 | 6;
}

export function InlineVideoPlayer({ videoNum }: InlineVideoPlayerProps) {
  const VideoTemplate = Videos[videoNum];
  return (
    <div className="w-full h-full overflow-hidden">
      <Suspense fallback={<VideoSpinner />}>
        <VideoTemplate />
      </Suspense>
    </div>
  );
}
