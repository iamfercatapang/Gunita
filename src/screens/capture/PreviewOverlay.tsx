// Capture review: the recording plays back three times, with play/pause,
// seek and mute, until the guest taps Close Preview.
//
// The <video> is always mounted (hidden when there's nothing to review):
// at kiosk launch the audio controller routes it into the Bluetooth speaker
// with createMediaElementSource, which only works once per element.

import { useEffect, useRef, useState } from 'react';

import type { CaptureUi } from './store';

const PLAYS = 3;

const fmt = (s: number): string =>
  Number.isFinite(s)
    ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    : '0:00';

export function PreviewOverlay({ preview }: { preview: CaptureUi['preview'] }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const plays = useRef(0);
  const url = preview?.url ?? null;

  useEffect(() => {
    const video = ref.current;
    if (!video || !url) return;
    plays.current = 0;
    video.src = url;
    video.loop = false;
    video.muted = false;
    setMuted(false);
    setTime(0);
    setDuration(0);
    setMsg('Playing back your message…');

    const start = (): void => {
      video.play().catch(() => setMsg('Tap play to preview your message.'));
    };
    // Bluetooth routing from kiosk launch, when it worked; otherwise send it
    // to the chosen speaker directly, then play.
    const speaker = window.appConfig.vgSelectedSpeakerId;
    const sinkable = video as HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> };
    if (!window.PB.audio.hasPreviewRouting() && speaker && sinkable.setSinkId) {
      sinkable.setSinkId(speaker).then(start, start);
    } else {
      start();
    }

    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [url]);

  const onEnded = (): void => {
    plays.current += 1;
    const video = ref.current;
    if (video && plays.current < PLAYS) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      setMsg(null);
    }
  };

  const togglePlay = (): void => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const toggleMute = (): void => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  return (
    <div id="vg-preview-overlay" style={preview ? undefined : { display: 'none' }}>
      {/* biome-ignore lint/a11y/useMediaCaption: the guest's own recording */}
      <video
        id="vg-preview-video"
        ref={ref}
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={onEnded}
      />
      {msg && <p id="vg-preview-msg">{msg}</p>}
      <div id="vg-control-bar">
        <input
          type="range"
          id="vg-seek-bar"
          min={0}
          max={100}
          step={0.1}
          aria-label="Seek"
          value={duration > 0 && Number.isFinite(duration) ? (time / duration) * 100 : 0}
          onChange={(e) => {
            const video = ref.current;
            if (video?.duration)
              video.currentTime = (Number(e.target.value) / 100) * video.duration;
          }}
        />
        <div id="vg-controls-row">
          <button
            type="button"
            id="btn-vg-play-pause"
            title="Play / Pause"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={togglePlay}
          >
            <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`} />
          </button>
          <span id="vg-time-display">
            {fmt(time)} / {fmt(duration)}
          </span>
          <button
            type="button"
            id="btn-vg-mute"
            title="Mute / Unmute"
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={toggleMute}
          >
            <i className={`fa-solid ${muted ? 'fa-volume-xmark' : 'fa-volume-high'}`} />
          </button>
        </div>
      </div>
      <button
        type="button"
        id="btn-vg-preview-close"
        className="vg-btn vg-btn--primary"
        onClick={preview?.onClose}
      >
        <i className="fa-solid fa-check" /> Close Preview
      </button>
    </div>
  );
}
