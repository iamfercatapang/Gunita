// After a video message: "Loved that? Take a photo too." The guest has 15
// seconds to say yes; otherwise it counts as no.

import { useEffect, useRef } from 'react';

import { RingTimer, useCountdown } from './Countdown';

const OFFER_SECS = 15;

interface Props {
  /** The guest's last video frame, shown blurred behind the offer. */
  backdrop: HTMLCanvasElement | null;
  onDone: (accepted: boolean) => void;
}

export function PhotoBoothOffer({ backdrop, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const remaining = useCountdown(OFFER_SECS, true, () => onDone(false));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !backdrop) return;
    canvas.width = backdrop.width;
    canvas.height = backdrop.height;
    canvas.getContext('2d')?.drawImage(backdrop, 0, 0);
  }, [backdrop]);

  return (
    <div
      id="vg-pb-offer"
      // Not <dialog>: the overlay div is the backdrop, and showModal()'s own
      // backdrop and top layer aren't what the existing CSS expects.
      // biome-ignore lint/a11y/useSemanticElements: see above
      role="dialog"
      aria-modal="true"
      aria-labelledby="vg-pbo-title"
    >
      <canvas ref={canvasRef} id="vg-pbo-bg-canvas" className="vg-pbo-bg-canvas" />
      <div className="vg-pbo-vignette" />
      <div className="vg-pbo-content">
        <h2 id="vg-pbo-title" className="vg-pbo-title">
          Loved that?
          <br />
          <span className="vg-pbo-title-em">Take a photo too.</span>
        </h2>
        <p className="vg-pbo-subtitle">Strike a quick pose &mdash; takes about 10 seconds.</p>
        <div className="vg-pbo-buttons">
          <button
            type="button"
            id="btn-vg-pbo-yes"
            className="vg-pbo-btn vg-pbo-btn-yes"
            onClick={() => onDone(true)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>Sure, let's go</span>
          </button>
          <button
            type="button"
            id="btn-vg-pbo-no"
            className="vg-pbo-btn vg-pbo-btn-no"
            onClick={() => onDone(false)}
          >
            <span>No thanks</span>
            <RingTimer total={OFFER_SECS} remaining={remaining} />
          </button>
        </div>
      </div>
    </div>
  );
}
