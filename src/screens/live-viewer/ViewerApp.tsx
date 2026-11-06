// The live viewer: the phone page hosts open from the QR code on the kiosk.
// It shows each photo and video as guests make them.
//
// Element ids and classes match the pre-React markup so the Phase 3i styles
// in src/styles/live-viewer.css apply unchanged.

import { useCallback, useState } from 'react';

import { ViewerCard } from './ViewerCard';
import { type LightboxContent, ViewerLightbox } from './ViewerLightbox';
import type { GalleryItem } from './gallery-store';
import { CameraIcon } from './icons';
import { useHostConnection } from './useHostConnection';
import { useWakeLock } from './useWakeLock';

const STATUS_TEXT = {
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
} as const;

export function ViewerApp({ hostId }: { hostId: string }) {
  const { state, subtitle, items } = useHostConnection(hostId);
  const [lightbox, setLightbox] = useState<LightboxContent | null>(null);
  useWakeLock();

  // Photo → lightbox. Video with a Drive link → play it on Drive.
  // Video without one → lightbox explaining it's still on the kiosk.
  const open = useCallback((item: GalleryItem) => {
    if (item.type === 'photo') {
      if (item.data) setLightbox({ kind: 'photo', src: item.data });
    } else if (item.driveUrl) {
      window.open(item.driveUrl, '_blank', 'noopener');
    } else {
      setLightbox({ kind: 'video-note', thumb: item.data });
    }
  }, []);
  const showQr = useCallback((driveUrl: string) => setLightbox({ kind: 'qr', driveUrl }), []);
  const close = useCallback(() => setLightbox(null), []);

  return (
    <>
      <div id="viewer-header">
        <div className="viewer-heading">
          <h2>Live Gallery</h2>
          <p id="viewer-event-name">{subtitle}</p>
        </div>
        <output className="viewer-status">
          <div
            className="lv-status-dot"
            id="viewer-status-dot"
            data-state={state}
            aria-hidden="true"
          />
          <span id="viewer-status-text">{STATUS_TEXT[state]}</span>
        </output>
      </div>
      <div id="viewer-gallery">
        {items.map((item) => (
          <ViewerCard key={item.key} item={item} onOpen={open} onShowQr={showQr} />
        ))}
      </div>
      {items.length === 0 && (
        <div id="viewer-empty">
          <div className="viewer-empty-icon" aria-hidden="true">
            <CameraIcon size={28} strokeWidth={1.75} />
          </div>
          <p className="viewer-empty-title">No captures yet</p>
          <p className="viewer-empty-sub">
            Photos and videos will appear here as guests take them.
          </p>
        </div>
      )}
      {lightbox && <ViewerLightbox content={lightbox} onClose={close} />}
    </>
  );
}
