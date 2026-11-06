// The settings store (Phase 4e): appConfig with change notifications.
//
// window.appConfig is a Proxy over the raw config in app-state.ts. Writes
// from anywhere (app.js, the typed modules, React) go through it, so React
// screens re-render on every change and saved settings are written to
// localStorage shortly after. Only whole-value assignments are seen: replace
// arrays and objects rather than mutating them in place.
//
// React reads settings with useSetting(key) and writes with updateSettings().
// This module doesn't import React, so it loads before app.js runs.

import { type AppConfig, PERSISTED_KEYS, _scheduleSave, appConfig } from './app-state';

export type { AppConfig };

let snapshot: Readonly<AppConfig> = { ...appConfig };
const listeners = new Set<() => void>();
const persisted = new Set<keyof AppConfig>(PERSISTED_KEYS);

function commit(changed: (keyof AppConfig)[]): void {
  if (changed.length === 0) return;
  snapshot = { ...appConfig };
  if (changed.some((k) => persisted.has(k))) _scheduleSave();
  for (const l of listeners) l();
}

const raw = appConfig as unknown as Record<string | symbol, unknown>;

/** appConfig, but every assignment notifies the store. */
export const settings: AppConfig = new Proxy(appConfig, {
  set(_target, key, value) {
    if (raw[key] === value) return true;
    raw[key] = value;
    commit([key as keyof AppConfig]);
    return true;
  },
});

/** The current settings. A new object after every change, so React can compare. */
export function getSettings(): Readonly<AppConfig> {
  return snapshot;
}

/** Change several settings at once, with one re-render. */
export function updateSettings(patch: Partial<AppConfig>): void {
  const changed: (keyof AppConfig)[] = [];
  for (const k of Object.keys(patch) as (keyof AppConfig)[]) {
    if (raw[k] === patch[k]) continue;
    raw[k] = patch[k];
    changed.push(k);
  }
  commit(changed);
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

window.appConfig = settings;
