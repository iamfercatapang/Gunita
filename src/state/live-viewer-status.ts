// What the Live Gallery Viewer host is doing, for the admin panel. The host
// (src/lib/live-viewer/host.ts) reports through its UI callbacks, which
// main.ts points here.

export interface LiveViewerStatus {
  active: boolean;
  statusText: string;
  connected: boolean;
  viewerUrl: string;
  viewers: number;
  sent: number;
}

let status: LiveViewerStatus = {
  active: false,
  statusText: 'Waiting for viewer…',
  connected: false,
  viewerUrl: '',
  viewers: 0,
  sent: 0,
};
const listeners = new Set<() => void>();

export function setLiveViewerStatus(patch: Partial<LiveViewerStatus>): void {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

export function getLiveViewerStatus(): LiveViewerStatus {
  return status;
}

export function subscribeLiveViewerStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
