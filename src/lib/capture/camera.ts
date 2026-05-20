// Video Guestbook camera lifecycle.
//
// Owns the MediaStream used during a VG recording session: opens video + audio
// at the configured device IDs, releases tracks cleanly between sessions, and
// re-acquires after an unexpected track-end (cable yank, OS-level mute).
//
// To minimise churn in the legacy app.js callers, every acquire/release also
// writes to `window.currentStream` — the existing 35 read-sites in app.js
// continue to work. When the React migration in Phase 4 splits those flows
// into hooks, the window mirror can come out.

import type { VgStreamConstraints } from './types';

const VIDEO_CONSTRAINTS = {
  width: { ideal: 1920, max: 1920 },
  height: { ideal: 1080, max: 1080 },
  frameRate: { ideal: 30, max: 30 },
} as const;

/** ID of the <video> element wired to the VG viewfinder. */
const VG_FEED_EL_ID = 'vg-camera-feed';

export interface VgCameraManagerDeps {
  /** Called when a video track ends unexpectedly (cable yank, OS mute). */
  onCameraLost?(): void;
}

export class VgCameraManager {
  constructor(private deps: VgCameraManagerDeps = {}) {}

  /**
   * Acquire video + audio for a recording session. Reuses the existing
   * stream if it already has a live video track (e.g. during a "redo");
   * otherwise opens fresh tracks at the configured device IDs.
   *
   * If the requested mic isn't available the call falls back to the
   * default mic, and finally to a video-only stream — captures still
   * record without audio rather than failing the whole session.
   */
  async acquire(constraints: VgStreamConstraints): Promise<MediaStream> {
    if (window.currentStream && hasLiveVideoTrack(window.currentStream)) {
      return window.currentStream;
    }
    this.stopExisting();

    const videoConstraints: MediaTrackConstraints = { ...VIDEO_CONSTRAINTS };
    if (constraints.cameraId) {
      videoConstraints.deviceId = { exact: constraints.cameraId };
    }
    const videoStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });

    const audioTracks = await this.acquireAudio(constraints.micId);
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);
    window.currentStream = stream;
    this.attachTrackWatchdog(stream);
    return stream;
  }

  /**
   * Re-acquire after a `cameraLost` event. Same flow as `acquire()` but always
   * forces a fresh open (does not reuse), and attaches the watchdog so a
   * subsequent loss surfaces again.
   */
  async reacquire(constraints: VgStreamConstraints): Promise<MediaStream> {
    this.stopExisting();
    return this.acquire(constraints);
  }

  /**
   * Stop every track and clear the viewfinder element. Safe to call repeatedly.
   * Called between recording sessions to extinguish the OS recording indicator.
   */
  release(): void {
    this.stopExisting();
    const feed = document.getElementById(VG_FEED_EL_ID) as HTMLVideoElement | null;
    if (feed) feed.srcObject = null;
  }

  /** Returns the current stream or null. */
  current(): MediaStream | null {
    return window.currentStream;
  }

  /** True if the current stream has at least one live video track. */
  isLive(): boolean {
    return window.currentStream !== null && hasLiveVideoTrack(window.currentStream);
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private stopExisting(): void {
    const stream = window.currentStream;
    if (!stream) return;
    for (const t of stream.getTracks()) {
      try {
        t.stop();
      } catch {
        // ignore — track may already be ended
      }
    }
    window.currentStream = null;
  }

  private async acquireAudio(micId: string): Promise<MediaStreamTrack[]> {
    try {
      const constraint: MediaTrackConstraints | boolean = micId
        ? { deviceId: { exact: micId } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraint });
      return stream.getAudioTracks();
    } catch (e) {
      console.warn('[VG] Requested mic unavailable, trying default:', (e as Error).message);
      try {
        const fallback = await navigator.mediaDevices.getUserMedia({ audio: true });
        return fallback.getAudioTracks();
      } catch (e2) {
        console.warn('[VG] No audio track available:', (e2 as Error).message);
        return [];
      }
    }
  }

  private attachTrackWatchdog(stream: MediaStream): void {
    for (const track of stream.getVideoTracks()) {
      track.onended = (): void => {
        console.warn('[VG] Camera track ended unexpectedly.');
        this.deps.onCameraLost?.();
      };
    }
  }
}

function hasLiveVideoTrack(stream: MediaStream): boolean {
  return stream.getVideoTracks().some((t) => t.readyState === 'live');
}
