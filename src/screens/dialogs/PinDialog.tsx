// PIN pad shown when someone tries to leave kiosk mode.

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PinRequest } from './dialog-store';
import { useDialogFocus } from './useDialogFocus';

const MAX_DIGITS = 8;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

interface Props {
  request: PinRequest;
  onDone: (unlocked: boolean) => void;
}

export function PinDialog({ request, onDone }: Props) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState(false);
  // PBKDF2 takes a moment. Ignore keys until the check finishes, or a fast
  // tapper could start a second check with a longer PIN.
  const checking = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  useDialogFocus(cardRef);

  const press = useCallback(
    async (key: string) => {
      if (checking.current || digits.length >= MAX_DIGITS) return;
      const next = digits + key;
      setDigits(next);
      setError(false);
      if (request.length <= 0 || next.length < request.length) return;
      checking.current = true;
      const ok = await request.check(next).catch(() => false);
      checking.current = false;
      if (ok) {
        onDone(true);
      } else {
        setError(true);
        setDigits('');
      }
    },
    [digits, request, onDone],
  );

  const backspace = useCallback(() => {
    if (checking.current) return;
    setDigits((d) => d.slice(0, -1));
    setError(false);
  }, []);

  // A laptop kiosk has a keyboard: accept digits, Backspace and Escape too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (/^[0-9]$/.test(e.key)) void press(e.key);
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Escape') onDone(false);
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [press, backspace, onDone]);

  const slots = Math.max(digits.length, 4);
  const display = Array.from({ length: slots }, (_, i) => (i < digits.length ? '●' : '–')).join('');

  return (
    <div id="pin-overlay" className="kiosk-dialog-overlay">
      <div
        className="kiosk-card pin-card"
        // The overlay div is the backdrop. A <dialog> would bring its own
        // backdrop and top-layer behaviour via showModal(), which the
        // existing kiosk CSS doesn't expect.
        // biome-ignore lint/a11y/useSemanticElements: see above
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-title"
        tabIndex={-1}
        ref={cardRef}
      >
        <h2 id="pin-title">Admin Access</h2>
        <p>Enter PIN to exit Kiosk Mode</p>
        <div id="pin-display" aria-label={`${digits.length} digits entered`}>
          {display}
        </div>
        <div className="pin-keys">
          {KEYS.map((k) => (
            <button key={k} type="button" className="pin-key" onClick={() => press(k)}>
              {k}
            </button>
          ))}
          <button
            type="button"
            className="pin-key pin-key-cancel"
            id="btn-pin-cancel"
            onClick={() => onDone(false)}
          >
            Cancel
          </button>
          <button type="button" className="pin-key" onClick={() => press('0')}>
            0
          </button>
          <button
            type="button"
            className="pin-key pin-key-del"
            id="btn-pin-del"
            aria-label="Delete last digit"
            onClick={backspace}
          >
            ⌫
          </button>
        </div>
        {error && (
          <div id="pin-error" role="alert">
            Incorrect PIN. Try again.
          </div>
        )}
      </div>
    </div>
  );
}
