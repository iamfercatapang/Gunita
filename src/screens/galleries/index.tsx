// Galleries (Phase 4c): the dashboard's Recent Captures (with "View all"
// and the lightbox) and the kiosk's Recent Captures window. Both read the
// captures list in src/state/captures.ts, which app.js writes to.

import { useSyncExternalStore } from 'react';

import { mountScreen } from '../../ui/mount';
import { DashboardGallery } from './DashboardGallery';
import { RecentCaptures } from './RecentCaptures';

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

/** Render both galleries into their containers in index.html. */
export function mountGalleries(): void {
  const dashboard = document.getElementById('dashboard-gallery');
  if (dashboard) mountScreen(dashboard, <DashboardGallery />);
  const kiosk = document.getElementById('recent-captures-root');
  if (kiosk) mountScreen(kiosk, <KioskRecentCaptures />);
}
