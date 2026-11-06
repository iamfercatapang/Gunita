// Shown when the camera is unplugged mid-session: Reconnect, or leave the
// kiosk for the settings.

import { exitFromCameraLost, reconnectCamera } from './kiosk';
import type { CaptureUi } from './store';

export function CameraLost({ lost }: { lost: NonNullable<CaptureUi['cameraLost']> }) {
  return (
    <div id="kiosk-camera-lost" role="alertdialog" aria-labelledby="camera-lost-title">
      <i className="fa-solid fa-video-slash camera-lost-icon" />
      <div id="camera-lost-title" className="camera-lost-title">
        Camera Disconnected
      </div>
      <div className="camera-lost-text">
        The camera was disconnected. Check the USB cable and tap <strong>Reconnect</strong>.
      </div>
      <p id="camera-lost-status">{lost.status}</p>
      <div className="camera-lost-actions">
        <button
          type="button"
          id="btn-camera-lost-reconnect"
          className="vg-notice-btn vg-notice-btn--accent camera-lost-btn"
          disabled={lost.busy}
          onClick={() => void reconnectCamera()}
        >
          <i className="fa-solid fa-rotate-right" /> Reconnect
        </button>
        <button
          type="button"
          id="btn-camera-lost-exit"
          className="vg-notice-btn camera-lost-btn"
          onClick={exitFromCameraLost}
        >
          Exit to Settings
        </button>
      </div>
    </div>
  );
}
