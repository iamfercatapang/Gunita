// Pure geometry + canvas-drawing primitives for photo composition.
//
// The kiosk renders multi-photo strips at print resolution (e.g. 1200×1800 px
// for a 4×6 postcard). `computeLayout` figures out where each photo slot lives
// inside the canvas (centered grid, with a footer zone reserved for the
// polaroid template); `drawPhoto` paints one slot using ImageCapture for full
// sensor resolution where supported, or the current video frame otherwise.
//
// Both functions are pure — no shared state, no DOM lookups, no
// implicit dependency on window.appConfig. The caller passes whichever
// LayoutDef they want to render; the host code wires that to appConfig.layout.

import type { LayoutDef } from '../../constants';

import type { ComputedLayout, PhotoSlot } from './types';

const PADDING_RATIO = 0.05;
const GAP_RATIO = 0.025;
const FOOTER_RATIO = 0.15;

/**
 * Compute the photo-slot grid for a given layout definition. Slots are
 * row-major (top-to-bottom, left-to-right). Each slot is square unless the
 * layout explicitly opts out (`square: false`).
 */
export function computeLayout(def: LayoutDef): ComputedLayout {
  const pW = def.pW;
  const pH = def.pH;
  const pad = Math.round(pW * PADDING_RATIO);
  const gap = Math.round(pW * GAP_RATIO);
  const footerH = Math.round(pH * FOOTER_RATIO);

  const photoZoneW = pW - 2 * pad;
  const photoZoneH = pH - 2 * pad - footerH;

  const maxPhotoW = Math.floor((photoZoneW - gap * (def.cols - 1)) / def.cols);
  const maxPhotoH = Math.floor((photoZoneH - gap * (def.rows - 1)) / def.rows);
  const slotW = def.square === false ? maxPhotoW : Math.min(maxPhotoW, maxPhotoH);
  const slotH = def.square === false ? maxPhotoH : slotW;

  const gridW = slotW * def.cols + gap * (def.cols - 1);
  const gridH = slotH * def.rows + gap * (def.rows - 1);
  const startX = Math.round((pW - gridW) / 2);
  const startY = Math.round(pad + (photoZoneH - gridH) / 2);

  const photoSlots: PhotoSlot[] = [];
  for (let r = 0; r < def.rows; r++) {
    for (let c = 0; c < def.cols; c++) {
      photoSlots.push({
        x: startX + c * (slotW + gap),
        y: startY + r * (slotH + gap),
        w: slotW,
        h: slotH,
      });
    }
  }

  return { cWidth: pW, cHeight: pH, photoSlots };
}

/**
 * Paint one photo into a slot on the composition canvas. Prefers
 * `ImageCapture.takePhoto()` for full sensor resolution; falls back to
 * grabbing the current frame from the supplied `<video>` element if the
 * browser doesn't support ImageCapture (Safari, Firefox).
 *
 * The result is mirrored horizontally to match what the guest sees in the
 * viewfinder during a selfie capture.
 */
export async function drawPhoto(
  ctx: CanvasRenderingContext2D,
  stream: MediaStream | null,
  videoFallback: HTMLVideoElement | HTMLImageElement,
  x: number,
  y: number,
  slotW: number,
  slotH: number,
): Promise<void> {
  let source: ImageBitmap | HTMLVideoElement | HTMLImageElement = videoFallback;
  let releaseBitmap: ImageBitmap | null = null;

  if (stream) {
    const ImageCaptureCtor = (
      window as unknown as {
        ImageCapture?: new (track: MediaStreamTrack) => { takePhoto(): Promise<Blob> };
      }
    ).ImageCapture;
    if (ImageCaptureCtor) {
      try {
        const track = stream.getVideoTracks()[0];
        if (track) {
          const ic = new ImageCaptureCtor(track);
          const blob = await ic.takePhoto();
          const bitmap = await createImageBitmap(blob);
          source = bitmap;
          releaseBitmap = bitmap;
        }
      } catch (e) {
        console.warn('[Capture] ImageCapture failed, using video frame:', (e as Error).message);
      }
    }
  }

  const fW = sourceWidth(source);
  const fH = sourceHeight(source);
  if (fW === 0 || fH === 0) {
    if (releaseBitmap) releaseBitmap.close();
    return;
  }

  const scale = Math.max(slotW / fW, slotH / fH);
  const srcW = Math.round(slotW / scale);
  const srcH = Math.round(slotH / scale);
  const srcX = Math.max(0, Math.round((fW - srcW) / 2));
  const srcY = Math.max(0, Math.round((fH - srcH) / 2));

  ctx.save();
  ctx.translate(x + slotW, y);
  ctx.scale(-1, 1);
  ctx.drawImage(source as CanvasImageSource, srcX, srcY, srcW, srcH, 0, 0, slotW, slotH);
  ctx.restore();

  if (releaseBitmap) releaseBitmap.close();
}

function sourceWidth(src: ImageBitmap | HTMLVideoElement | HTMLImageElement): number {
  if ('videoWidth' in src && src.videoWidth) return src.videoWidth;
  if ('naturalWidth' in src && src.naturalWidth) return src.naturalWidth;
  return src.width;
}

function sourceHeight(src: ImageBitmap | HTMLVideoElement | HTMLImageElement): number {
  if ('videoHeight' in src && src.videoHeight) return src.videoHeight;
  if ('naturalHeight' in src && src.naturalHeight) return src.naturalHeight;
  return src.height;
}
