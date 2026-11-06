import { updateSettings } from '../../../state/settings';
import { useSetting } from '../../../ui/useSettings';
import { PanelHeader, ToggleSwitch, useDraftSetting } from '../controls';

const DEFAULT_HEADER = 'Media Release Agreement';
const headerOrDefault = (typed: string): string => typed || DEFAULT_HEADER;

export function DisclaimerPanel() {
  const enabled = useSetting('disclaimerEnabled');
  const [org, setOrg] = useDraftSetting('disclaimerOrg');
  const [header, setHeader] = useDraftSetting('disclaimerHeader', headerOrDefault);
  const [text, setText] = useDraftSetting('disclaimerText');

  return (
    <>
      <PanelHeader icon={<i className="fa-solid fa-file-lines" />} title="Disclaimer" />

      <div className="settings-section">
        <div className="settings-card feature-toggle-row">
          <div className="feature-toggle-left">
            <div className="feature-icon">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#374151"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <div className="feature-title">Disclaimer</div>
              <div className="feature-subtitle">Show a consent dialog before every session</div>
            </div>
          </div>
          <ToggleSwitch
            id="toggle-disclaimer"
            checked={enabled}
            label="Disclaimer"
            onChange={(v) => updateSettings({ disclaimerEnabled: v })}
          />
        </div>

        {enabled && (
          <div id="disclaimer-config" className="settings-card admin-subcard">
            <div className="admin-field-stack">
              <div>
                <label className="admin-field-label" htmlFor="disclaimer-org">
                  Organisation Name
                </label>
                <input
                  type="text"
                  id="disclaimer-org"
                  className="text-input admin-input-md"
                  placeholder="Name of Organization"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                />
                <p className="admin-hint">
                  Replaces every <code>{'{Name of Organization}'}</code> placeholder in the text
                  below.
                </p>
              </div>
              <div>
                <label className="admin-field-label" htmlFor="disclaimer-header">
                  Header
                </label>
                <input
                  type="text"
                  id="disclaimer-header"
                  className="text-input admin-input-lg"
                  placeholder={DEFAULT_HEADER}
                  value={header}
                  onChange={(e) => setHeader(e.target.value)}
                />
              </div>
              <div>
                <label className="admin-field-label" htmlFor="disclaimer-text">
                  Text
                </label>
                <textarea
                  id="disclaimer-text"
                  className="text-input admin-disclaimer-text"
                  rows={10}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
              <p className="admin-warn-note">
                If the guest does not agree to the disclaimer, their session will be cancelled and
                nothing will be saved.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
