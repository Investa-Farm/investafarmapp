import VideoTemplate from "../video/video3/VideoTemplate";

export default function Preview() {
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        .font-inter { font-family: 'Inter', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
      `}} />
      <VideoTemplate />
    </>
  );
}