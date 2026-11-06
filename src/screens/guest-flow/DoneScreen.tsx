// The screen after a guest finishes. Two phases:
//   1. QR (only when Drive is on): "Want a copy?" with a QR code for the
//      session's Drive folder. No countdown, so nobody scans against a clock.
//      Ends when the guest taps All done, or after 90 s if they walk away.
//   2. Thank you: All done with a draining ring; returns to welcome when it
//      runs out or the guest taps.

import { useCallback, useEffect, useRef, useState } from 'react';

import { renderQr } from '../../lib/qr';
import { RingTimer, useCountdown } from './Countdown';

const QR_SAFETY_MS = 90_000;
const LINK_POLL_MS = 500;
const LINK_MAX_WAIT_MS = 30_000;
const CARD_FADE_MS = 250;

export interface DoneScreenOptions {
  /** Show the Drive QR phase first. */
  showQr: boolean;
  /** Length of the thank-you countdown, in seconds. */
  thankYouSecs: number;
  /** Background image URL, if the host set one. */
  backgroundUrl: string | null;
  /** The session's Drive folder link; null until the upload has created it. */
  getDriveLink: () => string | null;
}

type Phase = 'qr' | 'qr-leaving' | 'thanks';

export function DoneScreen({ opts, onDone }: { opts: DoneScreenOptions; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>(opts.showQr ? 'qr' : 'thanks');
  const total = Math.max(2, opts.thankYouSecs || 5);
  const remaining = useCountdown(total, phase === 'thanks', onDone);

  const endQrPhase = useCallback(() => {
    setPhase((p) => (p === 'qr' ? 'qr-leaving' : p));
  }, []);

  // Phase 1 ends after a safety timeout; the card then fades out.
  useEffect(() => {
    if (phase === 'qr') {
      const t = setTimeout(endQrPhase, QR_SAFETY_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'qr-leaving') {
      const t = setTimeout(() => setPhase('thanks'), CARD_FADE_MS + 10);
      return () => clearTimeout(t);
    }
  }, [phase, endQrPhase]);

  return (
    <div id="vg-done-screen" className={opts.backgroundUrl ? 'has-bg-image' : undefined}>
      <img
        id="vg-done-bg-img"
        className="vg-done-bg-img"
        src={opts.backgroundUrl ?? undefined}
        alt=""
      />
      <div className="vg-done-content">
        {phase !== 'thanks' && (
          <QrCard getDriveLink={opts.getDriveLink} leaving={phase === 'qr-leaving'} />
        )}
        <button
          type="button"
          id="btn-vg-done"
          className="vg-done-btn"
          onClick={phase === 'thanks' ? onDone : endQrPhase}
        >
          <span>All done</span>
          {phase === 'thanks' && <RingTimer total={total} remaining={remaining} />}
        </button>
      </div>
    </div>
  );
}

type LinkState = { kind: 'waiting' } | { kind: 'ready'; link: string } | { kind: 'timed-out' };

function QrCard({
  getDriveLink,
  leaving,
}: { getDriveLink: () => string | null; leaving: boolean }) {
  const [state, setState] = useState<LinkState>({ kind: 'waiting' });
  const qrRef = useRef<HTMLDivElement>(null);
  const [qrFailed, setQrFailed] = useState(false);

  // The Drive folder is created by the upload, which may still be running.
  useEffect(() => {
    let elapsed = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = (): void => {
      const link = getDriveLink();
      elapsed += LINK_POLL_MS;
      if (link) {
        setState({ kind: 'ready', link });
      } else if (elapsed >= LINK_MAX_WAIT_MS) {
        setState({ kind: 'timed-out' });
      } else {
        timer = setTimeout(poll, LINK_POLL_MS);
      }
    };
    poll();
    return () => clearTimeout(timer);
  }, [getDriveLink]);

  useEffect(() => {
    if (state.kind !== 'ready' || !qrRef.current) return;
    try {
      renderQr(qrRef.current, state.link, { size: 178, dark: '#0b0b0f', light: '#ffffff' });
    } catch (e) {
      console.warn('[QR] Drive QR generation failed:', e);
      setQrFailed(true);
    }
  }, [state]);

  const ready = state.kind !== 'waiting';
  return (
    <div
      className={`vg-done-qr-card${ready ? ' is-ready' : ''}`}
      id="vg-done-qr-card"
      style={leaving ? { opacity: 0, transition: `opacity ${CARD_FADE_MS}ms ease-out` } : undefined}
    >
      <div className="vg-done-qr-heading-row">
        <span className="vg-done-qr-badge" aria-hidden="true" />
        <p className="vg-done-qr-heading">Want a copy?</p>
      </div>
      <div className="vg-done-qr-body">
        <div className="vg-done-qr-target">
          <div className="vg-done-qr-spinner" id="vg-done-qr-spinner">
            <div className="vg-dqr-spinner-ring" />
          </div>
          <div className="vg-done-qr-image" id="vg-done-qr-image">
            {state.kind === 'ready' && !qrFailed && <div ref={qrRef} />}
            {state.kind === 'ready' && qrFailed && (
              <div className="vg-done-qr-note">Could not generate QR code.</div>
            )}
            {state.kind === 'timed-out' && (
              <div className="vg-done-qr-note">
                Upload in progress.
                <br />
                See the operator for your link.
              </div>
            )}
          </div>
        </div>
        <div className="vg-done-qr-copy">
          <p className="vg-done-qr-label">
            Scan to open your session
            <br />
            on Google Drive
          </p>
          <p className="vg-done-qr-link" id="vg-done-qr-link">
            {state.kind === 'ready' ? state.link : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
