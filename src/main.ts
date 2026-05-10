// Phase 1 entry point.
//
// Responsibilities:
//   1. Bundle CDN dependencies (jQuery, PeerJS) and assign them to `window`
//      so the legacy `public/app.js` keeps seeing them as globals.
//   2. Pull in the bundled CSS for FontAwesome and the Inter font (no more
//      external CDN requests, so the kiosk can run fully offline).
//   3. Run the typed state and constants modules — their side effects
//      populate `window.appConfig`, `window.LAYOUT_DEFS`, etc.
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
import './state/app-state';

// Expose bundled vendor libs as globals for the legacy app.js.
window.$ = jQueryLib;
window.jQuery = jQueryLib;
window.Peer = Peer;
