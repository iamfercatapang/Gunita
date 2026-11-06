import { useEffect, useRef } from 'react';

import { renderQr } from '../../lib/qr';
import { CloseIcon } from './icons';

export type LightboxContent =
  | { kind: 'photo'; src: string }
  /** A video with no Drive link yet: the recording only exists on the kiosk. */
  | { kind: 'video-note'; thumb: string | null }
  | { kind: 'qr'; driveUrl: string };

interface Props {
  content: LightboxContent;
  onClose: () => void;
}

export function ViewerLightbox({ content, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [onClose]);

  const img =
    content.kind === 'photo' ? content.src : content.kind === 'video-note' ? content.thumb : null;

  return (
    // A plain div rather than <dialog>: the viewer's CSS positions it inside
    // #viewer-mode, and showModal() would move it to the top layer.
    // Backdrop click closes; keyboard users close with Escape (see above).
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled on document
    <div
      id="viewer-lightbox"
      // biome-ignore lint/a11y/useSemanticElements: see above
      role="dialog"
      aria-modal="true"
      aria-label="Capture"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        id="viewer-lb-close"
        aria-label="Close"
        ref={closeRef}
        onClick={onClose}
      >
        <CloseIcon />
      </button>
      {img && <img id="viewer-lb-img" src={img} alt="" />}
      {content.kind === 'video-note' && (
        <div id="viewer-lb-video-note">
          <p>Video preview only. The recording stays on the host device.</p>
          <p className="viewer-lb-hint">
            Turn on <strong>Google Drive</strong> on the host to get a QR code for playback.
          </p>
        </div>
      )}
      {content.kind === 'qr' && (
        <div id="viewer-lb-qr-wrap">
          <p>Scan to open and play from Google Drive</p>
          <DriveQr url={content.driveUrl} />
          <p id="viewer-lb-drive-url">{content.driveUrl}</p>
        </div>
      )}
    </div>
  );
}

function DriveQr({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) renderQr(ref.current, url, { size: 220, dark: '#131311', light: '#fff' });
  }, [url]);
  return <div id="viewer-lb-qr" ref={ref} />;
}
