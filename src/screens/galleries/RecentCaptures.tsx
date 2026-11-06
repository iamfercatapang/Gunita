// "Recent Captures" on the kiosk: guests can look back at what was made
// today, photos and videos together, newest first.

import { useCallback, useMemo, useState } from 'react';

import { Lightbox } from './Lightbox';
import { GridIcon, VideoThumb, useCaptures } from './shared';

export function RecentCaptures({ onClose }: { onClose: () => void }) {
  const { photos, videos } = useCaptures();
  const items = useMemo(() => [...photos, ...videos], [photos, videos]);
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);
  const closeLightbox = useCallback(() => setLightboxAt(null), []);

  return (
    <div
      id="recent-captures-modal"
      // Not <dialog>: the overlay div is the backdrop, and showModal()'s own
      // backdrop and top layer aren't what the existing CSS expects.
      // biome-ignore lint/a11y/useSemanticElements: see above
      role="dialog"
      aria-modal="true"
      aria-labelledby="rcm-title"
    >
      <div className="rcm-header">
        <h2 id="rcm-title">Recent Captures</h2>
        <button type="button" id="btn-close-rcm" onClick={onClose}>
          <i className="fa-solid fa-xmark" /> Close
        </button>
      </div>
      {items.length === 0 ? (
        <div id="rcm-empty">
          <GridIcon size={48} strokeWidth={1.5} />
          <p>No captures yet</p>
        </div>
      ) : (
        <div id="rcm-grid">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`rcm-card${item.type === 'video' ? ' rcm-card-video' : ''}`}
              aria-label={item.type === 'video' ? 'Play video' : 'View photo'}
              onClick={() => setLightboxAt(i)}
            >
              {item.type === 'video' ? (
                <VideoThumb src={item.src} />
              ) : (
                <img src={item.src} alt="" />
              )}
              <span className="rcm-badge" aria-hidden="true">
                <i
                  className={`fa-solid ${item.type === 'video' ? 'fa-clapperboard' : 'fa-camera'}`}
                />
              </span>
              {item.type === 'video' && (
                <span className="rcm-play-icon" aria-hidden="true">
                  <i className="fa-solid fa-play" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {lightboxAt !== null && (
        <Lightbox items={items} startIndex={lightboxAt} variant="kiosk" onClose={closeLightbox} />
      )}
    </div>
  );
}
