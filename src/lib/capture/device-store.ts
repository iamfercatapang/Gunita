// On-device capture store for iPad / iPhone.
//
// Safari on iOS and iPadOS has no folder picker (File System Access API), and
// its download fallback can ask "Do you want to download…?" after every
// capture, in front of guests. So on those devices captures are written into
// the app's own storage (IndexedDB) instead: no prompts, works offline. The
// operator exports them later from the admin panel through the iOS share
// sheet (Save to Files / Save to Photos) and then clears what was exported.
//
// Every other browser keeps the existing behaviour (folder or download); see
// shouldUseDeviceStore().

import { type IDBPDatabase, openDB } from 'idb';

const DB_NAME = 'gunita-device-saves';
const DB_VERSION = 1;
const STORE = 'captures';

/** Files offered to the share sheet at once; big batches of video can stall it. */
export const EXPORT_BATCH_SIZE = 20;

export interface DeviceCapture {
  id: string;
  filename: string;
  sessionId: string | null;
  type: string;
  size: number;
  blob: Blob;
  createdAt: number;
  /** Set once the operator has shared this file out of the app. */
  exportedAt: number | null;
}

export interface DeviceStoreSummary {
  total: number;
  pending: number;
  exported: number;
  bytes: number;
  pendingBytes: number;
  /** Free space the browser reports for this app, when it reports it. */
  freeBytes: number | null;
  persisted: boolean | null;
}

export type ExportResult =
  | { status: 'shared'; count: number; remaining: number }
  | { status: 'downloaded'; count: number; remaining: number }
  | { status: 'cancelled' }
  | { status: 'empty' };

let _dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          const store = database.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }
  return _dbPromise;
}

/** iPhone, or an iPad (which reports itself as a Mac with a touch screen). */
export function isAppleTouchDevice(): boolean {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * True when captures should go to on-device storage instead of downloads:
 * Apple touch devices without a folder picker. Android and desktop browsers
 * keep downloading as before.
 */
export function shouldUseDeviceStore(): boolean {
  return isAppleTouchDevice() && !('showDirectoryPicker' in window);
}

/**
 * Ask the browser to keep this app's storage instead of clearing it under
 * storage pressure. Granted readily to apps added to the Home Screen.
 */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveToDevice(
  blob: Blob,
  filename: string,
  sessionId: string | null,
): Promise<void> {
  const record: DeviceCapture = {
    id: newId(),
    filename,
    sessionId,
    type: blob.type || guessType(filename),
    size: blob.size,
    blob,
    createdAt: Date.now(),
    exportedAt: null,
  };
  await (await db()).put(STORE, record);
  // Fire-and-forget: storage that is not persisted can be evicted.
  void requestPersistence();
}

export async function listCaptures(): Promise<DeviceCapture[]> {
  const all = (await (await db()).getAll(STORE)) as DeviceCapture[];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function summary(): Promise<DeviceStoreSummary> {
  const all = await listCaptures();
  const pending = all.filter((c) => !c.exportedAt);
  let freeBytes: number | null = null;
  let persisted: boolean | null = null;
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota != null && est.usage != null) freeBytes = Math.max(0, est.quota - est.usage);
    persisted = (await navigator.storage?.persisted?.()) ?? null;
  } catch {
    // Not reported by this browser.
  }
  return {
    total: all.length,
    pending: pending.length,
    exported: all.length - pending.length,
    bytes: all.reduce((n, c) => n + c.size, 0),
    pendingBytes: pending.reduce((n, c) => n + c.size, 0),
    freeBytes,
    persisted,
  };
}

/**
 * The next batch of files not yet exported, oldest first, as File objects.
 * Load this before the operator taps Export: iOS only opens the share sheet
 * when navigator.share() is called straight from the tap, so there must be no
 * database read between the tap and the call.
 */
export async function nextExportBatch(): Promise<{ ids: string[]; files: File[] }> {
  const pending = (await listCaptures()).filter((c) => !c.exportedAt).slice(0, EXPORT_BATCH_SIZE);
  return {
    ids: pending.map((c) => c.id),
    files: pending.map((c) => new File([c.blob], c.filename, { type: c.type })),
  };
}

/**
 * Hand a prepared batch to the share sheet (Save to Files / Save to Photos),
 * or download the files one by one where sharing files is not supported.
 * Marks the batch exported only when the share or downloads went through.
 */
export async function exportBatch(batch: { ids: string[]; files: File[] }): Promise<ExportResult> {
  if (batch.files.length === 0) return { status: 'empty' };

  const canShareFiles =
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: batch.files });

  let status: 'shared' | 'downloaded';
  if (canShareFiles) {
    try {
      await navigator.share({ files: batch.files });
      status = 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return { status: 'cancelled' };
      throw e;
    }
  } else {
    for (const file of batch.files) triggerDownload(file);
    status = 'downloaded';
  }

  await markExported(batch.ids);
  const remaining = (await listCaptures()).filter((c) => !c.exportedAt).length;
  return { status, count: batch.files.length, remaining };
}

async function markExported(ids: string[]): Promise<void> {
  const database = await db();
  const tx = database.transaction(STORE, 'readwrite');
  const now = Date.now();
  for (const id of ids) {
    const rec = (await tx.store.get(id)) as DeviceCapture | undefined;
    if (rec) await tx.store.put({ ...rec, exportedAt: now });
  }
  await tx.done;
}

/** Delete only files that have already been exported. Returns how many. */
export async function clearExported(): Promise<number> {
  const database = await db();
  const tx = database.transaction(STORE, 'readwrite');
  let removed = 0;
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if ((cursor.value as DeviceCapture).exportedAt) {
      await cursor.delete();
      removed++;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return removed;
}

function triggerDownload(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function guessType(filename: string): string {
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  if (filename.endsWith('.mp4')) return 'video/mp4';
  if (filename.endsWith('.webm')) return 'video/webm';
  return 'application/octet-stream';
}
