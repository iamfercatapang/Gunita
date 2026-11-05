import { saveToDevice, shouldUseDeviceStore } from './device-store';

// Local file save with three layered strategies, in priority order:
//
//   1. File System Access API — the operator has picked a destination folder
//      via the admin panel. We open (or create) a session sub-folder named
//      after the current session ID, then write the blob into it. This is the
//      preferred path on Chromium-based browsers.
//
//   2. On-device store — iPad / iPhone, where Safari has no folder picker and
//      downloads can prompt after every capture. The file goes into the app's
//      own storage and is exported later from the admin panel
//      (see device-store.ts).
//
//   3. Anchor-download — fallback for other browsers without FSA, or before
//      the operator has chosen a folder. Triggers the browser's standard
//      download flow; the user lands the file wherever their browser saves
//      downloads.
//
// All paths return a Promise so callers can `await` the actual write before
// surfacing success / failure UI.

export interface LocalSaveDeps {
  /** Operator-chosen save folder (or null until a folder has been picked). */
  directoryHandle: FileSystemDirectoryHandle | null;
  /** Current guest session — used as the sub-folder name when FSA is active. */
  sessionId: string | null;
}

/**
 * Build the standard photobooth filename: `<EventName>_YYYYMMDD_HHMMSS.<ext>`.
 * Falls back to `photobooth_` when no event name is configured. Event-name
 * non-filename characters are stripped to underscores; consecutive
 * underscores collapse and edge underscores are trimmed.
 */
export function makeFilename(eventName: string, ext = 'png'): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ts = `${yyyy}${MM}${dd}_${hh}${mm}${ss}`;
  const prefix = eventName
    ? eventName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
    : 'photobooth';
  return `${prefix}_${ts}.${ext}`;
}

/** Where a capture ended up. */
export type LocalSaveTarget = 'folder' | 'device' | 'download';

/**
 * Save a blob locally. Prefers the FSA session-folder path when a directory
 * handle is present, then the on-device store on iPad / iPhone, then a
 * browser download. Throws on FSA and device-store write errors (for example
 * when storage is full) so the caller can surface an error. Download failures
 * are silent (the browser shows its own UI).
 */
export async function saveBlobLocally(
  blob: Blob,
  filename: string,
  deps: LocalSaveDeps,
): Promise<LocalSaveTarget> {
  if (deps.directoryHandle) {
    const sessionDir = await deps.directoryHandle.getDirectoryHandle(deps.sessionId || 'session', {
      create: true,
    });
    const fileHandle = await sessionDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return 'folder';
  }
  if (shouldUseDeviceStore()) {
    await saveToDevice(blob, filename, deps.sessionId);
    return 'device';
  }
  downloadBlob(blob, filename);
  return 'download';
}

/**
 * Trigger a browser download for the given blob. Cleans up the object URL
 * 5 s later — enough time for the browser to have begun saving.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
