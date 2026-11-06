// Guest flow screens (Phase 4d): the photo booth offer after a video, the
// done screen, and the prompts preview. app.js opens them through
// window.PB.ui and awaits the answer, like the kiosk dialogs.

import { useCallback, useSyncExternalStore } from 'react';

import { mountScreen } from '../../ui/mount';
import { DoneScreen, type DoneScreenOptions } from './DoneScreen';
import { PhotoBoothOffer } from './PhotoBoothOffer';
import { PromptsPreview } from './PromptsPreview';

export type { DoneScreenOptions };

interface State {
  offer: { backdrop: HTMLCanvasElement | null; resolve: (yes: boolean) => void } | null;
  done: { opts: DoneScreenOptions; resolve: () => void } | null;
  prompts: string[] | null;
}

let state: State = { offer: null, done: null, prompts: null };
const listeners = new Set<() => void>();
function set(patch: Partial<State>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function ensureMounted(): void {
  const container = document.getElementById('kiosk-guest-screens');
  if (!container || container.dataset.mounted) return;
  container.dataset.mounted = '1';
  mountScreen(container, <GuestFlowHost />);
}

/** Resolves true if the guest wants a photo too; false on "No thanks" or timeout. */
export function offerPhotoBooth(backdrop: HTMLCanvasElement | null): Promise<boolean> {
  ensureMounted();
  state.offer?.resolve(false);
  return new Promise((resolve) => {
    set({
      offer: {
        backdrop,
        resolve: (yes) => {
          set({ offer: null });
          resolve(yes);
        },
      },
    });
  });
}

/** Resolves when the guest taps All done or the countdown runs out. */
export function showDone(opts: DoneScreenOptions): Promise<void> {
  ensureMounted();
  state.done?.resolve();
  return new Promise((resolve) => {
    set({
      done: {
        opts,
        resolve: () => {
          set({ done: null });
          resolve();
        },
      },
    });
  });
}

export function showPromptsPreview(prompts: string[]): void {
  ensureMounted();
  set({ prompts });
}

/** Close everything, e.g. when the kiosk exits. Pending offers count as no. */
export function closeGuestScreens(): void {
  state.offer?.resolve(false);
  state.done?.resolve();
  set({ prompts: null });
}

function GuestFlowHost() {
  const { offer, done, prompts } = useSyncExternalStore(subscribe, () => state);
  const answerOffer = useCallback((yes: boolean) => offer?.resolve(yes), [offer]);
  const finishDone = useCallback(() => done?.resolve(), [done]);
  const closePrompts = useCallback(() => set({ prompts: null }), []);
  return (
    <>
      {prompts && <PromptsPreview prompts={prompts} onClose={closePrompts} />}
      {offer && <PhotoBoothOffer backdrop={offer.backdrop} onDone={answerOffer} />}
      {done && <DoneScreen opts={done.opts} onDone={finishDone} />}
    </>
  );
}
