// The video guestbook screen: the live camera, the "get ready" splash, the
// question card, countdown, REC badge with timers and mic status, Stop and
// Re-do, and the messages over it (saving, errors, short recording).

import { useEffect, useState, useSyncExternalStore } from 'react';

import { HIDE } from './hide';
import { type VideoUi, registerFeed } from './store';
import { onStopTapped, redo } from './video-session';

const fmt = (secs: number): string =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

function MicBadge() {
  const audio = window.PB.audio;
  const state = useSyncExternalStore(audio.subscribeMicBadge, audio.getMicBadge);
  if (!state) return null;
  const label = state === 'ok' ? 'Mic' : state === 'muted' ? 'Muted' : 'No mic';
  return (
    <div id="vg-mic-badge" className={`mic-${state}`}>
      <i
        id="vg-mic-icon"
        className={`fa-solid ${state === 'ok' ? 'fa-microphone' : 'fa-microphone-slash'}`}
      />
      <span id="vg-mic-label">{label}</span>
    </div>
  );
}

/** REC badge, elapsed time and time left, ticking off the wall clock. */
function Hud({ startedAt, maxSecs }: { startedAt: number; maxSecs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const left = Math.max(0, maxSecs - elapsed);
  const leftText = left >= 60 ? `${fmt(left)} left` : `${left}s left`;
  return (
    <div id="vg-hud">
      <div className="vg-rec-badge">
        <span className="vg-rec-dot" />
        <span>REC</span>
      </div>
      <div className="vg-timer" id="vg-timer">
        {fmt(elapsed)}
      </div>
      <div className={`vg-time-left${left <= 10 ? ' is-low' : ''}`} id="vg-time-left">
        {leftText}
      </div>
      <MicBadge />
    </div>
  );
}

/** The question reminder in the corner; the guest can tuck it away. */
function Reminder({ text }: { text: string }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div id="vg-prompt-sidebar" className={collapsed ? 'collapsed' : undefined}>
      <button
        type="button"
        id="btn-vg-prompt-collapse"
        className="vg-prompt-collapse-btn"
        aria-label={collapsed ? 'Show the question' : 'Hide the question'}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        <i className="fa-solid fa-chevron-right" />
      </button>
      <div className="vg-prompt-sidebar-label">
        <i className="fa-regular fa-comment-dots" /> Remember to answer
      </div>
      <p id="vg-prompt-sidebar-text" className="vg-prompt-sidebar-text">
        {text}
      </p>
    </div>
  );
}

function QuestionCard({ q }: { q: NonNullable<VideoUi['question']> }) {
  return (
    <div id="vg-question-overlay">
      <div className="vg-qs-left">
        <div className="vg-question-badge">
          <i className="fa-regular fa-comment-dots" /> Your Prompt
        </div>
        <div className="vg-question-quote">&ldquo;</div>
        <p id="vg-question-text" className="vg-question-text">
          {q.text}
        </p>
        <div className="vg-reroll-wrap">
          <div className="vg-reroll-dots" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`vg-reroll-dot${i >= q.rerollsLeft ? ' used' : ''}`} />
            ))}
          </div>
          <button
            type="button"
            id="btn-vg-reroll"
            className="vg-reroll-btn-qs"
            disabled={q.rerollsLeft <= 0}
            onClick={q.onReroll}
          >
            <i className="fa-solid fa-shuffle" /> Try another
          </button>
        </div>
        <p className="vg-reroll-hint">These are just a guide — speak naturally!</p>
      </div>
      <div className="vg-qs-right">
        <h2 className="vg-qs-cta-title">
          Speak from
          <br />
          the heart
        </h2>
        <button type="button" id="btn-vg-letsgo" className="vg-letsgo-btn" onClick={q.onGo}>
          Let's Go!
        </button>
      </div>
    </div>
  );
}

/** Saving, or a message with buttons, over the booth. */
function Processing({ ui }: { ui: VideoUi }) {
  const notice = ui.notice;
  if (notice?.kind === 'record-error') {
    return (
      <div id="vg-processing-overlay" role="alert">
        <i className="fa-solid fa-triangle-exclamation vg-notice-icon" />
        <h2 className="vg-notice-title">Recording Error</h2>
        <p className="vg-notice-text">{notice.message}</p>
        <div className="vg-notice-actions">
          <button
            type="button"
            id="btn-vg-record-error-retry"
            className="vg-notice-btn vg-notice-btn--retry"
            onClick={notice.onRetry}
          >
            <i className="fa-solid fa-rotate-right" /> Try Again
          </button>
          <button
            type="button"
            id="btn-vg-record-error-ok"
            className="vg-notice-btn"
            onClick={notice.onExit}
          >
            Return to Start
          </button>
        </div>
      </div>
    );
  }
  if (notice?.kind === 'short') {
    return (
      <div id="vg-processing-overlay" role="alert">
        <i className="fa-solid fa-clock vg-notice-icon" />
        <h2 className="vg-notice-title">Short Message</h2>
        <p className="vg-notice-text">
          Your recording is only {notice.secs} second{notice.secs === 1 ? '' : 's'} long. Would you
          like to keep recording?
        </p>
        <div className="vg-notice-actions">
          <button
            type="button"
            id="btn-vg-short-keep"
            className="vg-notice-btn"
            onClick={notice.onKeep}
          >
            Keep Recording
          </button>
          <button
            type="button"
            id="btn-vg-short-stop"
            className="vg-notice-btn vg-notice-btn--accent"
            onClick={notice.onStop}
          >
            Stop Anyway
          </button>
        </div>
      </div>
    );
  }
  if (!ui.saving) return null;
  return (
    <output id="vg-processing-overlay">
      <div className="spinner" aria-hidden="true" />
      <h2>Saving video…</h2>
    </output>
  );
}

function SaveError({ e }: { e: NonNullable<VideoUi['saveError']> }) {
  return (
    <div
      id="vg-save-error-overlay"
      role="alertdialog"
      aria-labelledby="vg-save-error-title"
      aria-describedby="vg-save-error-msg"
    >
      <div className="vg-save-error-icon" aria-hidden="true">
        <i className="fa-solid fa-triangle-exclamation" />
      </div>
      <h2 id="vg-save-error-title">Couldn't save your recording</h2>
      <p id="vg-save-error-msg">{e.message}</p>
      <div className="vg-save-error-actions">
        <button
          type="button"
          id="btn-vg-save-error-download"
          className="vg-btn vg-btn--primary"
          onClick={e.onDownload}
        >
          <i className="fa-solid fa-download" /> Download anyway
        </button>
        <button
          type="button"
          id="btn-vg-save-error-continue"
          className="vg-btn vg-btn--ghost"
          onClick={e.onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export function VideoBooth({ shown, ui }: { shown: boolean; ui: VideoUi }) {
  return (
    <div id="vg-booth" className="booth-container" style={shown ? undefined : HIDE}>
      <div className="viewfinder vg-viewfinder">
        <video
          id="vg-camera-feed"
          ref={(el) => registerFeed('video', el)}
          autoPlay
          playsInline
          muted
        />
        {ui.overlayUrl && (
          <img id="vg-overlay-live" className="vg-overlay-live" src={ui.overlayUrl} alt="" />
        )}

        {ui.countdown && (
          <div id="vg-countdown-overlay" key={ui.countdown.key} className="cd-pop">
            {ui.countdown.n}
          </div>
        )}

        {ui.splash && (
          <div id="vg-prompt-splash" className={ui.splash.leaving ? 'splash-fade-out' : undefined}>
            <div className="vg-splash-icon">
              <i className="fa-solid fa-microphone-lines" />
            </div>
            <p className="vg-splash-heading">Get Ready&hellip;</p>
            <p className="vg-splash-sub">
              Take a deep breath — your question is coming up.
              <br />
              Speak naturally and have fun!
            </p>
            <div className="vg-splash-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {ui.question && <QuestionCard q={ui.question} />}
        {/* A new question starts expanded. */}
        {ui.reminder && <Reminder key={ui.reminder} text={ui.reminder} />}

        {ui.recording && (
          <>
            <Hud startedAt={ui.recording.startedAt} maxSecs={ui.recording.maxSecs} />
            <div id="vg-controls">
              <button type="button" id="btn-vg-redo" className="vg-redo-btn" onClick={redo}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
                </svg>
                <span>Re-do</span>
              </button>
              <button type="button" id="btn-vg-stop" className="vg-stop-btn" onClick={onStopTapped}>
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                </svg>
                <span>Stop Recording</span>
              </button>
            </div>
          </>
        )}

        <Processing ui={ui} />
        {ui.saveError && <SaveError e={ui.saveError} />}
      </div>
    </div>
  );
}
