export interface ExtractedFrame {
  timestampSec: number;
  frameRef: string;
}

export async function extractFrames(videoUrl?: string): Promise<ExtractedFrame[]> {
  void videoUrl;
  // MVP stub for hackathon demo. Replace with ffmpeg extraction in production.
  return [
    { timestampSec: 12, frameRef: "frame_012.jpg" },
    { timestampSec: 28, frameRef: "frame_028.jpg" },
  ];
}
