// The thin draining ring with seconds left, used on "No thanks" in the
// photo booth offer and on "All done" on the done screen.

import { useEffect, useRef, useState } from 'react';

/**
 * Seconds left of a `total`-second countdown that starts when `running`
 * turns true. Calls `onDone` once when it reaches zero.
 */
export function useCountdown(total: number, running: boolean, onDone: () => void): number {
  const [remaining, setRemaining] = useState(total);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!running) return;
    setRemaining(total);
    let left = total;
    const id = setInterval(() => {
      left -= 1;
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        clearInterval(id);
        done.current();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [total, running]);

  return remaining;
}

export function RingTimer({ total, remaining }: { total: number; remaining: number }) {
  // pathLength=100, so the offset is the percentage drained.
  const drained = ((total - remaining) / total) * 100;
  return (
    <span className="vg-pbo-no-timer">
      <svg className="vg-pbo-ring" viewBox="0 0 36 36" aria-hidden="true">
        <circle className="vg-pbo-ring-track" cx="18" cy="18" r="16" fill="none" />
        <circle
          className="vg-pbo-ring-progress"
          cx="18"
          cy="18"
          r="16"
          fill="none"
          pathLength={100}
          style={{ strokeDashoffset: drained, transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="vg-pbo-secs" aria-label={`${remaining} seconds left`}>
        {remaining}
      </span>
    </span>
  );
}
