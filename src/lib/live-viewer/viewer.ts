// Viewer-side client. Boots only when the page URL contains `?viewer=<peerId>`;
// otherwise this is a no-op so the same JS bundle can ship with the kiosk
// and the viewer page.
//
// Responsibilities:
//   - Connect to the host's PeerJS id; auto-reconnect on close/error.
//   - Render incoming captures into the viewer gallery.
//   - Persist the last STORE_MAX captures in sessionStorage so a refresh
//     keeps the gallery populated.
//   - Hold a screen Wake Lock so the device doesn't sleep during the event.
//   - Open a lightbox for photos / a Drive-link QR for videos and uploaded
//     photos / a "still uploading" note for videos without a Drive link yet.
//
// All DOM IDs and classes are the same as the legacy code so the existing
// CSS in styles.css continues to apply.

import { type DataConnection, Peer } from 'peerjs';

import type { LiveViewerMsg, PhotoMsg, VideoMsg } from './protocol';

const STORE_MAX = 20;
const RECONNECT_MS = 3000;
const PEER_ERROR_RECONNECT_MS = 4000;

// Browsers expose QRCode as a global from the vendored qrcode.min.js script
// (loaded by index.html). We don't import it.
type QRCodeStatic = new (
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
interface QRCodeStaticWithLevel {
  CorrectLevel: { L: number; M: number; Q: number; H: number };
}

interface StoredItem {
  type: 'photo' | 'video';
  data: string | null;
  filename: string;
  ts: number;
  duration?: number;
  driveUrl?: string | null;
}

export class LiveViewerClient {
  /** Boot if `?viewer=<id>` is in the URL. Returns true if viewer mode started. */
  static tryStart(): boolean {
    const params = new URLSearchParams(window.location.search);
    const hostId = params.get('viewer');
    if (!hostId) return false;
    const client = new LiveViewerClient(hostId);
    client.boot();
    return true;
  }

  private viewerItems: Record<string, HTMLElement> = {};
  private seenIds = new Set<string>();
  private viewerCount = 0;
  private wakeLock: { release(): Promise<void> } | null = null;
  private peer: Peer | null = null;
  private readonly storeKey: string;

  private constructor(private hostId: string) {
    this.storeKey = `lv_gallery_${hostId}`;
  }

  private boot(): void {
    // Hide everything except the viewer overlay (matches legacy behaviour
    // when the bundle is served from the same path as the kiosk).
    for (const el of document.body.children) {
      const html = el as HTMLElement;
      if (html.id !== 'viewer-mode') html.style.visibility = 'hidden';
    }
    const viewer = document.getElementById('viewer-mode');
    if (viewer) viewer.style.display = 'flex';

    this.wireLightbox();
    this.acquireWakeLock();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.wakeLock) this.acquireWakeLock();
    });

    this.restoreGallery();
    this.connectToHost();
  }

  // ─── PeerJS connection ───────────────────────────────────────────────────

  private connectToHost(): void {
    // Tear down any previous peer.
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }
    const peer = new Peer();
    this.peer = peer;

    peer.on('open', () => {
      const conn = peer.connect(this.hostId, { reliable: true });
      conn.on('open', () => {
        this.setStatusDot('#22c55e');
        this.setStatusText('Live');
        this.setEventName('Connected — waiting for captures…');
      });
      conn.on('data', (raw) => this.handleMessage(raw));
      conn.on('close', () => this.scheduleReconnect(RECONNECT_MS));
      conn.on('error', () => this.scheduleReconnect(RECONNECT_MS));
    });

    peer.on('error', (err: Error & { type?: string }) => {
      console.warn('[Viewer] Peer error:', err.type);
      this.scheduleReconnect(PEER_ERROR_RECONNECT_MS);
    });
  }

  private scheduleReconnect(delay: number): void {
    this.setStatusDot('#f59e0b');
    this.setStatusText('Reconnecting…');
    setTimeout(() => this.connectToHost(), delay);
  }

  private handleMessage(raw: unknown): void {
    let msg: LiveViewerMsg;
    try {
      msg = JSON.parse(String(raw)) as LiveViewerMsg;
    } catch {
      return;
    }
    // Deduplicate replays.
    if (msg._id) {
      if (this.seenIds.has(msg._id)) return;
      this.seenIds.add(msg._id);
    }
    switch (msg.type) {
      case 'hello':
        if (msg.eventName) this.setEventName(msg.eventName);
        break;
      case 'photo':
        this.addItem(msg, 'photo');
        this.saveItem(msg, 'photo');
        break;
      case 'video':
        this.addItem(msg, 'video');
        this.saveItem(msg, 'video');
        break;
      case 'drive-update':
        this.updateDrive(msg.filename, msg.driveUrl);
        this.saveDriveUpdate(msg.filename, msg.driveUrl);
        break;
    }
  }

  // ─── Gallery rendering ───────────────────────────────────────────────────

  private addItem(msg: PhotoMsg | VideoMsg | StoredItem, type: 'photo' | 'video'): void {
    this.viewerCount++;
    const empty = document.getElementById('viewer-empty');
    if (empty) empty.style.display = 'none';

    const ts = new Date(msg.ts).toLocaleTimeString();
    const duration = (msg as VideoMsg).duration;
    const dur = type === 'video' && duration ? ` (${duration}s)` : '';
    const label = type === 'video' ? `Video${dur}` : 'Photo';
    const driveUrl = msg.driveUrl ?? null;

    const filenameAttr = (msg.filename || '').replace(/"/g, '');
    const item = document.createElement('div');
    item.className = 'viewer-item viewer-item-new';
    item.dataset.type = type;
    item.dataset.filename = filenameAttr;
    if (driveUrl) item.dataset.driveUrl = driveUrl;

    const mediaHtml = type === 'photo' ? renderPhotoMedia(msg.data) : renderVideoMedia(msg.data);
    const qrBtnHtml = driveUrl ? '<button class="viewer-qr-btn">📱 QR</button>' : '';

    item.innerHTML = `
      <div class="viewer-item-media" style="position:relative;width:100%;padding-top:${type === 'video' ? '56.25%' : '75%'};overflow:hidden;border-radius:8px 8px 0 0;cursor:pointer;">
        <div style="position:absolute;inset:0;">${mediaHtml}</div>
      </div>
      <div class="viewer-item-footer" style="padding:0.4rem 0.6rem;display:flex;align-items:center;gap:0.4rem;">
        ${qrBtnHtml}
        <span style="font-size:0.78rem;font-weight:600;color:#f1f5f9;flex:1;">${label}</span>
        <span style="font-size:0.72rem;color:#64748b;">${ts}</span>
      </div>
    `;

    // Media click:
    //   photo            → lightbox
    //   video + driveUrl → open Drive in new tab
    //   video, no drive  → lightbox with explanatory note
    const media = item.querySelector('.viewer-item-media') as HTMLElement | null;
    if (media) {
      media.addEventListener('click', () => {
        const currentDriveUrl = item.dataset.driveUrl || null;
        if (type === 'photo') {
          if (msg.data) this.openPhotoLightbox(msg.data);
        } else if (currentDriveUrl) {
          window.open(currentDriveUrl, '_blank');
        } else {
          this.openVideoNoLinkLightbox(msg.data);
        }
      });
    }

    const qrBtn = item.querySelector('.viewer-qr-btn') as HTMLElement | null;
    if (qrBtn) {
      qrBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentDriveUrl = item.dataset.driveUrl || driveUrl;
        if (currentDriveUrl) this.openQrLightbox(currentDriveUrl);
      });
    }

    if (msg.filename) this.viewerItems[msg.filename] = item;

    const gallery = document.getElementById('viewer-gallery');
    if (gallery) gallery.prepend(item);
    setTimeout(() => item.classList.remove('viewer-item-new'), 600);
  }

  private updateDrive(filename: string, driveUrl: string): void {
    const item = this.viewerItems[filename];
    if (!item || !driveUrl) return;
    item.dataset.driveUrl = driveUrl;
    const footer = item.querySelector('.viewer-item-footer');
    if (footer && !footer.querySelector('.viewer-qr-btn')) {
      const btn = document.createElement('button');
      btn.className = 'viewer-qr-btn';
      btn.innerHTML = '📱 QR';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openQrLightbox(driveUrl);
      });
      footer.prepend(btn);
    }
  }

  // ─── Lightbox ────────────────────────────────────────────────────────────

  private wireLightbox(): void {
    const close = document.getElementById('viewer-lb-close');
    const overlay = document.getElementById('viewer-lightbox');
    const closeLb = (): void => this.closeLightbox();
    if (close) close.addEventListener('click', closeLb);
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeLb();
      });
    }
  }

  private openPhotoLightbox(dataUrl: string): void {
    const img = document.getElementById('viewer-lb-img') as HTMLImageElement | null;
    if (img) {
      img.src = dataUrl;
      img.style.display = '';
    }
    this.setVisible('viewer-lb-qr-wrap', false);
    this.setVisible('viewer-lb-video-note', false);
    this.showLightbox();
  }

  private openVideoNoLinkLightbox(thumbDataUrl: string | null): void {
    const img = document.getElementById('viewer-lb-img') as HTMLImageElement | null;
    if (img) {
      if (thumbDataUrl) {
        img.src = thumbDataUrl;
        img.style.display = '';
      } else {
        img.style.display = 'none';
      }
    }
    this.setVisible('viewer-lb-qr-wrap', false);
    this.setVisible('viewer-lb-video-note', true);
    this.showLightbox();
  }

  private openQrLightbox(driveUrl: string): void {
    const img = document.getElementById('viewer-lb-img') as HTMLImageElement | null;
    if (img) {
      img.style.display = 'none';
      img.src = '';
    }
    const qrEl = document.getElementById('viewer-lb-qr');
    if (qrEl) {
      qrEl.innerHTML = '';
      const QRCode = (window as unknown as { QRCode?: QRCodeStatic & QRCodeStaticWithLevel })
        .QRCode;
      if (QRCode) {
        new QRCode(qrEl, {
          text: driveUrl,
          width: 220,
          height: 220,
          colorDark: '#1e293b',
          colorLight: '#fff',
          correctLevel: QRCode.CorrectLevel.M,
        });
      }
    }
    const urlEl = document.getElementById('viewer-lb-drive-url');
    if (urlEl) urlEl.textContent = driveUrl;
    this.setVisible('viewer-lb-qr-wrap', true);
    this.setVisible('viewer-lb-video-note', false);
    this.showLightbox();
  }

  private closeLightbox(): void {
    const overlay = document.getElementById('viewer-lightbox');
    if (overlay) overlay.style.display = 'none';
    const img = document.getElementById('viewer-lb-img') as HTMLImageElement | null;
    if (img) img.src = '';
    const qrEl = document.getElementById('viewer-lb-qr');
    if (qrEl) qrEl.innerHTML = '';
    this.setVisible('viewer-lb-video-note', false);
  }

  private showLightbox(): void {
    const overlay = document.getElementById('viewer-lightbox');
    if (overlay) overlay.style.display = 'flex';
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  private storedItems(): StoredItem[] {
    try {
      return JSON.parse(sessionStorage.getItem(this.storeKey) || '[]') as StoredItem[];
    } catch {
      return [];
    }
  }

  private saveItem(msg: PhotoMsg | VideoMsg, type: 'photo' | 'video'): void {
    try {
      const items = this.storedItems();
      items.unshift({
        type,
        data: msg.data,
        filename: msg.filename,
        ts: msg.ts,
        duration: (msg as VideoMsg).duration,
        driveUrl: msg.driveUrl ?? null,
      });
      if (items.length > STORE_MAX) items.length = STORE_MAX;
      sessionStorage.setItem(this.storeKey, JSON.stringify(items));
    } catch {
      // Quota exceeded — skip caching this item.
    }
  }

  private saveDriveUpdate(filename: string, driveUrl: string): void {
    try {
      const items = this.storedItems();
      const item = items.find((i) => i.filename === filename);
      if (item) {
        item.driveUrl = driveUrl;
        sessionStorage.setItem(this.storeKey, JSON.stringify(items));
      }
    } catch {
      // ignore
    }
  }

  private restoreGallery(): void {
    const saved = this.storedItems();
    if (saved.length === 0) return;
    // saved is newest-first; reverse so successive prepend keeps newest on top
    for (const item of saved.slice().reverse()) {
      this.addItem(item, item.type);
    }
  }

  // ─── Wake lock ───────────────────────────────────────────────────────────

  private async acquireWakeLock(): Promise<void> {
    const nav = navigator as Navigator & {
      wakeLock?: {
        request(type: 'screen'): Promise<{
          release(): Promise<void>;
          addEventListener(event: 'release', cb: () => void): void;
        }>;
      };
    };
    if (!nav.wakeLock) return;
    try {
      const lock = await nav.wakeLock.request('screen');
      this.wakeLock = lock;
      lock.addEventListener('release', () => {
        this.wakeLock = null;
      });
    } catch (e) {
      console.warn('[Viewer] Wake Lock:', (e as Error).message);
    }
  }

  // ─── Tiny DOM helpers ────────────────────────────────────────────────────

  private setStatusDot(color: string): void {
    const el = document.getElementById('viewer-status-dot');
    if (el) el.style.background = color;
  }

  private setStatusText(text: string): void {
    const el = document.getElementById('viewer-status-text');
    if (el) el.textContent = text;
  }

  private setEventName(text: string): void {
    const el = document.getElementById('viewer-event-name');
    if (el) el.textContent = text;
  }

  private setVisible(id: string, visible: boolean): void {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? '' : 'none';
  }
}

// ─── Pure HTML builders (separated so the class body stays readable) ─────

function renderPhotoMedia(data: string | null): string {
  if (data) {
    return `<img src="${data}" alt="Photo" style="width:100%;height:100%;object-fit:cover;display:block;">`;
  }
  return `<div style="width:100%;height:100%;background:#1e293b;display:flex;align-items:center;justify-content:center;"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`;
}

function renderVideoMedia(data: string | null): string {
  if (data) {
    const thumb = `<img src="${data}" alt="Video" style="width:100%;height:100%;object-fit:cover;display:block;opacity:0.9;">`;
    const playOverlay = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><div style="width:46px;height:46px;background:rgba(0,0,0,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div>`;
    return `${thumb}${playOverlay}`;
  }
  return `<div style="width:100%;height:100%;background:#1e293b;display:flex;align-items:center;justify-content:center;"><svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" style="color:#475569;"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>`;
}
