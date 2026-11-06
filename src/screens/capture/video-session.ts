// The video guestbook session: open the camera and mic, show a prompt (if
// on), count down, record (with the host's overlay burned in, if set), then
// save, play it back, offer a photo, and show the done screen.

import {
  photoConstraints,
  resetToWelcome,
  showCameraLost,
  showDoneScreen,
  wantsDoneScreen,
} from './kiosk';
import { runPhotoSession } from './photo-session';
import {
  EMPTY_VIDEO,
  feed,
  nextKey,
  setBooth,
  setPreview,
  setVideo,
  sleep,
  visitGuard,
} from './store';

const SPLASH_FADE_OUT_MS = 400; // matches the CSS splash-fade-out animation
const MAX_REROLLS = 3;
/** Stopping before this asks the guest whether they meant to. */
const SHORT_WARN_SECS = 3;
/** A real recording is always bigger; anything smaller means the encoder stalled. */
const MIN_BLOB_BYTES = 10_240;
const VIDEO_BITRATE = 2_500_000;
const AUDIO_BITRATE = 128_000;
const OUT_W = 1920;
const OUT_H = 1080;

export interface VideoSessionOptions {
  /** Keep the guest's session (Drive folder) — a redo or retry. */
  continueSession?: boolean;
  /** Ask the same question again (redo). */
  promptText?: string | null;
}

// ─── Recording state ─────────────────────────────────────────────────────────

let recorder: MediaRecorder | null = null;
/** Bumped on every attempt, so a stale recorder's onstop is ignored. */
let token = 0;
let maxTimer: ReturnType<typeof setTimeout> | null = null;
let frameId: number | null = null;
let recordStart = 0;
/** The question from the current or last attempt, kept for a redo. */
let activePrompt: string | null = null;

function clearTimers(): void {
  if (maxTimer) clearTimeout(maxTimer);
  maxTimer = null;
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
}

/** Stop recording (which saves it). Safe to call more than once. */
export function stopRecording(): void {
  // Null it first, so a second call (max timer racing a tap) can't stop twice.
  const r = recorder;
  recorder = null;
  if (r && r.state !== 'inactive') {
    try {
      // Flush the last partial chunk so no audio or video is lost.
      if (r.state === 'recording') {
        try {
          r.requestData();
        } catch {
          // Some browsers throw here right before stopping; the stop still flushes.
        }
      }
      r.stop();
    } catch (e) {
      // Keep the reference so cleanup can be tried again later.
      recorder = r;
      console.warn('[VG] recorder.stop() threw:', (e as Error).message);
    }
  }
  clearTimers();
  window.PB.audio.stopMicMonitor();
  recordStart = 0;
  setVideo({ overlayUrl: null });
}

/** The guest tapped Stop. Very short recordings ask first. */
export function onStopTapped(): void {
  const secs = recordStart ? Math.floor((Date.now() - recordStart) / 1000) : 0;
  if (secs > 0 && secs < SHORT_WARN_SECS) {
    setVideo({
      notice: {
        kind: 'short',
        secs,
        onKeep: () => setVideo({ notice: null }),
        onStop: () => {
          setVideo({ notice: null });
          stopRecording();
        },
      },
    });
    return;
  }
  stopRecording();
}

/** Re-do: throw this recording away and start again with the same question. */
export function redo(): void {
  const r = recorder;
  recorder = null;
  if (r && r.state !== 'inactive') {
    r.onstop = null; // don't save it
    r.ondataavailable = null; // don't leak chunks into the next attempt
    try {
      r.stop();
    } catch {
      // Already stopping.
    }
  }
  clearTimers();
  window.PB.audio.stopMicMonitor();
  recordStart = 0;
  setVideo({ ...EMPTY_VIDEO });
  void runVideoSession({ continueSession: true, promptText: activePrompt });
}

/** The camera's track ended mid-session (cable pulled). */
export function onCameraLost(): void {
  stopRecording();
  showCameraLost();
}

function showRecordError(message: string): void {
  setVideo({
    saving: false,
    notice: {
      kind: 'record-error',
      message,
      onRetry: () => {
        setVideo({ notice: null });
        void runVideoSession({ continueSession: true, promptText: activePrompt });
      },
      onExit: () => {
        setVideo({ notice: null });
        resetToWelcome();
      },
    },
  });
}

function cameraOpenMessage(err: Error): string {
  switch (err.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied. Please grant access in browser settings.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Camera not found. Check the connection and try again.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera is in use by another app. Close it and try again.';
    default:
      return err.message || err.name || 'Could not open camera.';
  }
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

/** The splash, then the question card. Resolves with the question once the guest taps Let's Go. */
async function askQuestion(prompts: string[], fixed: string | null | undefined): Promise<string> {
  const c = window.appConfig;
  const pick = (): string => prompts[Math.floor(Math.random() * prompts.length)] as string;
  // A redo asks the same question again.
  let text = fixed || pick();
  activePrompt = text;

  setVideo({ splash: { leaving: false } });
  await sleep(c.vgSplashDuration * 1000);
  setVideo({ splash: { leaving: true } });
  await sleep(SPLASH_FADE_OUT_MS);
  setVideo({ splash: null });

  let rerollsLeft = MAX_REROLLS;
  await new Promise<void>((resolve) => {
    const show = (): void =>
      setVideo({
        question: {
          text,
          rerollsLeft,
          onReroll: () => {
            if (rerollsLeft <= 0) return;
            rerollsLeft -= 1;
            text = pick();
            activePrompt = text;
            show();
          },
          onGo: resolve,
        },
      });
    show();
  });
  setVideo({ question: null });
  return text;
}

// ─── Session ─────────────────────────────────────────────────────────────────

function pickMimeType(): string {
  const options = ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus'];
  return options.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
}

function makeRecorder(stream: MediaStream, mimeType: string): MediaRecorder {
  // Bitrate caps keep the encoder from saturating the CPU.
  try {
    return new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITRATE,
      audioBitsPerSecond: AUDIO_BITRATE,
    });
  } catch (e) {
    console.warn('[VG] MediaRecorder with bitrates failed, retrying with mimeType only:', e);
    try {
      return new MediaRecorder(stream, { mimeType });
    } catch (e2) {
      console.warn('[VG] MediaRecorder with mimeType failed, using defaults:', e2);
      return new MediaRecorder(stream);
    }
  }
}

/** Draw camera + overlay onto a canvas and record that, with the camera's audio. */
function compositeStream(video: HTMLVideoElement, overlay: HTMLImageElement): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not set up the overlay.');
  const draw = (): void => {
    // Cover-fit and mirrored, so 4:3 or vertical cameras aren't stretched.
    window.PB.capture.drawCoverFrame(
      ctx,
      video,
      video.videoWidth || OUT_W,
      video.videoHeight || OUT_H,
      0,
      0,
      OUT_W,
      OUT_H,
      { mirror: true },
    );
    ctx.drawImage(overlay, 0, 0, OUT_W, OUT_H);
    frameId = requestAnimationFrame(draw);
  };
  draw();
  const audio = window.currentStream?.getAudioTracks() ?? [];
  return new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...audio]);
}

export async function runVideoSession(opts: VideoSessionOptions = {}): Promise<void> {
  const myToken = ++token;
  const c = window.appConfig;
  let stage = 'init';
  try {
    stage = 'session-start';
    if (!opts.continueSession) window.startNewSession();

    // Opens the camera and mic (reuses them on a redo).
    stage = 'stream-acquire';
    await window.PB.capture.camera.acquire({
      cameraId: c.vgSelectedCameraId || '',
      micId: c.vgSelectedMicId || '',
    });
    const stream = window.currentStream;
    const video = feed('video');
    if (!stream || !video) throw new Error('The camera view is not on the page.');

    setBooth('video');
    video.srcObject = stream;
    const sinkable = video as HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> };
    if (c.vgSelectedSpeakerId && sinkable.setSinkId) {
      try {
        await sinkable.setSinkId(c.vgSelectedSpeakerId);
      } catch {
        // Unsupported or not allowed; the default output still works.
      }
    }
    await video.play().catch(() => {});

    // Camera-lost watchdog, for each fresh stream.
    for (const track of stream.getVideoTracks()) {
      track.onended = () => {
        console.warn('[VG] Camera track ended unexpectedly.');
        onCameraLost();
      };
    }

    setVideo({ overlayUrl: c.vgOverlay?.objectUrl ?? null });

    let question: string | null = null;
    if (c.vgPromptsEnabled) {
      const prompts = window.PB.prompts.enabled();
      if (prompts.length > 0) question = await askQuestion(prompts, opts.promptText);
    }
    // The reminder stays up through the countdown and recording (it's on the
    // page, not in the video).
    setVideo({ reminder: question });

    for (let n = c.vgCountdown; n >= 1; n--) {
      setVideo({ countdown: { n, key: nextKey() } });
      window.PB.audio.beep(n === 1 ? 880 : 660, 0.12);
      await sleep(1000);
    }
    setVideo({ countdown: null });

    const recordStream = c.vgOverlay ? compositeStream(video, c.vgOverlay.img) : stream;

    // The camera may have dropped during the prompt or countdown.
    stage = 'liveness-check';
    const camTrack = stream.getVideoTracks()[0];
    if (!camTrack || camTrack.readyState !== 'live') {
      throw new Error(
        `Camera is no longer available (readyState: ${camTrack ? camTrack.readyState : 'none'})`,
      );
    }

    stage = 'recorder-setup';
    const mimeType = pickMimeType();
    const chunks: Blob[] = [];
    const rec = makeRecorder(recordStream, mimeType);
    recorder = rec;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    let saved = false;
    const left = visitGuard();
    rec.onstop = () => {
      // A redo started a newer attempt, or onstop fired twice (mobile quirk).
      if (myToken !== token || saved) return;
      saved = true;
      clearTimers();
      if (!left()) setVideo({ overlayUrl: null, reminder: null, recording: null, saving: true });
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size < MIN_BLOB_BYTES) {
        if (left()) return;
        showRecordError(
          'No video data was captured (the encoder may have stalled). Please try again.',
        );
        return;
      }
      void saveVideo(blob, mimeType.startsWith('video/mp4') ? 'mp4' : 'webm', left);
    };
    rec.onerror = (e) => {
      const err = (e as Event & { error?: Error }).error;
      console.error('[VG] MediaRecorder error:', err ?? e);
      stopRecording();
      showRecordError(err?.message || 'Encoder error');
    };

    rec.start(500); // a chunk every 500 ms
    window.PB.audio.startMicMonitor(recordStream);
    stage = 'recording';
    recordStart = Date.now();
    setVideo({ recording: { startedAt: recordStart, maxSecs: c.vgMaxDuration } });
    window.PB.audio.beep(880, 0.08, 0.35); // recording-start cue

    // Stop at the time limit, checked against the wall clock in case a
    // suspended tab fires the timer early.
    const maxMs = c.vgMaxDuration * 1000;
    maxTimer = setTimeout(() => {
      if (recordStart && Date.now() - recordStart < maxMs - 500) return;
      stopRecording();
    }, maxMs);
  } catch (e) {
    const err = e as Error;
    console.error(`[VG] Fatal error in VG sequence [stage: ${stage}]:`, err);
    stopRecording();
    if (err?.message?.startsWith('Camera is no longer available')) {
      showCameraLost();
    } else if (stage === 'stream-acquire') {
      setBooth('video');
      showRecordError(cameraOpenMessage(err));
    } else if (stage === 'recorder-setup' || stage === 'recording') {
      showRecordError(err?.message || 'An unexpected error occurred.');
    } else {
      resetToWelcome();
    }
  }
}

// ─── After recording ─────────────────────────────────────────────────────────

/** Local save failed: let the guest download it instead. Resolves on Continue. */
function showSaveError(blob: Blob, ext: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    setVideo({
      saveError: {
        message: message || 'The recording could not be written to disk.',
        onDownload: () => window.PB.capture.downloadBlob(blob, `recording_recovery.${ext}`),
        onContinue: () => {
          setVideo({ saveError: null });
          resolve();
        },
      },
    });
  });
}

function playPreview(url: string): Promise<void> {
  return new Promise((resolve) => {
    setPreview({
      url,
      onClose: () => {
        setPreview(null);
        resolve();
      },
    });
  });
}

/**
 * `left` is the recording's visit guard: saving always finishes, the screens
 * only if the guest is still here.
 */
async function saveVideo(blob: Blob, ext: string, left: () => boolean): Promise<void> {
  const c = window.appConfig;

  // Close the camera and mic now. A Bluetooth headset mic left open keeps
  // iPadOS and Android in "call" audio, so the preview would play into the
  // headset instead of the speaker. Freeze the last frame first: it's the
  // photo offer's backdrop, and the feed goes blank once the camera closes.
  window.PB.ui.freezeOfferBackdrop(feed('video'));
  window.PB.audio.stopMicMonitor();
  window.PB.capture.camera.release();

  const filename = window.PB.capture.makeFilename(c.eventName || 'guestbook', ext);

  // Galleries keep the blob URL for playback, so it isn't revoked here.
  const url = URL.createObjectURL(blob);
  const captureId = window.PB.captures.add('video', url);
  window.PB.liveViewer.host.broadcastVideo(url, filename);

  if (c.vgSaveLocal) {
    try {
      await window.PB.capture.saveBlobLocally(blob, filename, {
        directoryHandle: window.directoryHandle,
        sessionId: window.currentSessionId,
      });
    } catch (e) {
      const err = e as Error;
      const message = err.message || `Could not write file: ${err.name}`;
      if (left()) console.error('[VG] Save error:', message);
      else await showSaveError(blob, ext, message);
    }
  }

  // Drive: in the background; the client queues it if the network is down.
  if (c.vgSaveDrive && window.PB.drive.isSignedIn()) {
    window.PB.drive
      .upload('video-guestbook', blob, filename)
      .then(() => {
        const link = window.currentSessionFolderLink;
        if (link) {
          window.PB.captures.setDriveUrl(captureId, link);
          window.PB.liveViewer.host.broadcastDriveUpdate(filename, link);
        }
      })
      .catch((e: Error) => console.warn('[Drive] VG upload failed:', e.message));
  }

  if (left()) return;
  setVideo({ saving: false });

  if (c.vgCaptureReviewEnabled) await playPreview(url);
  if (left()) return;

  if (c.vgOfferPb && (await window.PB.ui.offerPhotoBooth())) {
    if (left()) return;
    // Re-open the same camera, video only, for the photos.
    try {
      await window.PB.capture.camera.acquirePhotoCamera(
        c.vgSelectedCameraId || '',
        photoConstraints(),
      );
    } catch (err) {
      console.error('[VG→PB] Could not re-open the camera for the photo booth:', err);
      showCameraLost();
      return;
    }
    // Same session, so the photos land in the video's Drive folder.
    // The photo session shows the done screen and returns to welcome.
    await runPhotoSession({ continueSession: true });
    return;
  }

  if (left()) return;
  if (wantsDoneScreen()) await showDoneScreen();
  if (!left()) resetToWelcome();
}
