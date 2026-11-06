// The admin dashboard (Phase 4e): every settings panel, rendered from the
// settings store (src/state/settings.ts) into #admin-dashboard.

import { mountScreen } from '../../ui/mount';
import { AdminApp } from './AdminApp';

let scanned = false;

export function mountAdmin(): void {
  const container = document.getElementById('admin-dashboard');
  if (!container) return;
  mountScreen(container, <AdminApp />);
  // Find the cameras and audio devices once, so Capture Settings is ready.
  if (!scanned) {
    scanned = true;
    void window.PB.devices.populateCameraList('vg');
    void window.PB.devices.populateAudioDeviceList();
  }
}
