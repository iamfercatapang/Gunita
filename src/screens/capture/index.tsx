// The kiosk capture screens (Phase 4f): the photo booth, the video
// guestbook, the recording preview and the camera-lost screen, rendered into
// #kiosk-capture-root. app.js starts sessions through window.PB.ui.

import { useSyncExternalStore } from 'react';

import { mountScreen } from '../../ui/mount';
import { CameraLost } from './CameraLost';
import { PhotoBooth } from './PhotoBooth';
import { PreviewOverlay } from './PreviewOverlay';
import { VideoBooth } from './VideoBooth';
import {
  getCaptureUi,
  newVisit,
  resetCaptureUi,
  setCameraLost,
  setPreview,
  subscribeCaptureUi,
} from './store';
import { onCameraLost, stopRecording } from './video-session';

export { resetToWelcome } from './kiosk';
export { runPhotoSession } from './photo-session';
export { runVideoSession, stopRecording } from './video-session';

function CaptureScreens() {
  const ui = useSyncExternalStore(subscribeCaptureUi, getCaptureUi);
  return (
    <>
      <PhotoBooth shown={ui.booth === 'photo'} ui={ui.photo} />
      <VideoBooth shown={ui.booth === 'video'} ui={ui.video} />
      <PreviewOverlay preview={ui.preview} />
      {ui.cameraLost && <CameraLost lost={ui.cameraLost} />}
    </>
  );
}

let mounted = false;

export function mountCapture(): void {
  const container = document.getElementById('kiosk-capture-root');
  if (!container || mounted) return;
  mounted = true;
  mountScreen(container, <CaptureScreens />);
  // The camera manager's track-ended watchdog.
  window.addEventListener('pb:vg-camera-lost', onCameraLost);
}

/**
 * Leaving the kiosk: stop any recording (it's still saved) and clear the
 * capture screens. A session waiting on the preview or a button is left
 * waiting; the next one starts fresh.
 */
export function closeCapture(): void {
  newVisit();
  stopRecording();
  setPreview(null);
  setCameraLost(null);
  resetCaptureUi();
}
