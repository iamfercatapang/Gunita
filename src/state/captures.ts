// The captures made this session, newest first, for the dashboard gallery
// and the kiosk's Recent Captures. Files are already saved to the device or
// Drive; this list is only for previews and lives in memory.
//
// app.js adds captures through window.PB.captures; React screens read them
// with useCaptures(). This module doesn't import React, so app.js can add
// captures before the React chunk has loaded.

export type CaptureType = 'photo' | 'video';

export interface Capture {
  id: number;
  type: CaptureType;
  /** Photo dataURL, or a blob: URL for a video. */
  src: string;
  /** Drive folder link, once the upload has finished. */
  driveUrl: string | null;
}

export interface CapturesSnapshot {
  photos: readonly Capture[];
  videos: readonly Capture[];
}

// Cap the in-memory gallery so a long event doesn't run the kiosk out of RAM.
const MAX = { photo: 30, video: 10 } as const;

let snapshot: CapturesSnapshot = { photos: [], videos: [] };
let nextId = 1;
const listeners = new Set<() => void>();

function commit(next: CapturesSnapshot): void {
  snapshot = next;
  for (const l of listeners) l();
}

function listKey(type: CaptureType): 'photos' | 'videos' {
  return type === 'photo' ? 'photos' : 'videos';
}

/** Add a capture to the front of its list. Returns its id for setDriveUrl. */
export function addCapture(type: CaptureType, src: string): number {
  const id = nextId++;
  const key = listKey(type);
  const list = [{ id, type, src, driveUrl: null }, ...snapshot[key]];
  for (const old of list.splice(MAX[type])) {
    // Videos hold a blob in memory until their URL is revoked.
    if (old.src.startsWith('blob:')) URL.revokeObjectURL(old.src);
  }
  commit({ ...snapshot, [key]: list });
  return id;
}

/**
 * Record the Drive link for a capture once its upload finishes. Looked up by
 * id, so a slow upload still lands on the right capture after newer ones.
 */
export function setDriveUrl(id: number, driveUrl: string): void {
  const update = (list: readonly Capture[]): readonly Capture[] =>
    list.some((c) => c.id === id) ? list.map((c) => (c.id === id ? { ...c, driveUrl } : c)) : list;
  commit({ photos: update(snapshot.photos), videos: update(snapshot.videos) });
}

export function captureCount(): number {
  return snapshot.photos.length + snapshot.videos.length;
}

export function getCaptures(): CapturesSnapshot {
  return snapshot;
}

export function subscribeCaptures(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
