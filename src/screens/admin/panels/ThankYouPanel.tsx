// The thank-you screen after a recording: on/off, a background image and how
// long it shows.

import { getSettings, updateSettings } from '../../../state/settings';
import { useSetting } from '../../../ui/useSettings';
import { ChooseFile, FaIcon, FeatureToggle, PanelHeader, Slider, useFileZone } from '../controls';

function setImage(file: File | null): void {
  const old = getSettings().vgThankYouImage;
  if (old) URL.revokeObjectURL(old.objectUrl);
  updateSettings({ vgThankYouImage: file ? { objectUrl: URL.createObjectURL(file) } : null });
}

export function ThankYouPanel() {
  const enabled = useSetting('vgThankYouEnabled');
  const image = useSetting('vgThankYouImage');
  const { zone, input, dragOver } = useFileZone(setImage, (f) => f.type.startsWith('image/'));

  return (
    <>
      <PanelHeader
        icon={<i className="fa-solid fa-champagne-glasses" />}
        title="Thank You Screen"
        subClassName="admin-panel-lead"
        sub="Shown to guests after they close the video preview. Upload a custom image and set how long it displays before returning to the Welcome Screen."
      />

      <div className="settings-section">
        <FeatureToggle
          id="toggle-vg-thankyou"
          setting="vgThankYouEnabled"
          icon={<FaIcon name="champagne-glasses" />}
          title="Enable Thank You Screen"
          subtitle="Display a branded thank-you card after each Video Guestbook recording"
        />
      </div>

      {enabled && (
        <div id="vg-thankyou-config">
          <div className="settings-section">
            <h3 className="section-title">Background Image</h3>
            <div
              id="ty-media-drop"
              className={`template-upload-card settings-card admin-drop${dragOver ? ' drag-over' : ''}`}
              {...zone}
            >
              {image ? (
                <div id="ty-media-filled" className="admin-media-filled">
                  <div id="ty-media-thumb-wrap" className="admin-media-thumb">
                    <img src={image.objectUrl} alt="" />
                  </div>
                  <button
                    type="button"
                    id="ty-media-remove"
                    className="btn-outline admin-media-remove"
                    onClick={() => setImage(null)}
                  >
                    &#10005; Remove Image
                  </button>
                </div>
              ) : (
                <div className="upload-empty-state" id="ty-media-empty">
                  <span className="admin-drop-icon">
                    <i className="fa-regular fa-image" />
                  </span>
                  <p className="admin-drop-title">Click or drag an image</p>
                  <p className="admin-drop-sub">
                    JPG, PNG &middot; Recommended: 1080 &times; 1920 px (portrait) or 1920 &times;
                    1080 px (landscape)
                  </p>
                  <ChooseFile
                    id="btn-pick-ty-media"
                    inputId="ty-media-input"
                    input={input}
                    accept="image/*"
                  />
                </div>
              )}
            </div>
            <p className="admin-hint admin-hint-below">
              If no image is uploaded, a default gradient background is shown instead.
            </p>
          </div>

          <div className="settings-section">
            <h3 className="section-title">Display Duration</h3>
            <div className="settings-card">
              <Slider
                id="setting-ty-duration"
                setting="vgThankYouDuration"
                label="Auto-advance to Welcome Screen after"
                min={2}
                max={15}
              />
              <p className="admin-hint admin-hint-spaced">
                Guests can also tap the <strong>Done</strong> button to advance immediately.
              </p>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="section-title">Preview</h3>
            <div className="settings-card admin-preview-card">
              <div
                id="ty-preview-frame"
                className={`ty-preview-frame${image ? ' has-bg' : ''}`}
                data-theme="dark"
              >
                {image && <img id="ty-preview-bg" src={image.objectUrl} alt="" />}
                <div className="ty-preview-content">
                  <button type="button" className="ty-done-btn ty-done-btn-preview" disabled>
                    All done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
