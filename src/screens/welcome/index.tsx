// The kiosk welcome screen (Phase 4e). Always mounted inside #kiosk-mode;
// app.js hides it as a session starts and shows it again afterwards, through
// window.PB.ui.hideWelcome / showWelcome.

import { useSyncExternalStore } from 'react';

import { mountScreen } from '../../ui/mount';
import { WelcomeScreen } from './WelcomeScreen';

let visible = true;
const listeners = new Set<() => void>();
function setVisible(v: boolean): void {
  if (visible === v) return;
  visible = v;
  for (const l of listeners) l();
}

export function showWelcome(): void {
  setVisible(true);
}

export function hideWelcome(): void {
  setVisible(false);
}

function WelcomeHost() {
  const v = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => visible,
  );
  return <WelcomeScreen visible={v} />;
}

export function mountWelcome(): void {
  const container = document.getElementById('kiosk-welcome-root');
  if (container) mountScreen(container, <WelcomeHost />);
}
