import { mountScreen } from '../../ui/mount';
import { ViewerApp } from './ViewerApp';

/**
 * The kiosk and the viewer ship as one bundle. A page opened with
 * `?viewer=<hostPeerId>` (the link in the kiosk's QR code) is the viewer:
 * hide the kiosk markup and render the gallery.
 */
export function startLiveViewer(hostId: string): void {
  const container = document.getElementById('viewer-mode');
  if (!container) return;
  for (const el of document.body.children) {
    if (el !== container) (el as HTMLElement).style.visibility = 'hidden';
  }
  container.style.display = 'flex';
  mountScreen(container, <ViewerApp hostId={hostId} />);
}
