// React access to the settings store (src/state/settings.ts).

import { useSyncExternalStore } from 'react';

import { type AppConfig, getSettings, subscribeSettings } from '../state/settings';

/** One setting. Re-renders only when that setting changes. */
export function useSetting<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return useSyncExternalStore(subscribeSettings, () => getSettings()[key]);
}

/** All settings. Re-renders on any change. */
export function useSettings(): Readonly<AppConfig> {
  return useSyncExternalStore(subscribeSettings, getSettings);
}
