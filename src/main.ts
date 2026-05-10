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
import '@fortawesome/fontawesome-free/css/all.min.css';

// Side-effect modules: populate window globals consumed by app.js.
import './constants';
import { GOOGLE_DRIVE_CLIENT_ID } from './constants';
import { AudioController } from './lib/audio';
import { DriveClient } from './lib/drive';
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

window.PB = window.PB || ({} as Window['PB']);
window.PB.drive = driveClient;
window.PB.audio = audioController;

// Best-effort: try to flush any uploads that were queued offline last session.
// The DriveClient also wires its own `online` listener.
window.addEventListener('load', () => {
  if (navigator.onLine && driveClient.isSignedIn()) {
    void driveClient.flushQueue();
  }
});
