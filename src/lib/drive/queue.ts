// Persistent offline upload queue. Captures recorded while the network is
// down (or while the Drive endpoint is failing) are stashed in IndexedDB and
// flushed when connectivity returns.
//
// The queue stores the Blob itself, so survives a full page reload — the
// kiosk won't lose a guest's video if Wi-Fi drops mid-event.

import { type IDBPDatabase, openDB } from 'idb';

import type { DriveFolderRole } from './types';

const DB_NAME = 'photobooth-drive';
const DB_VERSION = 1;
const STORE = 'pending-uploads';

export type PendingUploadStatus = 'pending' | 'in-flight' | 'failed';

export interface PendingUpload {
  id: string;
  role: DriveFolderRole;
  filename: string;
  blob: Blob;
  /** Folder ID under which to upload; null means resolve at flush time. */
  parentFolderId: string | null;
  status: PendingUploadStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

let _dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          const store = database.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('status', 'status');
          store.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }
  return _dbPromise;
}

export async function enqueue(
  upload: Omit<PendingUpload, 'status' | 'attempts' | 'createdAt' | 'updatedAt'>,
): Promise<PendingUpload> {
  const now = Date.now();
  const record: PendingUpload = {
    ...upload,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  await (await db()).put(STORE, record);
  return record;
}

export async function listPending(): Promise<PendingUpload[]> {
  const all = await (await db()).getAll(STORE);
  // Oldest first so the queue is FIFO.
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function markInFlight(id: string): Promise<void> {
  await updateRecord(id, (r) => ({ ...r, status: 'in-flight', updatedAt: Date.now() }));
}

export async function markFailed(id: string, error: string): Promise<void> {
  await updateRecord(id, (r) => ({
    ...r,
    status: 'failed',
    attempts: r.attempts + 1,
    lastError: error,
    updatedAt: Date.now(),
  }));
}

export async function markPending(id: string): Promise<void> {
  await updateRecord(id, (r) => ({ ...r, status: 'pending', updatedAt: Date.now() }));
}

export async function remove(id: string): Promise<void> {
  await (await db()).delete(STORE, id);
}

export async function pendingCount(): Promise<number> {
  return (await db()).count(STORE);
}

async function updateRecord(
  id: string,
  mutate: (r: PendingUpload) => PendingUpload,
): Promise<void> {
  const conn = await db();
  const tx = conn.transaction(STORE, 'readwrite');
  const existing = (await tx.store.get(id)) as PendingUpload | undefined;
  if (!existing) {
    await tx.done;
    return;
  }
  await tx.store.put(mutate(existing));
  await tx.done;
}
