// The welcome screen designer: background media or colour, the hero title
// and the couple's name, with a live preview. The kiosk welcome screen reads
// the same settings, so it updates as the host types.

import { getSettings, updateSettings } from '../../../state/settings';
import { useSettings } from '../../../ui/useSettings';
import { MicIcon } from '../../welcome/WelcomeScreen';
import { DEFAULT_HERO_TITLE, heroSubtitle, heroTitle } from '../../welcome/text';
import { ChooseFile, PanelHeader, useDraftSetting, useFileZone } from '../controls';

function setMedia(file: File | null): void {
  const old = getSettings().welcomeMedia;
  if (old) URL.revokeObjectURL(old.objectUrl);
  updateSettings({
    welcomeMedia: file
      ? {
          type: file.type.startsWith('video/') ? 'video' : 'image',
          objectUrl: URL.createObjectURL(file),
        }
      : null,
  });
}

const isMedia = (f: File): boolean => f.type.startsWith('image/') || f.type.startsWith('video/');

export function WelcomePanel() {
  const s = useSettings();
  const media = s.welcomeMedia;
  const { zone, input, dragOver } = useFileZone(setMedia, isMedia);
  const [title, setTitle] = useDraftSetting('vgPanelTitle');
  const [couple, setCouple] = useDraftSetting('vgCoupleName');

  return (
    <>
      <div className="content-header flex-between">
        <h1>
          <i className="fa-solid fa-mobile-screen" /> Welcome Screen Designer
        </h1>
      </div>

      <div className="designer-layout">
        <div className="designer-tools">
          <div className="tool-group">
            <p className="admin-tool-label">Background Media</p>
            <div
              id="ws-media-drop"
              className={`template-upload-card settings-card admin-drop admin-drop-flush${dragOver ? ' drag-over' : ''}`}
              {...zone}
            >
              {media ? (
                <div id="ws-media-filled" className="admin-media-filled">
                  <div id="ws-media-thumb-wrap" className="admin-media-thumb">
                    {media.type === 'video' ? (
                      <video
                        src={media.objectUrl}
                        className="ws-thumb-media"
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                    ) : (
                      <img src={media.objectUrl} className="ws-thumb-media" alt="" />
                    )}
                  </div>
                  <button
                    type="button"
                    id="ws-media-remove"
                    className="btn-outline admin-media-remove"
                    onClick={() => setMedia(null)}
                  >
                    &#10005; Remove Media
                  </button>
                </div>
              ) : (
                <div className="upload-empty-state" id="ws-media-empty">
                  <span className="admin-drop-icon">
                    <i className="fa-regular fa-image" />
                  </span>
                  <p className="admin-drop-title">Click or drag image / video</p>
                  <p className="admin-drop-sub">JPG, PNG, GIF &middot; MP4, MOV, WEBM</p>
                  <ChooseFile
                    id="btn-pick-ws-media"
                    inputId="ws-media-input"
                    input={input}
                    accept="image/*,video/*"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="tool-group">
            <label htmlFor="edit-bg-color">
              Background Color <span className="admin-label-aside">(used when no media)</span>
            </label>
            <div className="color-picker-wrapper">
              <input
                type="color"
                id="edit-bg-color"
                value={s.welcomeBg}
                onChange={(e) => updateSettings({ welcomeBg: e.target.value })}
              />
              <span id="color-hex">{s.welcomeBg}</span>
            </div>
          </div>

          <div className="tool-group admin-tool-group-divided">
            <div className="admin-tool-field">
              <label className="admin-tool-field-label" htmlFor="edit-vg-panel-title">
                Hero Title
              </label>
              <input
                type="text"
                id="edit-vg-panel-title"
                className="text-input"
                placeholder={DEFAULT_HERO_TITLE}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="admin-tool-field-label" htmlFor="edit-vg-couple-name">
                Couple / Guest of Honor Name
              </label>
              <input
                type="text"
                id="edit-vg-couple-name"
                className="text-input"
                placeholder="e.g. Ken & Alexa"
                value={couple}
                onChange={(e) => setCouple(e.target.value)}
              />
              <p className="admin-hint admin-hint-tight">
                Shown as: &ldquo;Answer just a few questions on video for{' '}
                <em id="vg-couple-name-preview">{s.vgCoupleName || 'Ken & Alexa'}</em>.&rdquo;
              </p>
            </div>
          </div>
        </div>

        <div className="designer-preview-container">
          {/* Mirrors the kiosk welcome layout, scaled to the admin preview frame. */}
          <div
            className="preview-frame welcome-preview-frame"
            id="designer-preview"
            data-theme="dark"
            style={media ? undefined : { backgroundColor: s.welcomeBg }}
          >
            {media?.type === 'image' && (
              <img id="prev-media-img" className="ws-media-bg" src={media.objectUrl} alt="" />
            )}
            {media?.type === 'video' && (
              <video
                id="prev-media-video"
                className="ws-media-bg"
                src={media.objectUrl}
                autoPlay
                loop
                muted
                playsInline
              />
            )}
            <div className="welcome-preview-scrim" />
            <div className="welcome-preview-content">
              <h2 id="prev-vg-title" className="welcome-preview-title">
                {heroTitle(s)}
              </h2>
              <p id="prev-vg-subtitle" className="welcome-preview-subtitle">
                {heroSubtitle(s)}
              </p>
              <div className="welcome-preview-cta">
                <MicIcon />
                <span>Leave a Message</span>
              </div>
              {s.vgPromptsEnabled && (
                <span className="welcome-preview-prompts" id="prev-vg-prompts-chip">
                  What questions will be asked? &rarr;
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
