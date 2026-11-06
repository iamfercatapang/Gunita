// Media release the guest must accept before a session starts (when the
// host has turned it on in the admin Disclaimer panel).

import { useRef } from 'react';

import type { DisclaimerRequest } from './dialog-store';
import { useDialogFocus } from './useDialogFocus';

interface Props {
  request: DisclaimerRequest;
  onDone: (accepted: boolean) => void;
}

export function DisclaimerDialog({ request, onDone }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Focus the dialog itself, not Accept: a guest should read, not agree by
  // pressing Enter.
  useDialogFocus(cardRef);

  const paragraphs = request.text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div id="disclaimer-overlay" className="kiosk-dialog-overlay">
      <div
        className="disclaimer-modal"
        // The overlay div is the backdrop. A <dialog> would bring its own
        // backdrop and top-layer behaviour via showModal(), which the
        // existing kiosk CSS doesn't expect.
        // biome-ignore lint/a11y/useSemanticElements: see above
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-modal-title"
        tabIndex={-1}
        ref={cardRef}
      >
        <h2 id="disclaimer-modal-title" className="disclaimer-modal-title">
          {request.header || 'Do you agree with the terms?'}
        </h2>
        <div id="disclaimer-modal-body" className="disclaimer-modal-body">
          {paragraphs.map((p, i) => (
            // Paragraphs never reorder; the index is a stable key.
            // biome-ignore lint/suspicious/noArrayIndexKey: static text
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="disclaimer-modal-actions">
          <button
            type="button"
            id="btn-disclaimer-reject"
            className="disclaimer-btn disclaimer-btn-reject"
            onClick={() => onDone(false)}
          >
            Reject
          </button>
          <button
            type="button"
            id="btn-disclaimer-accept"
            className="disclaimer-btn disclaimer-btn-accept"
            onClick={() => onDone(true)}
          >
            Accept &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
}
