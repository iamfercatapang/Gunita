// No React here: main.ts calls this synchronously, before the guest-flow
// chunk has loaded, so the frame is captured while it's still on screen.

/**
 * Copy the current frame of the guest's video, mirrored like the viewfinder.
 * Call it synchronously, while the frame is still there. Null if the video
 * has no frame.
 */
export function freezeFrame(video: HTMLVideoElement | null): HTMLCanvasElement | null {
  const w = video?.videoWidth;
  const h = video?.videoHeight;
  if (!video || !w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    return canvas;
  } catch (e) {
    console.warn('[PB-Offer] backdrop draw failed:', (e as Error).message);
    return null;
  }
}
