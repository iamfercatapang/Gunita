// Welcome screen wording, shared by the kiosk and the admin designer preview.

import type { AppConfig } from '../../state/app-state';

export const DEFAULT_HERO_TITLE = 'Raise a Toast!';

export function heroTitle(s: Pick<AppConfig, 'vgPanelTitle'>): string {
  return s.vgPanelTitle || DEFAULT_HERO_TITLE;
}

export function heroSubtitle(s: Pick<AppConfig, 'vgCoupleName' | 'vgPromptText'>): string {
  const name = (s.vgCoupleName || '').trim();
  if (name) return `Answer just a few questions on video for ${name}.`;
  return s.vgPromptText || 'Share a message for the happy couple!';
}
