// The kiosk exit PIN. Three fields: Current (only when a PIN is set), New
// and Confirm. The PIN is hashed (PBKDF2 via window.PB.security) before it's
// saved; the raw PIN never reaches appConfig or localStorage.

import { type FormEvent, useState } from 'react';

import { saveConfig } from '../../../state/app-state';
import { updateSettings } from '../../../state/settings';
import { useSetting } from '../../../ui/useSettings';
import { FormCard, PanelHeader } from '../controls';

type Feedback = { kind: 'error' | 'ok' | 'info'; text: string } | null;

const digitsOnly = (v: string): string => v.replace(/\D/g, '');

export function SecurityPanel() {
  const pinHash = useSetting('kioskPin');
  const pinLen = useSetting('kioskPinLen');
  const hasPin = !!pinHash && pinLen > 0;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const buttonLabel = hasPin ? (next === '' ? 'Remove PIN' : 'Update PIN') : 'Set PIN';

  const apply = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    // Empty means remove.
    if (next !== '' && !/^\d{4,8}$/.test(next)) {
      setFeedback({ kind: 'error', text: 'New PIN must be 4–8 digits.' });
      return;
    }
    if (next !== confirm) {
      setFeedback({ kind: 'error', text: 'New PIN and confirmation do not match.' });
      return;
    }
    if (hasPin && !current) {
      setFeedback({ kind: 'error', text: 'Enter the current PIN to change it.' });
      return;
    }

    setBusy(true);
    setFeedback({ kind: 'info', text: 'Verifying…' });
    try {
      if (hasPin) {
        const result = await window.PB.security.verifyPin(current, pinHash);
        if (!result.ok) {
          setFeedback({ kind: 'error', text: 'Current PIN is incorrect.' });
          return;
        }
      }
      updateSettings({
        kioskPin: await window.PB.security.hashPin(next),
        kioskPinLen: next.length,
      });
      saveConfig();
      setCurrent('');
      setNext('');
      setConfirm('');
      setFeedback({
        kind: 'ok',
        text: next === '' ? 'PIN removed.' : hasPin ? 'PIN updated.' : 'PIN set.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PanelHeader
        icon={<i className="fa-solid fa-shield-halved" />}
        title="Security"
        sub="Access controls for Kiosk Mode."
      />

      <div className="settings-section">
        <FormCard
          icon={<i className="fa-solid fa-key" />}
          title={
            <>
              Exit PIN <span className="admin-form-card-optional">(optional)</span>
            </>
          }
          subtitle="Required to exit Kiosk Mode. Prevents guests from accessing settings. Hashed with PBKDF2-SHA-256."
        >
          <form onSubmit={apply} className="admin-pin-form">
            <p id="kiosk-pin-status" className="kiosk-pin-status">
              {hasPin ? (
                <>
                  <i className="fa-solid fa-lock" /> PIN set
                </>
              ) : (
                'No PIN — exit without prompt'
              )}
            </p>

            {hasPin && (
              <div id="kiosk-pin-current-row" className="admin-form-field">
                <label htmlFor="kiosk-pin-current">Current PIN</label>
                <input
                  type="password"
                  id="kiosk-pin-current"
                  className="text-input admin-form-input-narrow"
                  inputMode="numeric"
                  maxLength={8}
                  autoComplete="off"
                  placeholder="Enter the current PIN"
                  value={current}
                  onChange={(e) => setCurrent(digitsOnly(e.target.value))}
                />
              </div>
            )}

            <div className="admin-form-field">
              <label htmlFor="kiosk-pin-new">
                <span id="kiosk-pin-new-label">{hasPin ? 'New PIN' : 'PIN'}</span>{' '}
                <span className="admin-form-field-hint">(4–8 digits, or empty to remove)</span>
              </label>
              <input
                type="password"
                id="kiosk-pin-new"
                className="text-input admin-form-input-narrow"
                inputMode="numeric"
                maxLength={8}
                autoComplete="new-password"
                placeholder="4–8 digits"
                value={next}
                onChange={(e) => setNext(digitsOnly(e.target.value))}
              />
            </div>

            <div className="admin-form-field">
              <label htmlFor="kiosk-pin-confirm">Confirm new PIN</label>
              <input
                type="password"
                id="kiosk-pin-confirm"
                className="text-input admin-form-input-narrow"
                inputMode="numeric"
                maxLength={8}
                autoComplete="new-password"
                placeholder="Re-enter the new PIN"
                value={confirm}
                onChange={(e) => setConfirm(digitsOnly(e.target.value))}
              />
            </div>

            <div className="admin-form-actions">
              <button
                id="btn-kiosk-pin-apply"
                className="btn-outline"
                type="submit"
                disabled={busy}
              >
                {buttonLabel}
              </button>
              <output
                id="kiosk-pin-feedback"
                className={`kiosk-pin-feedback${feedback ? ` is-${feedback.kind}` : ''}`}
              >
                {feedback?.text}
              </output>
            </div>
          </form>
        </FormCard>
      </div>
    </>
  );
}
