// Centralised audio controller for the kiosk.
//
// Replaces the scattered _vgMic*, _audioCtx, _sinkBeep*, and _previewVideo*
// state in the legacy app.js with one disposable instance that owns:
//
//   • Mic-level silence detection during a VG recording, with a small
//     RMS-threshold + grace period to suppress flapping. Updates a DOM
//     status badge (#vg-mic-badge) so the guest sees mic state at a glance.
//
//   • A pre-wired Bluetooth sink: a hidden Audio element with setSinkId()
//     applied to the chosen speaker, fed by a MediaStreamDestination. This
//     lets countdown beeps and capture-review playback route to a JBL/BT
//     speaker even when the OS default output is the USB mic device
//     (a real Android quirk we hit in production).
//
//   • Beep playback that prefers the BT sink and falls back to the default
//     destination so the workflow never goes silent.
//
//   • A one-shot speaker test that plays an 880 Hz tone on a specified
//     sinkId; used by the admin "Test" button.
//
// The controller is intentionally DOM-aware (it touches the mic badge and
// preview-video elements by ID) — the kiosk uses fixed IDs and the alternative
// (passing element refs through every call site) costs more than it saves
// while we still have a single legacy app.js consumer. When the React
// migration in Phase 4 splits the kiosk into components, these IDs will
// move into props.

const MIC_BADGE_CONTAINER_ID = 'vg-mic-badge';
const MIC_BADGE_ICON_ID = 'vg-mic-icon';
const MIC_BADGE_LABEL_ID = 'vg-mic-label';
const PREVIEW_VIDEO_ID = 'vg-preview-video';

const SILENCE_THRESHOLD_RMS = 0.01;
const SILENCE_GRACE_MS = 3000;

export type MicBadgeState = 'ok' | 'muted' | 'none';

interface SinkPipeline {
  ctx: AudioContext;
  dest: MediaStreamAudioDestinationNode;
  el: HTMLAudioElement;
  previewSourceNode: MediaElementAudioSourceNode | null;
}

export class AudioController {
  // ─── Mic monitor state ───────────────────────────────────────────────────
  private micCtx: AudioContext | null = null;
  private micRaf: number | null = null;
  private micSilenceStart: number | null = null;

  // ─── Beep / sink state ───────────────────────────────────────────────────
  private beepCtx: AudioContext | null = null;
  private sink: SinkPipeline | null = null;

  // ─── Mic monitoring ──────────────────────────────────────────────────────

  /**
   * Begin monitoring the audio track on the recording stream. Updates the
   * mic badge in real time:
   *   - 'none'  : no audio track on the stream
   *   - 'muted' : track is hardware-muted, OR RMS has stayed below threshold
   *               for SILENCE_GRACE_MS
   *   - 'ok'    : audio is flowing and the track is live
   */
  startMicMonitor(stream: MediaStream): void {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      this.setMicBadge('none');
      return;
    }
    const track = audioTracks[0];
    if (!track) {
      this.setMicBadge('none');
      return;
    }
    this.setMicBadge(track.readyState !== 'live' || track.muted ? 'muted' : 'ok');

    track.onmute = () => this.setMicBadge('muted');
    track.onunmute = () => {
      this.micSilenceStart = null;
      this.setMicBadge('ok');
    };

    try {
      const Ctx =
        window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.micCtx = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);

      const tick = (): void => {
        if (this.micCtx !== ctx) return; // monitor was stopped or replaced
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = buffer[i] ?? 0;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);

        if (rms < SILENCE_THRESHOLD_RMS) {
          if (this.micSilenceStart === null) this.micSilenceStart = Date.now();
          if (Date.now() - this.micSilenceStart >= SILENCE_GRACE_MS) {
            this.setMicBadge('muted');
          }
        } else {
          this.micSilenceStart = null;
          if (!track.muted && track.readyState === 'live') this.setMicBadge('ok');
        }
        this.micRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn('[Audio] Mic analyser unavailable:', e);
    }
  }

  /** Stop the analyser loop and tear down the monitor's AudioContext. */
  stopMicMonitor(): void {
    if (this.micRaf !== null) {
      cancelAnimationFrame(this.micRaf);
      this.micRaf = null;
    }
    if (this.micCtx) {
      try {
        void this.micCtx.close();
      } catch {
        // Already closed; ignore.
      }
      this.micCtx = null;
    }
    this.micSilenceStart = null;
    const badge = document.getElementById(MIC_BADGE_CONTAINER_ID);
    if (badge) badge.style.display = 'none';
  }

  /** Set the mic badge UI directly (used by stream lifecycle code). */
  setMicBadge(state: MicBadgeState): void {
    const badge = document.getElementById(MIC_BADGE_CONTAINER_ID);
    const icon = document.getElementById(MIC_BADGE_ICON_ID);
    const label = document.getElementById(MIC_BADGE_LABEL_ID);
    if (!badge || !icon || !label) return;
    badge.style.display = 'flex';
    badge.className = state === 'ok' ? 'mic-ok' : state === 'muted' ? 'mic-muted' : 'mic-none';
    if (state === 'ok') {
      icon.className = 'fa-solid fa-microphone';
      label.textContent = 'Mic';
    } else if (state === 'muted') {
      icon.className = 'fa-solid fa-microphone-slash';
      label.textContent = 'Muted';
    } else {
      icon.className = 'fa-solid fa-microphone-slash';
      label.textContent = 'No mic';
    }
  }

  // ─── Bluetooth sink pre-wiring ───────────────────────────────────────────

  /**
   * Pre-wire countdown beeps and the capture-review video to a specific
   * audio output (typically a Bluetooth speaker). Must be called from a
   * user-gesture context (kiosk launch) so the Audio element can play()
   * without prompting again.
   *
   * Implementation: a fresh AudioContext feeds a MediaStreamDestination,
   * which feeds a hidden Audio element. The Audio element gets setSinkId()
   * applied so it routes to the chosen device, bypassing any OS-default
   * routing that would otherwise hijack output (e.g. Android sending audio
   * to a USB mic by mistake).
   */
  async setupSinkBeep(sinkId: string): Promise<void> {
    this.teardownSinkBeep();
    if (!sinkId || typeof Audio === 'undefined') return;
    const proto = Audio.prototype as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (typeof proto.setSinkId !== 'function') return;

    const Ctx =
      window.AudioContext ||
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    let ctx: AudioContext | null = null;
    try {
      ctx = new Ctx();
      const dest = ctx.createMediaStreamDestination();
      const el = new Audio();
      el.srcObject = dest.stream;
      const elWithSink = el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> };
      await elWithSink.setSinkId(sinkId);
      el.play().catch(() => {});

      // Route the capture-review video through the same BT sink. createMedia-
      // ElementSource silences the element's native output and sends audio
      // through dest → el → BT speaker, bypassing the OS default.
      let previewSourceNode: MediaElementAudioSourceNode | null = null;
      const previewVid = document.getElementById(PREVIEW_VIDEO_ID) as HTMLVideoElement | null;
      if (previewVid) {
        try {
          previewSourceNode = ctx.createMediaElementSource(previewVid);
          previewSourceNode.connect(dest);
        } catch (e) {
          console.warn('[Audio] Preview video routing failed:', e);
        }
      }
      this.sink = { ctx, dest, el, previewSourceNode };
    } catch (e) {
      console.warn('[Audio] setupSinkBeep failed:', e);
      if (ctx) {
        try {
          await ctx.close();
        } catch {
          // ignore
        }
      }
      this.sink = null;
    }
  }

  /** Disconnect and close the BT sink pipeline. */
  teardownSinkBeep(): void {
    if (!this.sink) return;
    if (this.sink.previewSourceNode) {
      try {
        this.sink.previewSourceNode.disconnect();
      } catch {
        // ignore
      }
    }
    if (this.sink.ctx.state !== 'closed') {
      this.sink.ctx.close().catch(() => {});
    }
    this.sink = null;
  }

  /** True if the capture-review video is currently routed through the BT sink. */
  hasPreviewRouting(): boolean {
    return this.sink !== null && this.sink.previewSourceNode !== null;
  }

  // ─── Beeps ──────────────────────────────────────────────────────────────

  /**
   * Play a short oscillator tone. Routes through the pre-wired BT sink if
   * available, otherwise the default output. Fire-and-forget; never throws.
   */
  beep(freq: number, duration: number, volume = 0.45): void {
    try {
      let ctx: AudioContext;
      let dest: AudioNode;
      if (this.sink && this.sink.ctx.state !== 'closed') {
        ctx = this.sink.ctx;
        dest = this.sink.dest;
      } else {
        ctx = this.getDefaultCtx();
        dest = ctx.destination;
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio not available — silent fallback.
    }
  }

  // ─── Speaker test ────────────────────────────────────────────────────────

  /**
   * Play an 880 Hz test tone on a specific output device. Used by the
   * admin "Test Speaker" button. Independent of the pre-wired BT sink so
   * the admin can verify any output without disturbing kiosk routing.
   */
  testSpeakerOutput(sinkId: string): void {
    try {
      const Ctx =
        window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const dest = ctx.createMediaStreamDestination();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);

      const el = new Audio();
      el.srcObject = dest.stream;
      const startPlay = (): void => {
        el.play().catch(() => {});
        setTimeout(() => {
          el.srcObject = null;
          ctx.close().catch(() => {});
        }, 1200);
      };
      const elWithSink = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      if (sinkId && typeof elWithSink.setSinkId === 'function') {
        elWithSink.setSinkId(sinkId).then(startPlay).catch(startPlay);
      } else {
        startPlay();
      }
    } catch {
      // Audio not available — silent fallback.
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /** Tear everything down — call on kiosk exit. */
  dispose(): void {
    this.stopMicMonitor();
    this.teardownSinkBeep();
    if (this.beepCtx && this.beepCtx.state !== 'closed') {
      this.beepCtx.close().catch(() => {});
    }
    this.beepCtx = null;
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private getDefaultCtx(): AudioContext {
    if (!this.beepCtx || this.beepCtx.state === 'closed') {
      const Ctx =
        window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) throw new Error('AudioContext unavailable');
      this.beepCtx = new Ctx();
    }
    if (this.beepCtx.state === 'suspended') {
      this.beepCtx.resume().catch(() => {});
    }
    return this.beepCtx;
  }
}
