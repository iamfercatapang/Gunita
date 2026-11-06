// Full-screen photo/video viewer with prev/next, arrow keys and swipe.
// Two looks: the admin dashboard's (.lightbox-* in styles.css) and the
// kiosk's, inside Recent Captures (#rcm-lightbox in galleries.css).

import { type TouchEvent, useCallback, useEffect, useRef, useState } from 'react';

import type { Capture } from '../../state/captures';
import { useEscape } from './shared';

interface Props {
  items: readonly Capture[];
  startIndex: number;
  variant: 'admin' | 'kiosk';
  onClose: () => void;
}

const SWIPE_MIN_PX = 50;

export function Lightbox({ items, startIndex, variant, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // A capture can be evicted while open; stay on a valid one.
  const current = items[Math.min(index, items.length - 1)];
  const at = Math.min(index, items.length - 1);
  const hasPrev = at > 0;
  const hasNext = at < items.length - 1;
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(
    () => setIndex((i) => Math.min(items.length - 1, i + 1)),
    [items.length],
  );

  useEscape(onClose);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [prev, next]);

  // On the kiosk a video plays as soon as it's opened. play() rather than
  // the autoplay attribute: the tap that opened it lets play() use sound.
  const currentId = current?.id;
  useEffect(() => {
    if (variant === 'kiosk' && currentId !== undefined) videoRef.current?.play().catch(() => {});
  }, [variant, currentId]);

  const onTouchStart = (e: TouchEvent): void => {
    const t = e.touches[0];
    if (t) touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent): void => {
    const start = touchStart.current;
    const t = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) next();
    else prev();
  };

  if (!current) return null;
  const counter = `${at + 1} / ${items.length}`;
  // key={current.id} gives each capture a fresh element, so a playing video
  // stops when you move on or close.
  const media =
    current.type === 'photo' ? (
      <img
        key={current.id}
        id={variant === 'admin' ? 'lightbox-img' : 'rcm-lb-img'}
        src={current.src}
        alt=""
      />
    ) : (
      // biome-ignore lint/a11y/useMediaCaption: guest recordings have no captions
      <video
        key={current.id}
        ref={videoRef}
        id={variant === 'admin' ? 'lightbox-video' : 'rcm-lb-video'}
        src={current.src}
        controls
        playsInline
      />
    );

  if (variant === 'kiosk') {
    return (
      <div
        id="rcm-lightbox"
        // Not <dialog>: the overlay div is the backdrop, and showModal()'s own
        // backdrop and top layer aren't what the existing CSS expects.
        // biome-ignore lint/a11y/useSemanticElements: see above
        role="dialog"
        aria-modal="true"
        aria-label="Capture"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          id="btn-rcm-lb-close"
          aria-label="Close"
          ref={closeRef}
          onClick={onClose}
        >
          <i className="fa-solid fa-xmark" />
        </button>
        {hasPrev && (
          <button type="button" id="btn-rcm-lb-prev" aria-label="Previous" onClick={prev}>
            ‹
          </button>
        )}
        {hasNext && (
          <button type="button" id="btn-rcm-lb-next" aria-label="Next" onClick={next}>
            ›
          </button>
        )}
        {media}
        <p id="rcm-lb-counter">{counter}</p>
      </div>
    );
  }

  return (
    <div
      id="photo-lightbox"
      className="lightbox-overlay gallery-fade-in"
      data-theme="dark"
      // Not <dialog>: the overlay div is the backdrop, and showModal()'s own
      // backdrop and top layer aren't what the existing CSS expects.
      // biome-ignore lint/a11y/useSemanticElements: see above
      role="dialog"
      aria-modal="true"
      aria-label="Capture"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes for keyboard users */}
      <div id="photo-lightbox-backdrop" onClick={onClose} />
      <div className="lightbox-inner">
        <button
          type="button"
          className="lightbox-close"
          id="lightbox-close"
          aria-label="Close"
          ref={closeRef}
          onClick={onClose}
        >
          &times;
        </button>
        <button
          type="button"
          className="lightbox-nav lightbox-prev"
          id="lightbox-prev"
          aria-label="Previous"
          style={hasPrev ? undefined : { visibility: 'hidden' }}
          onClick={prev}
        >
          &#8249;
        </button>
        {media}
        <button
          type="button"
          className="lightbox-nav lightbox-next"
          id="lightbox-next"
          aria-label="Next"
          style={hasNext ? undefined : { visibility: 'hidden' }}
          onClick={next}
        >
          &#8250;
        </button>
        <div className="lightbox-counter" id="lightbox-counter">
          {counter}
        </div>
      </div>
    </div>
  );
}
