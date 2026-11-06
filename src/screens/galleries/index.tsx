// Galleries (Phase 4c): the dashboard's Recent Captures (with "View all"
// and the lightbox) and the kiosk's Recent Captures window. Both read the
// captures list in src/state/captures.ts, which app.js writes to. The
// dashboard one is rendered by the admin dashboard (src/screens/admin).

import { useSyncExternalStore } from 'react';

import { mountScreen } from '../../ui/mount';
import { RecentCaptures } from './RecentCaptures';

export { DashboardGallery } from './DashboardGallery';

// Whether the kiosk's Recent Captures window is open.
let kioskOpen = false;
const listeners = new Set<() => void>();
function setKioskOpen(open: boolean): void {
  kioskOpen = open;
  for (const l of listeners) l();
}

export function showRecentCaptures(): void {
  setKioskOpen(true);
}

export function closeRecentCaptures(): void {
  setKioskOpen(false);
}

function KioskRecentCaptures() {
  const open = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => kioskOpen,
  );
  return open ? <RecentCaptures onClose={closeRecentCaptures} /> : null;
}

/** Render the kiosk's Recent Captures into its container in index.html. */
export function mountGalleries(): void {
  const kiosk = document.getElementById('recent-captures-root');
  if (kiosk) mountScreen(kiosk, <KioskRecentCaptures />);
}
