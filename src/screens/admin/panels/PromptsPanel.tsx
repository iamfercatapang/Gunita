// Pre-recording prompts: on/off, the splash length, the event template and
// the pool of questions (template ones can be switched off; the host's own
// can be switched off or removed).

import { type KeyboardEvent, useState } from 'react';

import type { PromptCategory } from '../../../constants';
import { enabledPrompts, templatePrompts } from '../../../state/prompts';
import { getSettings, updateSettings } from '../../../state/settings';
import { useSettings } from '../../../ui/useSettings';
import { FaIcon, FeatureToggle, PanelHeader, Slider } from '../controls';

const CATEGORIES: { cat: PromptCategory; icon: string; label: string }[] = [
  { cat: 'wedding', icon: 'ring', label: 'Wedding' },
  { cat: 'birthday', icon: 'cake-candles', label: 'Birthday' },
  { cat: 'teambuilding', icon: 'handshake', label: 'Team Building' },
];

function setTemplatePromptOn(q: string, on: boolean): void {
  const disabled = getSettings().vgDisabledTemplatePrompts.filter((d) => d !== q);
  updateSettings({ vgDisabledTemplatePrompts: on ? disabled : [...disabled, q] });
}

function setCustomPromptOn(index: number, on: boolean): void {
  updateSettings({
    vgCustomPrompts: getSettings().vgCustomPrompts.map((p, i) =>
      i === index ? { ...p, enabled: on } : p,
    ),
  });
}

function removeCustomPrompt(index: number): void {
  updateSettings({ vgCustomPrompts: getSettings().vgCustomPrompts.filter((_, i) => i !== index) });
}

function PromptToggle({
  on,
  onChange,
  label,
}: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <label className="vg-prompt-toggle-wrap">
      <input
        type="checkbox"
        className="vg-prompt-toggle"
        checked={on}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="vg-prompt-toggle-pill" />
    </label>
  );
}

export function PromptsPanel() {
  const s = useSettings();
  const [draft, setDraft] = useState('');
  const disabled = new Set(s.vgDisabledTemplatePrompts);

  const addCustom = (): void => {
    const text = draft.trim();
    if (!text) return;
    updateSettings({
      vgCustomPrompts: [...getSettings().vgCustomPrompts, { text, enabled: true }],
    });
    setDraft('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') addCustom();
  };

  return (
    <>
      <PanelHeader
        icon={<i className="fa-regular fa-comment-dots" />}
        title="Pre-Recording Prompts"
      />

      <div className="settings-section">
        <FeatureToggle
          id="toggle-vg-prompts"
          setting="vgPromptsEnabled"
          icon={<FaIcon name="comment-dots" regular />}
          title="Enable Prompts"
          subtitle="Show a random question to guests before each recording starts"
        />

        {s.vgPromptsEnabled && (
          <div id="vg-prompts-config" className="admin-reveal">
            <div className="settings-card">
              <Slider
                id="setting-vg-splash-duration"
                setting="vgSplashDuration"
                label="Splash Screen Duration"
                min={1}
                max={10}
              />
              <p className="admin-hint admin-hint-spaced">
                How long the &ldquo;Get Ready&rdquo; splash screen is shown before the question
                appears.
              </p>
            </div>

            <div className="settings-card">
              <p className="admin-field-label admin-field-label-spaced">Event Template</p>
              <div className="prompt-category-tabs">
                {CATEGORIES.map(({ cat, icon, label }) => (
                  <button
                    key={cat}
                    type="button"
                    className={`prompt-cat-btn${s.vgPromptCategory === cat ? ' active' : ''}`}
                    data-cat={cat}
                    aria-pressed={s.vgPromptCategory === cat}
                    onClick={() => updateSettings({ vgPromptCategory: cat })}
                  >
                    <FaIcon name={icon} /> {label}
                  </button>
                ))}
              </div>
              <p className="admin-hint admin-hint-tight">
                Choose a template to load its built-in questions. Your custom questions always
                appear alongside the template.
              </p>
            </div>

            <div className="settings-card admin-prompt-pool">
              <div className="admin-prompt-pool-head">
                <span>
                  Active Prompt Pool{' '}
                  <span id="vg-prompts-count">({enabledPrompts(s).length} enabled)</span>
                </span>
              </div>
              <ul id="vg-prompts-list">
                {templatePrompts(s).map((q) => {
                  const on = !disabled.has(q);
                  return (
                    <li
                      key={`t:${q}`}
                      className={`vg-prompt-item${on ? '' : ' is-disabled'}`}
                      data-type="template"
                    >
                      <PromptToggle on={on} label={q} onChange={(v) => setTemplatePromptOn(q, v)} />
                      <span className="vg-prompt-badge">Template</span>
                      <span className="vg-prompt-text">{q}</span>
                    </li>
                  );
                })}
                {s.vgCustomPrompts.map((p, i) => (
                  <li
                    // Two custom prompts can share text; position keeps keys unique.
                    key={`c:${i}:${p.text}`}
                    className={`vg-prompt-item${p.enabled ? '' : ' is-disabled'}`}
                    data-type="custom"
                  >
                    <PromptToggle
                      on={p.enabled}
                      label={p.text}
                      onChange={(v) => setCustomPromptOn(i, v)}
                    />
                    <span className="vg-prompt-badge vg-prompt-badge-custom">Custom</span>
                    <span className="vg-prompt-text">{p.text}</span>
                    <button
                      type="button"
                      className="vg-prompt-del"
                      title="Remove"
                      aria-label={`Remove "${p.text}"`}
                      onClick={() => removeCustomPrompt(i)}
                    >
                      {'✕'}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="admin-prompt-pool-add">
                <input
                  type="text"
                  id="vg-custom-prompt-input"
                  className="text-input"
                  placeholder="Type your own question and press Enter…"
                  aria-label="Your own question"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                />
                <button
                  type="button"
                  id="btn-add-vg-prompt"
                  className="btn-outline"
                  onClick={addCustom}
                >
                  + Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
