// Video overlay: a 1920 × 1080 PNG burned into every recording.

import { useState } from 'react';

import { getSettings, updateSettings } from '../../../state/settings';
import { useSetting } from '../../../ui/useSettings';
import { ChooseFile, PanelHeader, useFileZone } from '../controls';

const WIDTH = 1920;
const HEIGHT = 1080;

function clearOverlay(): void {
  const old = getSettings().vgOverlay;
  if (old) URL.revokeObjectURL(old.objectUrl);
  updateSettings({ vgOverlay: null });
}

export function OverlayPanel() {
  const overlay = useSetting('vgOverlay');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const applyFile = (file: File): void => {
    if (file.type !== 'image/png') {
      setError('Please select a PNG file.');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth !== WIDTH || img.naturalHeight !== HEIGHT) {
        URL.revokeObjectURL(url);
        setError(
          `Image must be exactly 1920 × 1080 px (yours is ${img.naturalWidth} × ${img.naturalHeight} px).`,
        );
        return;
      }
      clearOverlay();
      updateSettings({ vgOverlay: { objectUrl: url, img } });
      setFileName(file.name);
      setError('');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Could not read the image. Please try another file.');
    };
    img.src = url;
  };
  // Any dropped file goes through the same checks, so the host sees why.
  const { zone, input, dragOver } = useFileZone(applyFile, () => true);

  return (
    <>
      <PanelHeader icon={<i className="fa-solid fa-film" />} title="Video Overlay" />

      <div className="settings-section">
        <h3 className="section-title">Overlay Image</h3>
        <p className="admin-lead admin-lead-tight">
          Upload a PNG image that will be composited on top of every Video Guestbook recording.
          <br />
          <strong>Required:</strong> PNG format &middot; Exactly <strong>1920 × 1080 px</strong>{' '}
          (use transparency for areas the camera should show through).
        </p>

        <div
          id="vg-overlay-drop"
          className={`template-upload-card settings-card admin-drop admin-drop-flush${dragOver ? ' drag-over' : ''}`}
          {...zone}
        >
          {overlay ? (
            <div id="vg-overlay-filled" className="admin-media-filled">
              <img
                id="vg-overlay-thumb"
                className="admin-overlay-thumb"
                src={overlay.objectUrl}
                alt="Overlay preview"
              />
              <p id="vg-overlay-filename" className="admin-overlay-filename">
                {fileName}
              </p>
              <p className="admin-overlay-note">
                Overlay will be burned into every recording and preview.
              </p>
              <button
                type="button"
                id="vg-overlay-remove"
                className="btn-outline admin-media-remove"
                onClick={() => {
                  clearOverlay();
                  setError('');
                }}
              >
                &#10005; Remove Overlay
              </button>
            </div>
          ) : (
            <div className="upload-empty-state" id="vg-overlay-empty">
              <span className="admin-drop-icon">
                <i className="fa-solid fa-film" />
              </span>
              <p className="admin-drop-title">Click or drag a PNG overlay here</p>
              <p className="admin-drop-sub">PNG only &middot; 1920 × 1080 px</p>
              <ChooseFile
                id="btn-pick-vg-overlay"
                inputId="vg-overlay-input"
                input={input}
                accept=".png,image/png"
              />
            </div>
          )}
        </div>
        {error && (
          <p id="vg-overlay-error" className="admin-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
