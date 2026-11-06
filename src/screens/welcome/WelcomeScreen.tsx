// The kiosk welcome screen: the host's background, the hero title and
// "Leave a Message". Tapping anywhere outside the panel starts too.
// The text and background come from the settings store, so changes in the
// admin designer show here straight away.

import { type MouseEvent, useEffect, useRef } from 'react';

import { useSettings } from '../../ui/useSettings';
import { useCaptures } from '../galleries/shared';
import { heroSubtitle, heroTitle } from './text';

// Taps on these don't count as "tap anywhere to start".
const NOT_A_START_TAP =
  '#btn-exit-kiosk, #btn-start-session, #btn-start-vg-session, #btn-show-prompts-preview, .welcome-vg-panel, #btn-recent-captures';

function startSession(): void {
  window.PB.kiosk?.startSession();
}

export function WelcomeScreen({ visible }: { visible: boolean }) {
  const s = useSettings();
  const { photos, videos } = useCaptures();
  const isVg = s.captureMode === 'videoguestbook';
  const media = s.welcomeMedia;
  const videoRef = useRef<HTMLVideoElement>(null);

  // A background video pauses while hidden on some devices; resume it.
  useEffect(() => {
    const video = videoRef.current;
    if (visible && video?.paused) void video.play().catch(() => {});
  }, [visible]);

  const onTap = (e: MouseEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest(NOT_A_START_TAP)) return;
    startSession();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the start buttons are the keyboard path
    <div
      id="guest-welcome"
      className={`welcome-overlay${visible ? '' : ' hidden'}`}
      style={media ? undefined : { backgroundColor: s.welcomeBg }}
      onClick={onTap}
    >
      {media?.type === 'image' && (
        <img id="ws-image-bg" className="ws-media-bg" src={media.objectUrl} alt="" />
      )}
      {media?.type === 'video' && (
        <video
          ref={videoRef}
          id="ws-video-bg"
          className="ws-media-bg"
          src={media.objectUrl}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      {/* Dark gradient scrim over the media for depth and readability */}
      <div className="ws-scrim" />
      <button
        type="button"
        id="btn-exit-kiosk"
        className="hidden-exit-btn"
        onClick={() => window.PB.kiosk?.requestExit()}
      >
        Exit Kiosk
      </button>

      {isVg ? (
        <div className="welcome-vg-panel welcome-vg-hero" id="welcome-vg-panel">
          <div className="welcome-hero-block">
            <h2 className="vg-panel-title" id="live-ws-title-vg">
              {heroTitle(s)}
            </h2>
            <p className="vg-panel-subtitle" id="live-ws-subtitle-vg">
              {heroSubtitle(s)}
            </p>
            <button
              type="button"
              id="btn-start-vg-session"
              className="vg-ok-btn"
              onClick={startSession}
            >
              <MicIcon />
              <span>Leave a Message</span>
            </button>
            {s.vgPromptsEnabled && (
              <button
                type="button"
                id="btn-show-prompts-preview"
                className="prompts-preview-link"
                onClick={() => window.PB.ui.showPromptsPreview(window.PB.prompts.enabled())}
              >
                What questions will be asked? &rarr;
              </button>
            )}
          </div>
        </div>
      ) : (
        // Photo-only mode, for legacy Photo Booth-only configs. Inert while
        // captureMode is forced to 'videoguestbook' (src/state/app-state.ts).
        <>
          <div className="welcome-content" id="welcome-photo-content">
            <h1 id="live-ws-title">{s.welcomeTitle}</h1>
            <p id="live-ws-subtitle">{s.welcomeSubtitle}</p>
          </div>
          <div className="welcome-action" id="welcome-photo-action">
            <button
              type="button"
              id="btn-start-session"
              className="circle-action-btn"
              onClick={startSession}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>Photo</span>
            </button>
          </div>
        </>
      )}

      {photos.length + videos.length > 0 && (
        <button
          type="button"
          id="btn-recent-captures"
          className="recent-captures-btn"
          onClick={() => window.PB.ui.showRecentCaptures()}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Recent Captures
        </button>
      )}
    </div>
  );
}

export function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
