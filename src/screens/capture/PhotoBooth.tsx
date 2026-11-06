// The photo booth screen: the live camera, splash, countdown, flash, shot
// counter, then the finished strip with "Looking great!".

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useSetting } from '../../ui/useSettings';
import { HIDE } from './hide';
import { computeLayout } from './kiosk';
import { type PhotoUi, registerFeed } from './store';

/** Size the viewfinder to the layout's slot shape, so it shows exactly what's captured. */
function useViewfinderSize(shown: boolean): { width: number; height: number } | undefined {
  const layout = useSetting('layout');
  const [size, setSize] = useState<{ width: number; height: number }>();
  useEffect(() => {
    if (!shown) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fit = (): void => {
      const slot = computeLayout(layout).photoSlots[0];
      if (!slot) return;
      const ar = slot.w / slot.h;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Wider than the slot: fit by height; taller: fit by width.
      setSize(
        vw / vh > ar
          ? { width: Math.round(vh * ar), height: vh }
          : { width: vw, height: Math.round(vw / ar) },
      );
    };
    // Re-fit when the screen rotates or the window resizes.
    const onResize = (): void => {
      clearTimeout(timer);
      timer = setTimeout(fit, 150);
    };
    fit();
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [shown, layout]);
  return size;
}

function Countdown({ n, active }: { n: number; active: boolean }) {
  // Mount without .active, then add it, so the number scales and fades in.
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div id="countdown-overlay" className={on && active ? 'active' : undefined}>
      {n}
    </div>
  );
}

function Strip({ strip }: { strip: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = strip.width;
    canvas.height = strip.height;
    canvas.getContext('2d')?.drawImage(strip, 0, 0);
  }, [strip]);
  return <canvas id="photo-canvas" ref={ref} />;
}

export function PhotoBooth({ shown, ui }: { shown: boolean; ui: PhotoUi }) {
  const size = useViewfinderSize(shown);
  return (
    <div id="live-booth" className="booth-container" style={shown ? undefined : HIDE}>
      <div className="viewfinder" style={size}>
        <video
          id="camera-feed"
          ref={(el) => registerFeed('photo', el)}
          autoPlay
          playsInline
          muted
          style={ui.strip ? HIDE : undefined}
        />
        {ui.strip && <Strip strip={ui.strip} />}

        {ui.countdown && (
          <Countdown key={ui.countdown.key} n={ui.countdown.n} active={ui.countdown.active} />
        )}
        <div
          id="flash-overlay"
          key={ui.flashKey}
          className={ui.flashKey ? 'is-firing' : undefined}
        />

        {ui.shot && (
          <output id="pb-shot-counter" aria-live="polite">
            Photo {ui.shot.n} of {ui.shot.of}
          </output>
        )}

        {ui.reviewBadge && (
          <output id="pb-review-badge">
            <i className="fa-solid fa-check" />
            <span>Looking great!</span>
          </output>
        )}

        {ui.splash && (
          <div id="pb-splash" className={ui.splash.leaving ? 'splash-fade-out' : undefined}>
            <div className="pb-splash-icon" aria-hidden="true">
              <i className="fa-solid fa-camera-retro" />
            </div>
            <p className="pb-splash-heading">Show Your Best Pose!</p>
            <p className="pb-splash-sub" id="pb-splash-sub">
              {ui.splash.count === 1 ? (
                <>
                  You've got <strong>1 shot</strong>. Strike your best pose and have fun!
                </>
              ) : (
                <>
                  You'll take <strong>{ui.splash.count} photos</strong>. Warm up, get creative, and
                  show us your best side!
                </>
              )}
            </p>
            <div className="pb-splash-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {ui.saving && (
          <output id="processing-overlay">
            <div className="spinner" aria-hidden="true" />
            <h2>Saving your photos…</h2>
          </output>
        )}
      </div>
    </div>
  );
}
