// Photo: the "take a photo too?" offer after a video, and the photo session
// settings that apply when the guest says yes.

import { useSetting } from '../../../ui/useSettings';
import { FaIcon, FeatureToggle, PanelHeader, SaveDestCard, Slider } from '../controls';

export function PhotoPanel() {
  const offerOn = useSetting('vgOfferPb');
  const splashOn = useSetting('pbSplashEnabled');

  return (
    <>
      <PanelHeader icon={<i className="fa-solid fa-camera-retro" />} title="Photo" />

      <div className="settings-section">
        <FeatureToggle
          id="toggle-vg-offer-pb"
          setting="vgOfferPb"
          icon={<FaIcon name="camera" />}
          title="Offer Photo Booth After Recording"
          subtitle="After guests finish their video, prompt them to take a photo strip too"
        />
      </div>

      {offerOn && (
        <div id="photo-offer-config">
          <div className="settings-section">
            <h3 className="section-title">Splash Screen</h3>
            <FeatureToggle
              id="toggle-pb-splash"
              setting="pbSplashEnabled"
              icon={<FaIcon name="wand-magic-sparkles" />}
              title="Photo Booth Splash Screen"
              subtitle={
                <>Show a fun &ldquo;get ready&rdquo; screen before each photo session begins</>
              }
            />
            {splashOn && (
              <div id="pb-splash-config" className="admin-reveal">
                <div className="settings-card">
                  <Slider
                    id="setting-pb-splash-duration"
                    setting="pbSplashDuration"
                    label="Splash Screen Duration"
                    min={1}
                    max={10}
                  />
                  <p className="admin-hint admin-hint-spaced">
                    How long the &ldquo;Show Your Best Pose!&rdquo; screen is shown before the
                    countdown begins.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3 className="section-title">Countdown</h3>
            <div className="settings-card">
              <Slider
                id="setting-cd-1"
                setting="countdownFirst"
                label="Countdown before photo 1"
                min={1}
                max={10}
              />
              <Slider
                id="setting-cd-others"
                setting="countdownOthers"
                label="Countdown before other photos"
                min={1}
                max={10}
              />
              <Slider
                id="setting-review"
                setting="reviewTime"
                label="Photo review time (Preview)"
                min={1}
                max={10}
              />
            </div>
          </div>

          <div className="settings-section">
            <h3 className="section-title">Save Destination</h3>
            <div className="settings-card">
              <p className="admin-lead-sm">
                Enable one or both destinations — captures are saved to all enabled locations.
              </p>
              <div className="save-dest-grid">
                <SaveDestCard
                  id="chk-save-local"
                  setting="saveLocal"
                  icon="floppy-disk"
                  title="Local Folder"
                />
                <SaveDestCard
                  id="chk-save-drive"
                  setting="saveDrive"
                  icon="cloud"
                  title="Google Drive"
                />
              </div>
              <p className="admin-note-sm">
                <i className="fa-solid fa-circle-info admin-note-icon" />
                Save folder and Google Drive settings are configured in{' '}
                <strong>Capture Settings</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
