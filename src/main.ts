// Application entry point.
//
// Responsibilities:
//   1. Bundle CDN dependencies (jQuery, PeerJS) and assign them to `window`
//      so the legacy `public/app.js` keeps seeing them as globals.
//   2. Pull in the bundled CSS for FontAwesome and the Inter font (no more
//      external CDN requests, so the kiosk can run fully offline).
//   3. Run the typed state and constants modules — their side effects
//      populate `window.appConfig`, `window.LAYOUT_DEFS`, etc.
//   4. Construct the typed library namespaces (window.PB.*) consumed by
//      app.js — currently the unified Drive client (Phase 2.A).
//
// The legacy `app.js` still runs via a separate non-module <script> tag in
// `index.html` and continues to behave identically to before.

import jQueryLib from 'jquery';
import { Peer } from 'peerjs';

// Vendor CSS — bundled, no network needed at runtime.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
// Fraunces — display serif for kiosk hero title + VG question prompts only.
// Loaded but not applied yet; component CSS opts in via var(--font-display).
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

// Design tokens — primitive + semantic. Theme-scoped via [data-theme].
// Foundation only: nothing visually changes until components opt in.
import './styles/tokens.css';
import './styles/themes.css';
import './styles/welcome.css';
import './styles/pb-offer.css';
import './styles/done-screen.css';
import './styles/admin.css';

// Side-effect modules: populate window globals consumed by app.js.
import './constants';
import { GOOGLE_DRIVE_CLIENT_ID } from './constants';
import { AudioController } from './lib/audio';
import {
  VgCameraManager,
  computeLayout,
  downloadBlob,
  drawCoverFrame,
  drawPhoto,
  makeFilename,
  saveBlobLocally,
} from './lib/capture';
import { DeviceManager } from './lib/devices';
import { DriveClient } from './lib/drive';
import { LiveViewerClient, LiveViewerHost } from './lib/live-viewer';
import { KioskSecurity } from './lib/security';
import './state/app-state';

// Expose bundled vendor libs as globals for the legacy app.js.
window.$ = jQueryLib;
window.jQuery = jQueryLib;
window.Peer = Peer;

// ─── DriveClient instance ────────────────────────────────────────────────────
// One client, two folder roles. The legacy code already shared the OAuth
// token and the per-guest session folder between Photo Booth and Video
// Guestbook; this client formalises that.
const driveClient = new DriveClient({
  getClientId(): string {
    // Priority: VG client-id input → PB client-id input → appConfig override → env constant
    const vgInput = (
      document.getElementById('vg-drive-client-id') as HTMLInputElement | null
    )?.value.trim();
    const pbInput = (
      document.getElementById('drive-client-id') as HTMLInputElement | null
    )?.value.trim();
    return vgInput || pbInput || window.appConfig.vgDriveClientId || GOOGLE_DRIVE_CLIENT_ID;
  },
  getPbFolderName(): string {
    return window.appConfig.driveFolderName || 'Photo Booth Captures';
  },
  getVgFolderName(): string {
    return window.appConfig.vgDriveFolderName || 'Video Guestbook Captures';
  },
  getEventName(): string {
    return window.appConfig.eventName || '';
  },
  getSessionId(): string | null {
    return window.currentSessionId;
  },
  ensureSessionId(): string {
    return window.startNewSession();
  },
  setSessionFolderLink(id: string, link: string): void {
    window.currentSessionFolderId = id;
    window.currentSessionFolderLink = link;
  },
});

// ─── AudioController instance ────────────────────────────────────────────────
// Mic monitoring, Bluetooth-sink pre-wiring, beep playback, speaker test.
const audioController = new AudioController();

// ─── DeviceManager instance ──────────────────────────────────────────────────
// Camera + audio device enumeration, camera test-preview lifecycle.
// Deps wrap appConfig so the manager never imports state directly.
const deviceManager = new DeviceManager({
  getCameraId: (role) =>
    role === 'pb' ? window.appConfig.selectedCameraId : window.appConfig.vgSelectedCameraId,
  setCameraId: (role, id) => {
    if (role === 'pb') window.appConfig.selectedCameraId = id;
    else window.appConfig.vgSelectedCameraId = id;
  },
  getMicId: () => window.appConfig.vgSelectedMicId,
  setMicId: (id) => {
    window.appConfig.vgSelectedMicId = id;
  },
  getSpeakerId: () => window.appConfig.vgSelectedSpeakerId,
  setSpeakerId: (id) => {
    window.appConfig.vgSelectedSpeakerId = id;
  },
});

// ─── KioskSecurity instance ──────────────────────────────────────────────────
// PIN hashing (PBKDF2 with legacy SHA-256 migration) and fullscreen helpers.
const kioskSecurity = new KioskSecurity();

// ─── LiveViewerHost instance ─────────────────────────────────────────────────
// PeerJS-based broadcaster. Idle until start() is called by the admin button.
// QR rendering uses the globally vendored qrcode.min.js (loaded by index.html).
function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function setVisible(id: string, visible: boolean): void {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? '' : 'none';
}
function paintQr(targetId: string, text: string): void {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = '';
  const QR = (
    window as unknown as {
      QRCode?: new (
        el: HTMLElement,
        opts: {
          text: string;
          width: number;
          height: number;
          colorDark: string;
          colorLight: string;
          correctLevel: number;
        },
      ) => unknown;
    }
  ).QRCode;
  const Level = (window as unknown as { QRCode?: { CorrectLevel: { M: number } } }).QRCode;
  if (!QR || !Level) return;
  new QR(target, {
    text,
    width: 164,
    height: 164,
    colorDark: '#1e293b',
    colorLight: '#ffffff',
    correctLevel: Level.CorrectLevel.M,
  });
}

const liveViewerHost = new LiveViewerHost(
  {
    getEventName: () => window.appConfig.eventName || '',
    getNetworkAddr: () => window.appConfig.lvNetworkAddr || '',
  },
  {
    setViewerUrl: (url) => setText('lv-viewer-url', url),
    setQrTarget: (text) => paintQr('lv-qr-container', text),
    setStatus: (text, isConnected) => {
      setText('lv-status-text', text);
      const dot = document.getElementById('lv-status-dot');
      if (dot) dot.classList.toggle('lv-dot-on', isConnected);
    },
    setViewerCount: (n) => setText('lv-viewer-count', String(n)),
    setSentCount: (n) => setText('lv-sent-count', String(n)),
    showActive: () => {
      setVisible('lv-idle-state', false);
      setVisible('lv-active-state', true);
    },
    showIdle: () => {
      setVisible('lv-active-state', false);
      setVisible('lv-idle-state', true);
      const qr = document.getElementById('lv-qr-container');
      if (qr) qr.innerHTML = '';
    },
  },
);

// ─── Capture namespace ───────────────────────────────────────────────────────
// VgCameraManager owns the VG MediaStream lifecycle and writes to
// window.currentStream so the many legacy read-sites in app.js continue to
// work unchanged. The onCameraLost callback is wired by app.js (it owns the
// camera-lost overlay) via a custom event to avoid a circular dependency.
const vgCameraManager = new VgCameraManager({
  onCameraLost: () => {
    window.dispatchEvent(new CustomEvent('pb:vg-camera-lost'));
  },
});

window.PB = window.PB || ({} as Window['PB']);
window.PB.drive = driveClient;
window.PB.audio = audioController;
window.PB.devices = deviceManager;
window.PB.security = kioskSecurity;
window.PB.liveViewer = { host: liveViewerHost };
window.PB.capture = {
  camera: vgCameraManager,
  computeLayout,
  drawPhoto,
  drawCoverFrame,
  makeFilename,
  saveBlobLocally,
  downloadBlob,
};

// Viewer mode auto-boots when the URL has `?viewer=<id>`; no-op otherwise.
LiveViewerClient.tryStart();

// Best-effort: try to flush any uploads that were queued offline last session.
// The DriveClient also wires its own `online` listener.
window.addEventListener('load', () => {
  if (navigator.onLine && driveClient.isSignedIn()) {
    void driveClient.flushQueue();
  }
});
