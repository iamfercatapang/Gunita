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
import './styles/admin-panels.css';
import './styles/pb-capture.css';
import './styles/vg-recording.css';
import './styles/live-viewer.css';
import './styles/dialogs.css';
import './styles/galleries.css';
import './styles/guest-flow.css';
import './styles/capture.css';
import './styles/responsive.css';

// Side-effect modules: populate window globals consumed by app.js.
import './constants';
import { GOOGLE_DRIVE_CLIENT_ID } from './constants';
import { AudioController } from './lib/audio';
import {
  VgCameraManager,
  computeLayout,
  deviceStore,
  downloadBlob,
  drawCoverFrame,
  drawPhoto,
  logTrackSize,
  makeFilename,
  photoConstraintsForSlot,
  saveBlobLocally,
} from './lib/capture';
import { DeviceManager } from './lib/devices';
import { DriveClient } from './lib/drive';
import { LiveViewerHost } from './lib/live-viewer';
import { KioskSecurity } from './lib/security';
import './state/app-state';
import './state/settings';
import { freezeFrame } from './screens/guest-flow/freeze-frame';
import { addCapture, captureCount, setDriveUrl } from './state/captures';
import { setLiveViewerStatus } from './state/live-viewer-status';
import { enabledPrompts } from './state/prompts';

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
    // The host's own client id (Capture Settings → Google Drive), else the built-in one.
    return window.appConfig.vgDriveClientId || GOOGLE_DRIVE_CLIENT_ID;
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
// PeerJS-based broadcaster. Idle until start() is called from the admin panel,
// which renders what the host reports (src/state/live-viewer-status.ts).
const liveViewerHost = new LiveViewerHost(
  {
    getEventName: () => window.appConfig.eventName || '',
    getNetworkAddr: () => window.appConfig.lvNetworkAddr || '',
  },
  {
    setViewerUrl: (viewerUrl) => setLiveViewerStatus({ viewerUrl }),
    // The QR code encodes the viewer URL, which the panel already has.
    setQrTarget: () => {},
    setStatus: (statusText, connected) => setLiveViewerStatus({ statusText, connected }),
    setViewerCount: (viewers) => setLiveViewerStatus({ viewers }),
    setSentCount: (sent) => setLiveViewerStatus({ sent }),
    showActive: () => setLiveViewerStatus({ active: true }),
    showIdle: () => setLiveViewerStatus({ active: false, viewerUrl: '' }),
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
  photoConstraintsForSlot,
  logTrackSize,
  computeLayout,
  drawPhoto,
  drawCoverFrame,
  makeFilename,
  saveBlobLocally,
  downloadBlob,
  deviceStore,
};

window.PB.captures = { add: addCapture, setDriveUrl, count: captureCount };
window.PB.prompts = { enabled: () => enabledPrompts(window.appConfig) };

// React screens load as their own chunks. The admin dashboard, the welcome
// screen and the kiosk's Recent Captures mount as soon as the page is up.
// Other kiosk screens load on first use, or earlier when app.js calls
// preload() as the kiosk launches, so opening one never waits on the network.
const loadDialogs = () => import('./screens/dialogs');
const loadGalleries = () => import('./screens/galleries');
const loadGuestFlow = () => import('./screens/guest-flow');
const loadAdmin = () => import('./screens/admin');
const loadWelcome = () => import('./screens/welcome');
const loadCapture = () => import('./screens/capture');
if (!new URLSearchParams(window.location.search).has('viewer')) {
  void loadAdmin().then((m) => m.mountAdmin());
  void loadWelcome().then((m) => m.mountWelcome());
  // Mounted up front: the preview <video> must exist when the kiosk launches
  // (see src/screens/capture/PreviewOverlay.tsx).
  void loadCapture().then((m) => m.mountCapture());
  void loadGalleries().then((m) => m.mountGalleries());
}
// The guest's last video frame, frozen when the camera is released, shown
// behind the photo booth offer.
let offerBackdrop: HTMLCanvasElement | null = null;
window.PB.ui = {
  preload: () => {
    void loadDialogs();
    void loadGuestFlow();
  },
  askPin: (opts) => loadDialogs().then((m) => m.askPin(opts)),
  askDisclaimer: (opts) => loadDialogs().then((m) => m.askDisclaimer(opts)),
  showWelcome: () => void loadWelcome().then((m) => m.showWelcome()),
  startPhotoSession: () => void loadCapture().then((m) => m.runPhotoSession()),
  startVideoSession: () => void loadCapture().then((m) => m.runVideoSession()),
  resetToWelcome: () => void loadCapture().then((m) => m.resetToWelcome()),
  hideWelcome: () => void loadWelcome().then((m) => m.hideWelcome()),
  showRecentCaptures: () => void loadGalleries().then((m) => m.showRecentCaptures()),
  freezeOfferBackdrop: (video) => {
    offerBackdrop = freezeFrame(video as HTMLVideoElement | null);
  },
  offerPhotoBooth: () => loadGuestFlow().then((m) => m.offerPhotoBooth(offerBackdrop)),
  showDone: (opts) => loadGuestFlow().then((m) => m.showDone(opts)),
  showPromptsPreview: (prompts) => void loadGuestFlow().then((m) => m.showPromptsPreview(prompts)),
  closeAll: () => {
    void loadDialogs().then((m) => m.closeAll());
    void loadGalleries().then((m) => m.closeRecentCaptures());
    void loadGuestFlow().then((m) => m.closeGuestScreens());
    void loadCapture().then((m) => m.closeCapture());
  },
};

// A page opened from the kiosk's QR code (`?viewer=<hostPeerId>`) is the
// live viewer, a React screen. It loads as its own chunk, so the kiosk
// doesn't pay for it.
const viewerHostId = new URLSearchParams(window.location.search).get('viewer');
if (viewerHostId) {
  void import('./screens/live-viewer').then(({ startLiveViewer }) => startLiveViewer(viewerHostId));
}

// Best-effort: try to flush any uploads that were queued offline last session.
// The DriveClient also wires its own `online` listener.
window.addEventListener('load', () => {
  if (navigator.onLine && driveClient.isSignedIn()) {
    void driveClient.flushQueue();
  }
});
