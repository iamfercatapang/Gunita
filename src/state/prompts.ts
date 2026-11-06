// The questions a guest will be asked: the chosen template's built-in
// questions the host left on, then the host's own enabled questions.

import { PROMPT_TEMPLATES } from '../constants';
import type { AppConfig } from './app-state';

type PromptSettings = Pick<
  AppConfig,
  'vgPromptCategory' | 'vgDisabledTemplatePrompts' | 'vgCustomPrompts'
>;

export function templatePrompts(s: Pick<AppConfig, 'vgPromptCategory'>): readonly string[] {
  return PROMPT_TEMPLATES[s.vgPromptCategory] ?? [];
}

export function enabledPrompts(s: PromptSettings): string[] {
  const disabled = new Set(s.vgDisabledTemplatePrompts);
  return [
    ...templatePrompts(s).filter((q) => !disabled.has(q)),
    ...s.vgCustomPrompts.filter((p) => p.enabled).map((p) => p.text),
  ];
}
