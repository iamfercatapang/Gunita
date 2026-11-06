// The bridge between the legacy page and React screens (Phase 4).
//
// index.html keeps one container element per screen. A screen that has moved
// to React renders into its container; the rest of the page, including
// public/app.js, doesn't need to know.

import { type ReactNode, StrictMode } from 'react';
import { type Root, createRoot } from 'react-dom/client';

const roots = new Map<HTMLElement, Root>();

/** Render `node` into `container`, replacing whatever markup it had. */
export function mountScreen(container: HTMLElement, node: ReactNode): Root {
  let root = roots.get(container);
  if (!root) {
    container.replaceChildren();
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(<StrictMode>{node}</StrictMode>);
  return root;
}

export function unmountScreen(container: HTMLElement): void {
  roots.get(container)?.unmount();
  roots.delete(container);
}
