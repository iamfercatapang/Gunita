// Pieces both capture sessions share: the chosen layout, returning to the
// welcome screen, the done screen and the camera-lost screen.

import { LAYOUT_DEFS, type LayoutDef } from '../../constants';
import type { ComputedLayout } from '../../lib/capture';
import { resetCaptureUi, setCameraLost } from './store';

export function layoutDef(layout = window.appConfig.layout): LayoutDef {
  return LAYOUT_DEFS[layout] ?? (LAYOUT_DEFS['4x6-1'] as LayoutDef);
}

export function computeLayout(layout?: string): ComputedLayout {
  return window.PB.capture.computeLayout(layoutDef(layout));
}

/**
 * Camera constraints for photo-booth stills, matched to the layout's slot
 * shape (4:3 for portrait/square, 16:9 for wide) at the camera's largest
 * size, so less of the frame is cropped.
 */
export function photoConstraints(): MediaTrackConstraints {
  const slot = computeLayout().photoSlots[0];
  if (!slot) return {};
  return window.PB.capture.photoConstraintsForSlot(slot.w, slot.h);
}

/** Close the capture screens and show the welcome screen again. */
export function resetToWelcome(): void {
  resetCaptureUi();
  window.PB.ui.showWelcome();
  // Video Guestbook opens the camera and mic per session; close them so the
  // camera light goes off while the kiosk is idle.
  if (window.appConfig.captureMode === 'videoguestbook') window.PB.capture.camera.release();
}

/** Whether the done screen (Drive QR and/or thank-you) has anything to show. */
export function wantsDoneScreen(): boolean {
  const c = window.appConfig;
  return c.vgThankYouEnabled || (c.vgSaveDrive && window.PB.drive.isSignedIn());
}

/** The done screen: the session's Drive QR (when Drive is on), then thank you. */
export function showDoneScreen(): Promise<void> {
  const c = window.appConfig;
  return window.PB.ui.showDone({
    showQr: c.vgSaveDrive && window.PB.drive.isSignedIn(),
    thankYouSecs: c.vgThankYouDuration,
    backgroundUrl: c.vgThankYouImage?.objectUrl ?? null,
    getDriveLink: () => window.currentSessionFolderLink,
  });
}

// ─── Camera lost ─────────────────────────────────────────────────────────────

export function showCameraLost(): void {
  setCameraLost({ status: '', busy: false });
}

/** Reconnect: re-open the camera and mic, then back to the welcome screen. */
export async function reconnectCamera(): Promise<void> {
  setCameraLost({ status: 'Reconnecting…', busy: true });
  try {
    const c = window.appConfig;
    await window.PB.capture.camera.reacquire({
      cameraId: c.vgSelectedCameraId || '',
      micId: c.vgSelectedMicId || '',
    });
    setCameraLost(null);
    resetToWelcome();
  } catch (e) {
    const err = e as Error;
    setCameraLost({
      status: `Could not reconnect: ${err.message || err.name}. Check the cable and try again.`,
      busy: false,
    });
  }
}

/** "Exit to Settings": leave the kiosk without the PIN (the operator is fixing the camera). */
export function exitFromCameraLost(): void {
  setCameraLost(null);
  window.PB.kiosk?.exit();
}
