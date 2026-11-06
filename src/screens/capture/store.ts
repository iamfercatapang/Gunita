// What the kiosk capture screens show (Phase 4f). The session code
// (photo-session.ts, video-session.ts) sets it; the React screens render it
// and report the guest's taps back through the resolvers stored here.
//
// No React import, so the session code can run without the UI chunk.

export type Booth = 'none' | 'photo' | 'video';

export interface PhotoUi {
  /** "Show your best pose": how many photos the guest will take. */
  splash: { count: number; leaving: boolean } | null;
  /**
   * The countdown number; `key` changes on every tick to restart the
   * animation, and `active` goes false to fade the last number out.
   */
  countdown: { n: number; key: number; active: boolean } | null;
  /** Changes on every shutter, to replay the flash. */
  flashKey: number;
  /** "Photo 2 of 4", for multi-photo layouts. */
  shot: { n: number; of: number } | null;
  /** The finished strip, shown in place of the camera during the review hold. */
  strip: HTMLCanvasElement | null;
  saving: boolean;
  reviewBadge: boolean;
}

/** A message over the video booth, with its buttons. */
export type VideoNotice =
  | { kind: 'record-error'; message: string; onRetry: () => void; onExit: () => void }
  | { kind: 'short'; secs: number; onKeep: () => void; onStop: () => void };

export interface VideoUi {
  splash: { leaving: boolean } | null;
  /** The question card before recording; `onReroll` is null once rerolls run out. */
  question: {
    text: string;
    rerollsLeft: number;
    onReroll: () => void;
    onGo: () => void;
  } | null;
  /** The prompt reminder in the corner during the countdown and recording. */
  reminder: string | null;
  countdown: { n: number; key: number } | null;
  /** Set while recording: drives the REC badge, timers and Stop/Re-do. */
  recording: { startedAt: number; maxSecs: number } | null;
  /** The overlay image shown live over the viewfinder. */
  overlayUrl: string | null;
  saving: boolean;
  notice: VideoNotice | null;
  /** Local save failed: offer a download of the recording. */
  saveError: { message: string; onDownload: () => void; onContinue: () => void } | null;
}

export interface CaptureUi {
  booth: Booth;
  photo: PhotoUi;
  video: VideoUi;
  /** The recording's playback before it's saved; resolves on Close. */
  preview: { url: string; onClose: () => void } | null;
  /** Shown when the camera is unplugged mid-session. */
  cameraLost: { status: string; busy: boolean } | null;
}

export const EMPTY_PHOTO: PhotoUi = {
  splash: null,
  countdown: null,
  flashKey: 0,
  shot: null,
  strip: null,
  saving: false,
  reviewBadge: false,
};

export const EMPTY_VIDEO: VideoUi = {
  splash: null,
  question: null,
  reminder: null,
  countdown: null,
  recording: null,
  overlayUrl: null,
  saving: false,
  notice: null,
  saveError: null,
};

let state: CaptureUi = {
  booth: 'none',
  photo: EMPTY_PHOTO,
  video: EMPTY_VIDEO,
  preview: null,
  cameraLost: null,
};
const listeners = new Set<() => void>();

function commit(next: CaptureUi): void {
  state = next;
  for (const l of listeners) l();
}

export function getCaptureUi(): CaptureUi {
  return state;
}

export function subscribeCaptureUi(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setBooth(booth: Booth): void {
  if (state.booth !== booth) commit({ ...state, booth });
}

export function setPhoto(patch: Partial<PhotoUi>): void {
  commit({ ...state, photo: { ...state.photo, ...patch } });
}

export function setVideo(patch: Partial<VideoUi>): void {
  commit({ ...state, video: { ...state.video, ...patch } });
}

export function setPreview(preview: CaptureUi['preview']): void {
  commit({ ...state, preview });
}

export function setCameraLost(cameraLost: CaptureUi['cameraLost']): void {
  commit({ ...state, cameraLost });
}

/** Back to idle: no booth, nothing on screen. */
export function resetCaptureUi(): void {
  commit({ ...state, booth: 'none', photo: EMPTY_PHOTO, video: EMPTY_VIDEO });
}

// ─── Video elements ──────────────────────────────────────────────────────────
// The booths' <video> elements stay mounted for the life of the page; the
// session code needs them to draw photos and composite the overlay.

const feeds: { photo: HTMLVideoElement | null; video: HTMLVideoElement | null } = {
  photo: null,
  video: null,
};

export function registerFeed(which: 'photo' | 'video', el: HTMLVideoElement | null): void {
  feeds[which] = el;
}

export function feed(which: 'photo' | 'video'): HTMLVideoElement | null {
  return feeds[which];
}

// ─── Kiosk visits ────────────────────────────────────────────────────────────
// Leaving the kiosk starts a new visit. A session from an earlier visit (say,
// a recording stopped by Exit, still saving) finishes saving its files but
// stops driving the screen, so nothing from it pops up next time.

let visit = 0;

export function newVisit(): void {
  visit += 1;
}

/** Returns a check that's true once the kiosk has been left since this call. */
export function visitGuard(): () => boolean {
  const mine = visit;
  return () => mine !== visit;
}

// ─── Small helpers ───────────────────────────────────────────────────────────

let tickKey = 0;
/** A fresh key, to restart a CSS animation by remounting its element. */
export function nextKey(): number {
  tickKey += 1;
  return tickKey;
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
