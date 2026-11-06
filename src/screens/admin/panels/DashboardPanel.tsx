// Dashboard: the event name (filename prefix and Drive sub-folder) and this
// session's recent captures.

import { useCallback } from 'react';

import { useSettings } from '../../../ui/useSettings';
import { DashboardGallery } from '../../galleries';
import { PanelHeader, useDraftSetting } from '../controls';

const trim = (t: string): string => t.trim();

function filenamePrefix(eventName: string): string {
  return eventName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'photobooth';
}

export function DashboardPanel() {
  const s = useSettings();
  // Drive caches the event folder by name; a new name needs a new folder.
  const onRename = useCallback(() => window.PB.drive.invalidateFolders(), []);
  const [eventName, setEventName] = useDraftSetting('eventName', trim, onRename);
  const needsName = (s.saveDrive || s.vgSaveDrive) && !s.eventName;

  return (
    <>
      <PanelHeader icon={<i className="fa-solid fa-desktop" />} title="Dashboard" />

      <div className="settings-card admin-form-card">
        <div className="admin-form-card-head">
          <div className="admin-form-card-icon">
            <i className="fa-solid fa-location-dot" />
          </div>
          <div>
            <div className="admin-form-card-title">
              Event Name{' '}
              <span
                className="admin-form-card-required"
                title="Required when Google Drive is enabled"
              >
                *
              </span>
            </div>
            <div className="admin-form-card-subtitle">
              Used as the filename prefix and the Google Drive sub-folder name for this event.
            </div>
          </div>
        </div>
        <div className="admin-form-card-body">
          <input
            type="text"
            id="event-name-input"
            className={`text-input admin-form-input-wide${needsName ? ' input-required-highlight' : ''}`}
            placeholder="e.g. Smiths_Wedding"
            aria-label="Event name"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
          />
          <p className="admin-form-meta">
            Saved as{' '}
            <code id="filename-preview">{filenamePrefix(s.eventName)}_YYYYMMDD_HHMMSS.png</code>
          </p>
          {needsName && (
            <div id="event-name-drive-warning" className="admin-form-warning" role="alert">
              <i className="fa-solid fa-triangle-exclamation" /> Enter an Event Name — it is
              required to organise files into sub-folders on Google Drive.
            </div>
          )}
        </div>
      </div>

      <div className="gallery-section" id="dashboard-gallery">
        <DashboardGallery />
      </div>
    </>
  );
}
