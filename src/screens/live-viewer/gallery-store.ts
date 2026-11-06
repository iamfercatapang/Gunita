// The viewer keeps its last few captures in sessionStorage so a refresh
// doesn't empty the gallery. One key per host peer id.

export interface GalleryItem {
  /** Local key for React; not sent over the wire. */
  key: string;
  type: 'photo' | 'video';
  /** Photo dataURL, or the video's first-frame thumbnail. Null if missing. */
  data: string | null;
  filename: string;
  /** ms epoch */
  ts: number;
  /** Video length in seconds. */
  duration?: number;
  /** Drive link, once the host's upload has finished. */
  driveUrl?: string | null;
}

/** How many captures survive a refresh. The gallery itself shows them all. */
export const STORE_MAX = 20;

export function storeKey(hostId: string): string {
  return `lv_gallery_${hostId}`;
}

export function loadItems(key: string): GalleryItem[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(key) || '[]') as Omit<GalleryItem, 'key'>[];
    return raw.map((item, i) => ({ ...item, key: `stored-${i}-${item.ts}` }));
  } catch {
    return [];
  }
}

/** Add one capture to the front of the stored list. */
export function storeItem(key: string, item: GalleryItem): void {
  try {
    const items = loadItems(key);
    items.unshift(item);
    if (items.length > STORE_MAX) items.length = STORE_MAX;
    write(key, items);
  } catch {
    // Quota exceeded: this capture just won't survive a refresh.
  }
}

export function storeDriveUrl(key: string, filename: string, driveUrl: string): void {
  try {
    const items = loadItems(key);
    const item = items.find((i) => i.filename === filename);
    if (!item) return;
    item.driveUrl = driveUrl;
    write(key, items);
  } catch {
    // ignore
  }
}

function write(key: string, items: GalleryItem[]): void {
  sessionStorage.setItem(key, JSON.stringify(items.map(({ key: _k, ...rest }) => rest)));
}
