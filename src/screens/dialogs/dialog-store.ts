// Which kiosk dialogs are open. app.js opens them through window.PB.ui and
// awaits the answer; DialogHost renders whatever is open here.

export interface PinRequest {
  /** Digits in the stored PIN. Checking starts once this many are entered. */
  length: number;
  /** Resolves true if `pin` is correct. */
  check: (pin: string) => Promise<boolean>;
  resolve: (unlocked: boolean) => void;
}

export interface DisclaimerRequest {
  header: string;
  /** Plain text. Blank lines separate paragraphs. */
  text: string;
  resolve: (accepted: boolean) => void;
}

export interface DialogState {
  pin: PinRequest | null;
  disclaimer: DisclaimerRequest | null;
}

let state: DialogState = { pin: null, disclaimer: null };
const listeners = new Set<() => void>();

export function getDialogs(): DialogState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setDialogs(patch: Partial<DialogState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}
