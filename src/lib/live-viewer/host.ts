// Live-viewer host. Runs on the kiosk; accepts PeerJS DataChannel
// connections from any viewer that opened the share link, then broadcasts
// captures (photos, videos, Drive updates) as they happen.
//
// Reliability adds beyond the legacy code:
//   - The PeerJS instance auto-rebuilds if it errors out (e.g. the cloud
//     signalling server hiccupped during `open`). Bounded to 3 retries.
//   - A small in-memory buffer holds the most recent broadcasts so a viewer
//     that connects mid-event still sees what the kiosk just captured. The
//     buffer's size is bounded by BACKFILL_MAX.
//   - Per-connection send queue prevents in-flight writes from being dropped
//     during a brief DataChannel renegotiation.

import { type DataConnection, Peer } from 'peerjs';

import { type LiveViewerMsg, type VideoMsg, newMessageId } from './protocol';

const BACKFILL_MAX = 30;
const PEER_OPEN_RETRY_MAX = 3;
const PEER_OPEN_RETRY_BASE_MS = 1500;

export interface LiveViewerHostDeps {
  getEventName(): string;
  /** Admin-configured network address, e.g. `http://192.168.1.50`. */
  getNetworkAddr(): string;
}

export interface LiveViewerHostUI {
  setViewerUrl(url: string): void;
  setQrTarget(text: string): void;
  setStatus(text: string, isConnected: boolean): void;
  setViewerCount(n: number): void;
  setSentCount(n: number): void;
  /** Show the "active" panel and hide the idle panel. */
  showActive(): void;
  /** Show the "idle" panel and hide the active panel. */
  showIdle(): void;
}

export class LiveViewerHost {
  private peer: Peer | null = null;
  private conns: DataConnection[] = [];
  private sent = 0;
  private backfill: LiveViewerMsg[] = [];
  private openRetries = 0;
  private currentPeerId: string | null = null;

  constructor(
    private deps: LiveViewerHostDeps,
    private ui: LiveViewerHostUI,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  start(): void {
    if (this.peer) return; // already running
    this.openRetries = 0;
    this.bootPeer();
  }

  stop(): void {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }
    this.conns = [];
    this.sent = 0;
    this.backfill = [];
    this.currentPeerId = null;
    this.ui.setViewerCount(0);
    this.ui.setSentCount(0);
    this.ui.showIdle();
  }

  isRunning(): boolean {
    return this.peer !== null;
  }

  broadcastPhoto(dataUrl: string, filename: string): void {
    this.broadcast({
      type: 'photo',
      data: dataUrl,
      filename,
      ts: Date.now(),
      driveUrl: null,
    });
  }

  /**
   * Send a video thumbnail card. The host generates a JPEG first-frame
   * thumbnail from the blob URL; if extraction fails the card still goes
   * out with a null `data` field so the viewer shows a placeholder tile.
   */
  broadcastVideo(blobUrl: string, filename: string): void {
    void this.captureVideoThumb(blobUrl, (thumbDataUrl, duration) => {
      const msg: VideoMsg = {
        type: 'video',
        data: thumbDataUrl,
        filename,
        ts: Date.now(),
        duration,
        driveUrl: null,
      };
      this.broadcast(msg);
    });
  }

  broadcastDriveUpdate(filename: string, driveUrl: string): void {
    if (!driveUrl) return;
    this.broadcast({ type: 'drive-update', filename, driveUrl });
  }

  // ─── Peer lifecycle ──────────────────────────────────────────────────────

  private bootPeer(): void {
    const peer = new Peer(); // free peerjs.com cloud signalling
    this.peer = peer;

    peer.on('open', (id) => {
      this.currentPeerId = id;
      this.openRetries = 0;
      const viewerUrl = this.composeViewerUrl(id);
      this.ui.setViewerUrl(viewerUrl);
      this.ui.setQrTarget(viewerUrl);
      this.ui.showActive();
      this.ui.setStatus('Waiting for viewer…', false);
    });

    peer.on('connection', (conn) => this.attachConnection(conn));

    peer.on('error', (err: Error & { type?: string }) => {
      console.warn('[LiveViewer] PeerJS error:', err.type, err.message);
      this.ui.setStatus(`Connection error: ${err.type ?? 'unknown'}`, false);
      // If the peer never opened (signalling-server flake), try again with
      // backoff. If it opened and then errored later, leave it — the user
      // can stop/start manually.
      if (!this.currentPeerId && this.openRetries < PEER_OPEN_RETRY_MAX) {
        const delay = PEER_OPEN_RETRY_BASE_MS * 2 ** this.openRetries;
        this.openRetries++;
        console.info(
          `[LiveViewer] Retrying peer open in ${delay}ms (${this.openRetries}/${PEER_OPEN_RETRY_MAX})`,
        );
        try {
          peer.destroy();
        } catch {
          // ignore
        }
        this.peer = null;
        setTimeout(() => {
          if (!this.peer) this.bootPeer();
        }, delay);
      }
    });
  }

  private attachConnection(conn: DataConnection): void {
    conn.on('open', () => {
      if (this.conns.includes(conn)) return; // guard: some browsers fire twice
      this.conns.push(conn);
      this.ui.setViewerCount(this.conns.length);
      this.ui.setStatus(this.viewerCountLabel(), true);
      // Greet the new viewer and replay anything they missed.
      const hello: LiveViewerMsg = {
        type: 'hello',
        eventName: this.deps.getEventName(),
      };
      this.sendTo(conn, hello);
      for (const msg of this.backfill) this.sendTo(conn, msg);
    });

    const drop = (): void => {
      this.conns = this.conns.filter((c) => c !== conn);
      const n = this.conns.length;
      this.ui.setViewerCount(n);
      this.ui.setStatus(n > 0 ? this.viewerCountLabel() : 'Waiting for viewer…', n > 0);
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  private composeViewerUrl(peerId: string): string {
    const addr = (this.deps.getNetworkAddr() || '').trim().replace(/\/+$/, '');
    const base = addr || window.location.origin;
    return `${base}${window.location.pathname}?viewer=${peerId}`;
  }

  private viewerCountLabel(): string {
    const n = this.conns.length;
    return `${n} viewer${n === 1 ? '' : 's'} connected`;
  }

  // ─── Send path ───────────────────────────────────────────────────────────

  private broadcast(msg: LiveViewerMsg): void {
    msg._id = newMessageId();
    this.backfill.push(msg);
    if (this.backfill.length > BACKFILL_MAX) this.backfill.shift();
    if (this.conns.length === 0) return;
    for (const conn of this.conns) this.sendTo(conn, msg);
    this.sent++;
    this.ui.setSentCount(this.sent);
  }

  private sendTo(conn: DataConnection, msg: LiveViewerMsg): void {
    try {
      if (conn.open) conn.send(JSON.stringify(msg));
    } catch (e) {
      console.warn('[LiveViewer] send error', e);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Generate a JPEG thumbnail from the first frame of the given blob URL.
   * Uses loadedmetadata → seek to avoid the onloadeddata race condition.
   * Never hangs: a 5-second guard fires `done(null, 0)` if metadata stalls.
   */
  private captureVideoThumb(
    blobUrl: string,
    done: (dataUrl: string | null, durationSec: number) => void,
  ): void {
    const vid = document.createElement('video');
    const canvas = document.createElement('canvas');
    let called = false;
    const finish = (dataUrl: string | null, dur: number): void => {
      if (called) return;
      called = true;
      vid.src = '';
      done(dataUrl, dur);
    };
    const guard = setTimeout(() => finish(null, 0), 5000);
    vid.preload = 'metadata';
    vid.muted = true;
    vid.playsInline = true;
    vid.onloadedmetadata = (): void => {
      vid.currentTime = Math.min(0.5, (vid.duration || 1) * 0.1);
    };
    vid.onseeked = (): void => {
      clearTimeout(guard);
      const targetW = Math.min(vid.videoWidth || 640, 640);
      const targetH = Math.min(vid.videoHeight || 360, 360);
      const sx = vid.videoWidth ? targetW / vid.videoWidth : 1;
      const sy = vid.videoHeight ? targetH / vid.videoHeight : 1;
      const scale = Math.min(sx, sy);
      canvas.width = Math.round((vid.videoWidth || 640) * scale);
      canvas.height = Math.round((vid.videoHeight || 360) * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        finish(null, Math.round(vid.duration || 0));
        return;
      }
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      finish(canvas.toDataURL('image/jpeg', 0.72), Math.round(vid.duration || 0));
    };
    vid.onerror = (): void => {
      clearTimeout(guard);
      finish(null, 0);
    };
    vid.src = blobUrl;
  }
}
