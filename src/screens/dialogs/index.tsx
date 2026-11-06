// Kiosk dialogs (Phase 4b): the PIN pad and the disclaimer.
//
// app.js opens them through window.PB.ui (wired in main.ts) and awaits the
// answer, the pattern later screens follow too.

import { useCallback, useSyncExternalStore } from 'react';

import { mountScreen } from '../../ui/mount';
import { DisclaimerDialog } from './DisclaimerDialog';
import { PinDialog } from './PinDialog';
import { getDialogs, setDialogs, subscribe } from './dialog-store';

export interface AskPinOptions {
  length: number;
  check: (pin: string) => Promise<boolean>;
}

export interface AskDisclaimerOptions {
  header: string;
  text: string;
}

let pending: { pin?: Promise<boolean>; disclaimer?: Promise<boolean> } = {};

function ensureMounted(): void {
  let container = document.getElementById('kiosk-dialogs');
  if (container?.dataset.mounted) return;
  if (!container) {
    container = document.createElement('div');
    container.id = 'kiosk-dialogs';
    document.body.append(container);
  }
  container.dataset.mounted = '1';
  mountScreen(container, <DialogHost />);
}

/** Resolves true once the right PIN is entered, false if cancelled. */
export function askPin(opts: AskPinOptions): Promise<boolean> {
  // Exit and a fullscreen change can both ask at once; share one dialog.
  if (pending.pin) return pending.pin;
  ensureMounted();
  pending.pin = new Promise<boolean>((resolve) => {
    setDialogs({
      pin: {
        ...opts,
        resolve: (unlocked) => {
          pending.pin = undefined;
          setDialogs({ pin: null });
          resolve(unlocked);
        },
      },
    });
  });
  return pending.pin;
}

/** Resolves true if the guest accepts, false if they reject. */
export function askDisclaimer(opts: AskDisclaimerOptions): Promise<boolean> {
  if (pending.disclaimer) return pending.disclaimer;
  ensureMounted();
  pending.disclaimer = new Promise<boolean>((resolve) => {
    setDialogs({
      disclaimer: {
        ...opts,
        resolve: (accepted) => {
          pending.disclaimer = undefined;
          setDialogs({ disclaimer: null });
          resolve(accepted);
        },
      },
    });
  });
  return pending.disclaimer;
}

/** Close every open dialog as cancelled, e.g. when the kiosk exits. */
export function closeAll(): void {
  const { pin, disclaimer } = getDialogs();
  pin?.resolve(false);
  disclaimer?.resolve(false);
  pending = {};
}

function DialogHost() {
  const { pin, disclaimer } = useSyncExternalStore(subscribe, getDialogs);
  const donePin = useCallback((ok: boolean) => pin?.resolve(ok), [pin]);
  const doneDisclaimer = useCallback((ok: boolean) => disclaimer?.resolve(ok), [disclaimer]);
  return (
    <>
      {pin && <PinDialog request={pin} onDone={donePin} />}
      {disclaimer && <DisclaimerDialog request={disclaimer} onDone={doneDisclaimer} />}
    </>
  );
}
