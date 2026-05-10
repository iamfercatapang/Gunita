// Unified Google Drive client.
//
// Replaces the duplicated PB / VG flows in the legacy app.js. Provides:
//   • single OAuth token (the legacy code already converged on this)
//   • per-role root + event folder caching
//   • shared session folder (one folder per guest, used by both roles)
//   • exponential-backoff retry with jitter on 5xx / 429 / network errors
//   • bounded concurrency (Drive recommends ≤ 2 concurrent uploads per user)
//   • offline persistent queue — captures recorded while offline survive a
//     full page reload and sync when connectivity returns
//
// The client does NOT touch the DOM directly. Status updates flow through
// the optional setStatus dep, so the host (admin UI) can render however it
// likes. The QR prompt is owned by the kiosk UI and lives elsewhere.

import {
  type PendingUpload,
  enqueue,
  listPending,
  markFailed,
  markInFlight,
  pendingCount,
  remove as removeFromQueue,
} from './queue';
import type {
  DriveClientDeps,
  DriveFile,
  DriveFolderRole,
  DriveSessionFolder,
  DriveUploadResult,
  GoogleOauthClient,
} from './types';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILES_API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

const MAX_CONCURRENT_UPLOADS = 2;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

interface FolderCache {
  root: string | null;
  event: string | null;
}

export class DriveClient {
  private accessToken: string | null = null;

  private folderCache: Record<DriveFolderRole, FolderCache> = {
    'photo-booth': { root: null, event: null },
    'video-guestbook': { root: null, event: null },
  };

  private sessionFolder: DriveSessionFolder | null = null;

  private inflight = 0;
  private waiters: (() => void)[] = [];

  private cachedEventName = '';

  constructor(private deps: DriveClientDeps) {
    this.maybeWireOnlineSync();
  }

  // ─── Auth ────────────────────────────────────────────────────────────────

  /**
   * Returns a valid access token, requesting one via the GIS popup if we
   * don't have one yet. Throws if the user dismisses the popup or no
   * client ID is configured.
   */
  async getToken(opts: { forcePrompt?: boolean } = {}): Promise<string> {
    if (this.accessToken && !opts.forcePrompt) return this.accessToken;
    const clientId = this.deps.getClientId();
    if (!clientId || clientId.startsWith('YOUR_CLIENT')) {
      throw new Error('No Google Drive Client ID configured.');
    }
    const gis = this.requireGoogle();
    const token = await new Promise<string>((resolve, reject) => {
      const tokenClient = gis.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            reject(new Error(resp.error || 'No access token returned'));
            return;
          }
          resolve(resp.access_token);
        },
      });
      tokenClient.requestAccessToken({ prompt: opts.forcePrompt ? 'consent' : '' });
    });
    this.accessToken = token;
    // Folder caches were keyed to the previous identity; clear them.
    this.folderCache = {
      'photo-booth': { root: null, event: null },
      'video-guestbook': { root: null, event: null },
    };
    return token;
  }

  /** Revokes the current token (best-effort) and clears all caches. */
  signOut(): void {
    if (this.accessToken) {
      try {
        this.requireGoogle().revoke(this.accessToken, () => {});
      } catch {
        // GIS may not be loaded; safe to ignore.
      }
    }
    this.accessToken = null;
    this.sessionFolder = null;
    this.folderCache = {
      'photo-booth': { root: null, event: null },
      'video-guestbook': { root: null, event: null },
    };
  }

  isSignedIn(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Reset folder caches when the admin renames a root folder or the event.
   * Called by config setters in the host code.
   */
  invalidateFolders(role?: DriveFolderRole): void {
    if (role) {
      this.folderCache[role] = { root: null, event: null };
    } else {
      this.folderCache = {
        'photo-booth': { root: null, event: null },
        'video-guestbook': { root: null, event: null },
      };
    }
    this.sessionFolder = null;
  }

  // ─── Folder hierarchy ────────────────────────────────────────────────────

  private async ensureRoot(role: DriveFolderRole, token: string): Promise<string> {
    const cached = this.folderCache[role].root;
    if (cached) return cached;
    const folderName =
      role === 'photo-booth' ? this.deps.getPbFolderName() : this.deps.getVgFolderName();
    const id = await this.findOrCreateFolder(token, folderName, undefined);
    this.folderCache[role].root = id;
    return id;
  }

  private async ensureEvent(role: DriveFolderRole, token: string): Promise<string> {
    // If the event name changed, invalidate the cached event-folder IDs.
    const eventName = (this.deps.getEventName() || '').trim() || 'Default Event';
    if (eventName !== this.cachedEventName) {
      this.cachedEventName = eventName;
      this.folderCache['photo-booth'].event = null;
      this.folderCache['video-guestbook'].event = null;
    }
    const cached = this.folderCache[role].event;
    if (cached) return cached;
    const parentId = await this.ensureRoot(role, token);
    const id = await this.findOrCreateFolder(token, eventName, parentId);
    this.folderCache[role].event = id;
    return id;
  }

  /**
   * Returns the session folder, creating it under the given role's event
   * folder on first call. Subsequent calls — even with a different role —
   * reuse the same folder, matching legacy behaviour where a guest's
   * photos and videos always land together.
   */
  async ensureSessionFolder(role: DriveFolderRole): Promise<DriveSessionFolder> {
    if (this.sessionFolder) return this.sessionFolder;
    const token = await this.getToken();
    const sessionId = this.deps.getSessionId() ?? this.deps.ensureSessionId();
    const eventFolderId = await this.ensureEvent(role, token);
    const created = await this.driveFetch(`${FILES_API}?fields=id,webViewLink`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: sessionId,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [eventFolderId],
      }),
    });
    const folder = (await created.json()) as DriveSessionFolder;
    await this.setPublic(token, folder.id);
    this.sessionFolder = folder;
    this.deps.setSessionFolderLink(folder.id, folder.webViewLink);
    console.info('[Drive] Session folder created', { sessionId, role, link: folder.webViewLink });
    return folder;
  }

  /** Reset the cached session folder so the next upload creates a new one. */
  resetSession(): void {
    this.sessionFolder = null;
  }

  // ─── Permissions ─────────────────────────────────────────────────────────

  async setPublic(token: string, fileId: string): Promise<void> {
    try {
      await this.driveFetch(`${FILES_API}/${fileId}/permissions`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });
    } catch (e) {
      console.warn('[Drive] setPublic failed', e);
    }
  }

  // ─── Upload ──────────────────────────────────────────────────────────────

  /**
   * Upload a Blob. On transient failure (5xx, 429, network error) the
   * upload is queued in IndexedDB and retried later. Returns the Drive
   * file metadata on success.
   *
   * The caller is responsible for revoking any object URLs derived from
   * the blob after this resolves.
   */
  async upload(role: DriveFolderRole, blob: Blob, filename: string): Promise<DriveUploadResult> {
    await this.acquireSlot();
    try {
      const folder = await this.ensureSessionFolder(role);
      return await this.uploadOnce(role, blob, filename, folder.id);
    } catch (err) {
      // Persist for later retry. The caller still gets the error so it can
      // surface a "saved offline, will retry" message in the UI.
      const queued = await enqueue({
        id: cryptoRandomId(),
        role,
        filename,
        blob,
        parentFolderId: this.sessionFolder?.id ?? null,
      });
      console.warn('[Drive] Upload queued for retry', { id: queued.id, error: errMsg(err) });
      throw err;
    } finally {
      this.releaseSlot();
    }
  }

  private async uploadOnce(
    role: DriveFolderRole,
    blob: Blob,
    filename: string,
    parentFolderId: string,
  ): Promise<DriveUploadResult> {
    const meta = JSON.stringify({ name: filename, parents: [parentFolderId] });
    return this.withRetry(async () => {
      const token = await this.getToken();
      const form = new FormData();
      form.append('metadata', new Blob([meta], { type: 'application/json' }));
      form.append('file', blob, filename);
      const resp = await fetch(`${UPLOAD_API}?uploadType=multipart&fields=id,name,webViewLink`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (resp.status === 401) {
        // Force a fresh token and let the retry loop try again.
        this.accessToken = null;
        throw new RetryableError(`Auth expired (${role})`);
      }
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}) as { error?: { message?: string } });
        const msg = body.error?.message || `Drive upload failed (${resp.status})`;
        if (resp.status >= 500 || resp.status === 429) throw new RetryableError(msg);
        throw new Error(msg);
      }
      return (await resp.json()) as DriveUploadResult;
    });
  }

  // ─── Offline queue sync ──────────────────────────────────────────────────

  async pendingUploadCount(): Promise<number> {
    return pendingCount();
  }

  /** Try to flush the queue; resolves when all pending items have terminated. */
  async flushQueue(): Promise<{ uploaded: number; failed: number }> {
    if (!navigator.onLine) return { uploaded: 0, failed: 0 };
    const pending = await listPending();
    let uploaded = 0;
    let failed = 0;
    for (const item of pending) {
      if (item.status === 'in-flight') continue;
      const result = await this.flushOne(item);
      if (result === 'ok') uploaded++;
      else failed++;
    }
    return { uploaded, failed };
  }

  private async flushOne(item: PendingUpload): Promise<'ok' | 'fail'> {
    await markInFlight(item.id);
    try {
      const folder = item.parentFolderId
        ? { id: item.parentFolderId, webViewLink: '' }
        : await this.ensureSessionFolder(item.role);
      await this.uploadOnce(item.role, item.blob, item.filename, folder.id);
      await removeFromQueue(item.id);
      console.info('[Drive] Flushed queued upload', { id: item.id, file: item.filename });
      return 'ok';
    } catch (err) {
      await markFailed(item.id, errMsg(err));
      console.warn('[Drive] Queued upload still failing', { id: item.id, error: errMsg(err) });
      return 'fail';
    }
  }

  private maybeWireOnlineSync(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('online', () => {
      void this.flushQueue();
    });
  }

  // ─── Internal: HTTP, retry, concurrency ──────────────────────────────────

  private async findOrCreateFolder(
    token: string,
    name: string,
    parentId: string | undefined,
  ): Promise<string> {
    const escaped = name.replace(/'/g, "\\'");
    const parentClause = parentId ? ` and '${parentId}' in parents` : '';
    const q = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${escaped}'${parentClause} and trashed=false`,
    );
    const search = await this.driveFetch(`${FILES_API}?q=${q}&fields=files(id,name)`, token);
    const data = (await search.json()) as { files?: DriveFile[] };
    if (data.files && data.files.length > 0 && data.files[0]) return data.files[0].id;
    const create = await this.driveFetch(FILES_API, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    });
    const folder = (await create.json()) as DriveFile;
    return folder.id;
  }

  private async driveFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const resp = await fetch(url, { ...init, headers });
    if (!resp.ok && resp.status !== 401) {
      const body = await resp
        .clone()
        .json()
        .catch(() => ({}) as { error?: { message?: string } });
      const msg = body.error?.message || `Drive API ${resp.status}`;
      if (resp.status >= 500 || resp.status === 429) throw new RetryableError(msg);
      throw new Error(msg);
    }
    return resp;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!(err instanceof RetryableError) && !isNetworkError(err)) throw err;
        if (attempt === MAX_RETRIES) break;
        const jitter = Math.random() * 250;
        const delay = BASE_BACKOFF_MS * 2 ** attempt + jitter;
        console.info(`[Drive] Retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms`);
        await sleep(delay);
      }
    }
    throw lastErr;
  }

  private async acquireSlot(): Promise<void> {
    if (this.inflight < MAX_CONCURRENT_UPLOADS) {
      this.inflight++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.inflight++;
  }

  private releaseSlot(): void {
    this.inflight--;
    const next = this.waiters.shift();
    if (next) next();
  }

  private requireGoogle(): GoogleOauthClient {
    const g = (window as unknown as { google?: { accounts?: { oauth2?: GoogleOauthClient } } })
      .google;
    const oauth2 = g?.accounts?.oauth2;
    if (!oauth2) {
      throw new Error('Google Identity Services not loaded — check network.');
    }
    return oauth2;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /fetch|network/i.test(err.message);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
