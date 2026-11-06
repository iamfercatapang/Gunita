// Connects to the kiosk's PeerJS id and turns its messages into gallery
// state. Reconnects on its own when the link drops.

import { type DataConnection, Peer } from 'peerjs';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LiveViewerMsg } from '../../lib/live-viewer/protocol';
import { type GalleryItem, loadItems, storeDriveUrl, storeItem, storeKey } from './gallery-store';

const RECONNECT_MS = 3000;
const PEER_ERROR_RECONNECT_MS = 4000;

export type ConnectionState = 'connecting' | 'live' | 'reconnecting';

export interface HostConnection {
  state: ConnectionState;
  /** Line under the heading: a status note, then the event name once the host says hello. */
  subtitle: string;
  /** Newest first. */
  items: GalleryItem[];
}

let keyCounter = 0;
const nextKey = (): string => `live-${++keyCounter}`;

export function useHostConnection(hostId: string): HostConnection {
  const key = storeKey(hostId);
  const [state, setState] = useState<ConnectionState>('connecting');
  const [subtitle, setSubtitle] = useState('Waiting for the first capture…');
  const [items, setItems] = useState<GalleryItem[]>(() => loadItems(key));
  const seenIds = useRef(new Set<string>());

  const handleMessage = useCallback(
    (raw: unknown) => {
      let msg: LiveViewerMsg;
      try {
        msg = JSON.parse(String(raw)) as LiveViewerMsg;
      } catch {
        return;
      }
      // The host replays messages across reconnects; show each one once.
      if (msg._id) {
        if (seenIds.current.has(msg._id)) return;
        seenIds.current.add(msg._id);
      }
      switch (msg.type) {
        case 'hello':
          if (msg.eventName) setSubtitle(msg.eventName);
          break;
        case 'photo':
        case 'video': {
          const item: GalleryItem = {
            key: nextKey(),
            type: msg.type,
            data: msg.data,
            filename: msg.filename,
            ts: msg.ts,
            duration: msg.type === 'video' ? msg.duration : undefined,
            driveUrl: msg.driveUrl ?? null,
          };
          setItems((prev) => [item, ...prev]);
          storeItem(key, item);
          break;
        }
        case 'drive-update':
          if (!msg.driveUrl) break;
          setItems((prev) =>
            prev.map((i) => (i.filename === msg.filename ? { ...i, driveUrl: msg.driveUrl } : i)),
          );
          storeDriveUrl(key, msg.filename, msg.driveUrl);
          break;
      }
    },
    [key],
  );

  useEffect(() => {
    let disposed = false;
    let peer: Peer | null = null;
    let conn: DataConnection | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const teardown = (): void => {
      try {
        conn?.close();
        peer?.destroy();
      } catch {
        // already gone
      }
      conn = null;
      peer = null;
    };

    // A dropped link fires close, error and sometimes a peer error too.
    // Only the first one schedules a retry.
    const scheduleReconnect = (delay: number): void => {
      if (disposed || retryTimer) return;
      setState('reconnecting');
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, delay);
    };

    const connect = (): void => {
      teardown();
      if (disposed) return;
      const p = new Peer();
      peer = p;
      p.on('open', () => {
        if (disposed || peer !== p) return;
        const c = p.connect(hostId, { reliable: true });
        conn = c;
        c.on('open', () => {
          if (disposed) return;
          setState('live');
          setSubtitle('Connected — waiting for captures…');
        });
        c.on('data', handleMessage);
        c.on('close', () => scheduleReconnect(RECONNECT_MS));
        c.on('error', () => scheduleReconnect(RECONNECT_MS));
      });
      p.on('error', (err: Error & { type?: string }) => {
        console.warn('[Viewer] Peer error:', err.type);
        scheduleReconnect(PEER_ERROR_RECONNECT_MS);
      });
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      teardown();
    };
  }, [hostId, handleMessage]);

  return { state, subtitle, items };
}
