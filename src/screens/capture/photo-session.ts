// The photo booth session: splash, a countdown and shutter for each photo in
// the layout, then save the strip (device, Drive, galleries, live viewer),
// hold it on screen, and return to the welcome screen.

import { computeLayout, layoutDef, resetToWelcome, showDoneScreen } from './kiosk';
import { feed, nextKey, setBooth, setPhoto, sleep, visitGuard } from './store';

const SPLASH_FADE_OUT_MS = 400; // matches the CSS splash-fade-out animation

export interface PhotoSessionOptions {
  /** Continue the guest's video session (same Drive folder), after the photo offer. */
  continueSession?: boolean;
}

/** Count down from `seconds`, beeping each number, with a shutter beep at the end. */
async function countdown(seconds: number): Promise<void> {
  const beep = window.PB.audio.beep.bind(window.PB.audio);
  let key = 0;
  for (let n = seconds; n > 0; n--) {
    key = nextKey();
    setPhoto({ countdown: { n, key, active: true } });
    beep(n === 1 ? 880 : 660, 0.12);
    await sleep(1000);
  }
  beep(1100, 0.08);
  // Fade the last number out before the next countdown can start.
  setPhoto({ countdown: { n: 1, key, active: false } });
  await sleep(250);
  setPhoto({ countdown: null });
}

export async function runPhotoSession(opts: PhotoSessionOptions = {}): Promise<void> {
  const c = window.appConfig;
  const left = visitGuard();
  try {
    if (!opts.continueSession) window.startNewSession();
    const video = feed('photo');
    if (!video) throw new Error('The photo booth camera view is not on the page.');
    // Show the camera that's open (Photo Booth mode, or re-opened after a video).
    if (window.currentStream && video.srcObject !== window.currentStream) {
      video.srcObject = window.currentStream;
      await video.play().catch(() => {});
    }
    setBooth('photo');

    if (c.pbSplashEnabled) {
      const def = layoutDef();
      setPhoto({ splash: { count: def.cols * def.rows, leaving: false } });
      await sleep(c.pbSplashDuration * 1000);
      setPhoto({ splash: { count: def.cols * def.rows, leaving: true } });
      await sleep(SPLASH_FADE_OUT_MS);
      setPhoto({ splash: null });
    }

    const { cWidth, cHeight, photoSlots } = computeLayout();

    const strip = document.createElement('canvas');
    strip.width = cWidth;
    strip.height = cHeight;
    const ctx = strip.getContext('2d');
    if (!ctx) throw new Error('Could not draw the photo strip.');

    // The host's template image, or white.
    if (c.templateBg) {
      ctx.drawImage(c.templateBg, 0, 0, cWidth, cHeight);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cWidth, cHeight);
    }

    for (const [i, slot] of photoSlots.entries()) {
      // Left the kiosk mid-session: no strip to save.
      if (left()) return;
      // Multi-photo layouts show "Photo N of M" so guests know where they are.
      if (photoSlots.length > 1) setPhoto({ shot: { n: i + 1, of: photoSlots.length } });
      await countdown(i === 0 ? c.countdownFirst : c.countdownOthers);
      setPhoto({ flashKey: nextKey() });
      await sleep(150); // let the flash peak before the capture
      await window.PB.capture.drawPhoto(
        ctx,
        window.currentStream,
        video,
        slot.x,
        slot.y,
        slot.w,
        slot.h,
      );
    }
    if (left()) return;
    setPhoto({ shot: null, strip });

    await saveStrip(strip, opts, left);
  } catch (err) {
    console.error('[Capture] Fatal error in capture sequence:', err);
    if (!left()) resetToWelcome();
  }
}

/** Save the strip everywhere it should go, hold it on screen, then finish. */
async function saveStrip(
  strip: HTMLCanvasElement,
  opts: PhotoSessionOptions,
  left: () => boolean,
): Promise<void> {
  const c = window.appConfig;
  setPhoto({ saving: true });
  const filename = window.PB.capture.makeFilename(c.eventName, 'png');

  if (c.saveLocal) {
    try {
      const blob = await new Promise<Blob | null>((r) => strip.toBlob(r, 'image/png', 1.0));
      if (!blob) throw new Error('The photo could not be encoded.');
      await window.PB.capture.saveBlobLocally(blob, filename, {
        directoryHandle: window.directoryHandle,
        sessionId: window.currentSessionId,
      });
    } catch (err) {
      console.error('Save error:', err);
    }
  }

  // Galleries and the live viewer.
  const dataUrl = strip.toDataURL('image/png', 0.8);
  const captureId = window.PB.captures.add('photo', dataUrl);
  window.PB.liveViewer.host.broadcastPhoto(dataUrl, filename);

  // Drive: in the background; the client queues it if the network is down.
  if (c.saveDrive && window.PB.drive.isSignedIn()) {
    strip.toBlob(
      (blob) => {
        if (!blob) return;
        window.PB.drive
          .upload('photo-booth', blob, filename)
          .then(() => {
            console.log('[Drive] Uploaded:', filename);
            const link = window.currentSessionFolderLink;
            if (link) {
              window.PB.captures.setDriveUrl(captureId, link);
              window.PB.liveViewer.host.broadcastDriveUpdate(filename, link);
            }
          })
          .catch((e: Error) => console.warn('[Drive] Upload failed:', e.message));
      },
      'image/jpeg',
      0.92,
    );
  }

  if (left()) return;
  setPhoto({ saving: false, reviewBadge: true });
  await sleep(Math.max(c.reviewTime * 1000, 1000));
  if (left()) return;

  // After a video, the done screen covers both (the QR is the same folder).
  const showDone =
    (opts.continueSession && c.vgSaveDrive && window.PB.drive.isSignedIn()) || c.vgThankYouEnabled;
  if (showDone) await showDoneScreen();
  if (!left()) resetToWelcome();
}
