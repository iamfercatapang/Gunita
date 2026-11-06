// "What questions will be asked?" from the welcome screen: the prompts the
// guest will be asked, so nobody is caught off guard.

import { useEffect, useRef } from 'react';

export function PromptsPreview({ prompts, onClose }: { prompts: string[]; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes for keyboard users
    <div
      id="prompts-preview-modal"
      // Not <dialog>: the overlay div is the backdrop, and showModal()'s own
      // backdrop and top layer aren't what the existing CSS expects.
      // biome-ignore lint/a11y/useSemanticElements: see above
      role="dialog"
      aria-modal="true"
      aria-label="Questions you'll be asked"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="prompts-preview-inner">
        <p className="prompts-preview-intro">
          We'll ask you just a few questions, interview style. It's like a video guestbook.
        </p>
        <p className="prompts-preview-note">
          Don't worry, you can RE-DO at any time. The Q's include:
        </p>
        <div id="prompts-preview-list">
          {prompts.map((q, i) => (
            // Two prompts can share text; position keeps keys unique.
            <div key={`${i}:${q}`} className="prompt-preview-item">
              {q}
            </div>
          ))}
        </div>
        <button
          type="button"
          id="btn-close-prompts-preview"
          className="prompts-preview-close"
          ref={closeRef}
          onClick={onClose}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
