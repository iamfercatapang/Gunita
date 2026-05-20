// Camera and audio device enumeration + UI population.
//
// Replaces the four near-duplicate populate*/test* functions in the legacy
// app.js with a single typed manager driven by a `role` parameter. The PB
// and VG flows are 95 % identical — same getUserMedia probe to unlock
// labels, same enumerateDevices, same USB/external auto-prefer heuristic,
// same diagnostic HTML — so duplicating them in JS was load-bearing only
// for the differing DOM IDs and appConfig keys. Both now live in a single
// table here.
//
// The manager is DOM-aware: it renders the device list and diagnostic
// banner directly. We keep this coupling because the kiosk uses fixed IDs
// and the alternative (passing element refs through every call) costs more
// than it saves while we still have one legacy app.js consumer. Phase 4's
// React migration will move these IDs into props.

export type CameraRole = 'pb' | 'vg';

export interface DeviceManagerDeps {
  getCameraId(role: CameraRole): string;
  setCameraId(role: CameraRole, id: string): void;
  getMicId(): string;
  setMicId(id: string): void;
  getSpeakerId(): string;
  setSpeakerId(id: string): void;
  /** Optional debounced persist callback (legacy `_scheduleSave`). */
  scheduleSave?(): void;
}

interface RoleConfig {
  selectId: string;
  diagId: string;
  testCardId: string;
  testPreviewId: string;
  testInfoId: string;
  testButtonId: string;
}

const ROLE_DOM: Record<CameraRole, RoleConfig> = {
  pb: {
    selectId: 'camera-select',
    diagId: 'camera-diag',
    testCardId: 'camera-test-card',
    testPreviewId: 'camera-test-preview',
    testInfoId: 'camera-test-info',
    testButtonId: 'btn-test-camera',
  },
  vg: {
    selectId: 'vg-camera-select',
    diagId: 'vg-camera-diag',
    testCardId: 'vg-camera-test-card',
    testPreviewId: 'vg-camera-test-preview',
    testInfoId: 'vg-camera-test-info',
    testButtonId: 'btn-test-vg-camera',
  },
};

const AUDIO_DIAG_ID = 'vg-audio-diag';
const MIC_SELECT_ID = 'vg-mic-select';
const SPEAKER_SELECT_ID = 'vg-speaker-select';
const GRANT_OUTPUT_BTN_ID = 'btn-grant-audio-output';

const PREFERRED_LABEL_TOKENS = ['usb', 'external', 'dji', 'action', 'gopro'];

export class DeviceManager {
  private testStreams: Partial<Record<CameraRole, MediaStream>> = {};

  constructor(private deps: DeviceManagerDeps) {}

  // ─── Camera enumeration ──────────────────────────────────────────────────

  /**
   * Populate the camera <select> and diagnostic banner for the given role.
   * Probes `getUserMedia({video:true})` first so the browser reveals device
   * labels. Auto-selects the first USB/external/action camera when no
   * persisted choice exists. Returns the count of cameras found.
   */
  async populateCameraList(role: CameraRole): Promise<number> {
    const dom = ROLE_DOM[role];
    const sel = document.getElementById(dom.selectId) as HTMLSelectElement | null;
    if (!sel) return 0;

    this.setDiag(dom.diagId, '<span style="color:#9ca3af;">Scanning for cameras…</span>');

    try {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true });
        for (const t of probe.getTracks()) t.stop();
      } catch (permErr) {
        const name = (permErr as DOMException).name;
        this.setDiag(
          dom.diagId,
          `<span style="color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> Camera permission denied (${name}). Grant camera access in browser settings, then tap Refresh.</span>`,
        );
        sel.innerHTML = '<option value="">— permission denied —</option>';
        return 0;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      const previousValue = this.deps.getCameraId(role) || sel.value;

      sel.innerHTML = '';
      if (videoInputs.length === 0) {
        sel.innerHTML = '<option value="">No cameras found</option>';
        this.setDiag(
          dom.diagId,
          '<span style="color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> No cameras detected. Plug in your camera, then tap Refresh.</span>',
        );
        return 0;
      }

      const persistedId = this.deps.getCameraId(role);
      videoInputs.forEach((cam, i) => {
        const opt = document.createElement('option');
        opt.value = cam.deviceId;
        opt.textContent = cam.label || `Camera ${i + 1}`;
        const lbl = (cam.label || '').toLowerCase();
        if (!persistedId && PREFERRED_LABEL_TOKENS.some((t) => lbl.includes(t))) {
          opt.selected = true;
        }
        sel.appendChild(opt);
      });

      if (previousValue && Array.from(sel.options).some((o) => o.value === previousValue)) {
        sel.value = previousValue;
      }
      this.deps.setCameraId(role, sel.value);

      this.setDiag(dom.diagId, this.renderCameraDiagnostic(videoInputs));
      return videoInputs.length;
    } catch (e) {
      const err = e as DOMException;
      this.setDiag(
        dom.diagId,
        `<span style="color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.name} — ${err.message}</span>`,
      );
      console.warn(`[Devices] populateCameraList(${role})`, e);
      return 0;
    }
  }

  // ─── Audio device enumeration ────────────────────────────────────────────

  /**
   * Populate the VG mic and speaker <select>s plus the diagnostic banner.
   * Probes `getUserMedia({audio:true})` first so labels are exposed.
   * Returns the input/output counts.
   */
  async populateAudioDeviceList(): Promise<{ inputs: number; outputs: number }> {
    this.setDiag(AUDIO_DIAG_ID, '<span style="color:#9ca3af;">Scanning for audio devices…</span>');

    let probe: MediaStream | null = null;
    try {
      try {
        probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        const name = (e as DOMException).name;
        this.setDiag(
          AUDIO_DIAG_ID,
          `<span style="color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> Microphone permission denied (${name}). Grant microphone access in browser settings, then tap ↺ Refresh.</span>`,
        );
        return { inputs: 0, outputs: 0 };
      } finally {
        if (probe) for (const t of probe.getTracks()) t.stop();
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

      this.populateAudioSelect(
        MIC_SELECT_ID,
        audioInputs,
        '— Default microphone —',
        this.deps.getMicId(),
        'Microphone',
        (id) => this.deps.setMicId(id),
      );
      this.populateAudioSelect(
        SPEAKER_SELECT_ID,
        audioOutputs,
        '— Default speaker —',
        this.deps.getSpeakerId(),
        'Speaker',
        (id) => this.deps.setSpeakerId(id),
        audioOutputs.length === 0,
      );

      // Show "Grant Bluetooth Access" button when Chrome hides output labels
      // (selectAudioOutput() unblocks them).
      const hasBlankOutputLabel = audioOutputs.some((d) => !d.label);
      const grantBtn = document.getElementById(GRANT_OUTPUT_BTN_ID);
      if (grantBtn) {
        const supported =
          typeof (
            navigator.mediaDevices as MediaDevices & {
              selectAudioOutput?: () => Promise<MediaDeviceInfo>;
            }
          ).selectAudioOutput === 'function';
        grantBtn.style.display = hasBlankOutputLabel && supported ? '' : 'none';
      }

      this.setDiag(AUDIO_DIAG_ID, this.renderAudioDiagnostic(audioInputs, audioOutputs));
      return { inputs: audioInputs.length, outputs: audioOutputs.length };
    } catch (e) {
      const err = e as DOMException;
      this.setDiag(
        AUDIO_DIAG_ID,
        `<span style="color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.name} — ${err.message}</span>`,
      );
      console.warn('[Devices] populateAudioDeviceList', e);
      return { inputs: 0, outputs: 0 };
    }
  }

  // ─── Test camera preview ─────────────────────────────────────────────────

  /** Toggle the test preview for a role: open if closed, close if open. */
  async toggleCameraTest(role: CameraRole): Promise<void> {
    if (this.testStreams[role]) {
      this.stopCameraTest(role);
      return;
    }
    await this.startCameraTest(role);
  }

  private async startCameraTest(role: CameraRole): Promise<void> {
    const dom = ROLE_DOM[role];
    const btn = document.getElementById(dom.testButtonId) as HTMLButtonElement | null;
    const diag = document.getElementById(dom.diagId);
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Opening…';
    }
    try {
      const deviceId = this.deps.getCameraId(role);
      const constraints: MediaStreamConstraints = deviceId
        ? { video: { deviceId: { exact: deviceId } } }
        : { video: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.testStreams[role] = stream;

      const preview = document.getElementById(dom.testPreviewId) as HTMLVideoElement | null;
      if (preview) preview.srcObject = stream;

      const track = stream.getVideoTracks()[0];
      const info = document.getElementById(dom.testInfoId);
      if (info && track) {
        const settings = track.getSettings();
        info.textContent = `${track.label}  ·  ${settings.width || '?'} × ${settings.height || '?'}`;
      }

      const card = document.getElementById(dom.testCardId);
      if (card) card.style.display = '';
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Test';
      }
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Test';
      }
      if (diag) {
        const err = e as DOMException;
        diag.innerHTML = `<span style="color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> Could not open camera: <strong>${err.name}</strong> — ${err.message}</span>`;
      }
    }
  }

  /** Force-stop the test preview for a role. Safe to call repeatedly. */
  stopCameraTest(role: CameraRole): void {
    const stream = this.testStreams[role];
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      delete this.testStreams[role];
    }
    const dom = ROLE_DOM[role];
    const preview = document.getElementById(dom.testPreviewId) as HTMLVideoElement | null;
    if (preview) preview.srcObject = null;
    const card = document.getElementById(dom.testCardId);
    if (card) card.style.display = 'none';
    const btn = document.getElementById(dom.testButtonId);
    if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> Test';
  }

  /** Stop every active test preview. Called before kiosk launch. */
  stopAllCameraTests(): void {
    this.stopCameraTest('pb');
    this.stopCameraTest('vg');
  }

  // ─── DOM helpers ─────────────────────────────────────────────────────────

  private setDiag(id: string, html: string): void {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  private populateAudioSelect(
    id: string,
    devices: MediaDeviceInfo[],
    defaultLabel: string,
    previousValue: string,
    fallbackPrefix: string,
    onChange: (id: string) => void,
    showNoOutputs = false,
  ): void {
    const sel = document.getElementById(id) as HTMLSelectElement | null;
    if (!sel) return;
    sel.innerHTML = `<option value="">${defaultLabel}</option>`;
    if (showNoOutputs) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.disabled = true;
      opt.textContent = 'No output devices found';
      sel.appendChild(opt);
    } else {
      devices.forEach((dev, i) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        opt.textContent = dev.label || `${fallbackPrefix} ${i + 1}`;
        sel.appendChild(opt);
      });
    }
    if (previousValue && Array.from(sel.options).some((o) => o.value === previousValue)) {
      sel.value = previousValue;
    }
    onChange(sel.value);
  }

  private renderCameraDiagnostic(cameras: MediaDeviceInfo[]): string {
    const lines = cameras
      .map((cam, i) => {
        const lbl =
          cam.label ||
          '<em style="color:#f59e0b;">no label — tap Refresh after granting camera permission</em>';
        const shortId = cam.deviceId
          ? ` <span style="color:#9ca3af;font-family:monospace;font-size:0.72rem;">${cam.deviceId.slice(0, 10)}…</span>`
          : '';
        return `<span style="display:block;">[${i + 1}] ${lbl}${shortId}</span>`;
      })
      .join('');
    const hint = cameras.some((c) => !c.label)
      ? '<span style="color:#f59e0b; display:block; margin-top:3px;"><i class="fa-solid fa-triangle-exclamation"></i> Some cameras have no label — grant camera permission and tap Refresh.</span>'
      : '';
    return `<span style="font-weight:600;">${cameras.length} camera(s) detected:</span><span style="display:block; margin-top:2px;">${lines}</span>${hint}`;
  }

  private renderAudioDiagnostic(inputs: MediaDeviceInfo[], outputs: MediaDeviceInfo[]): string {
    const inputLines = inputs
      .map(
        (d, i) =>
          `<span style="display:block;">[${i + 1}] ${d.label || '<em style="color:#f59e0b;">no label</em>'}</span>`,
      )
      .join('');
    const outputLines = outputs
      .map(
        (d, i) =>
          `<span style="display:block;">[${i + 1}] ${d.label || '<em style="color:#f59e0b;">no label</em>'}</span>`,
      )
      .join('');
    const noOutputHint =
      outputs.length === 0
        ? '<span style="color:#f59e0b; display:block; margin-top:3px;"><i class="fa-solid fa-triangle-exclamation"></i> No audio output devices found — speaker selection not available on this browser/device.</span>'
        : '';
    const inputBlock = inputLines
      ? `<span style="display:block; margin-top:2px;">${inputLines}</span>`
      : '';
    const outputBlock = outputLines
      ? `<span style="display:block; margin-top:2px;">${outputLines}</span>`
      : '';
    return `<span style="font-weight:600;">${inputs.length} mic(s) · ${outputs.length} output(s) detected:</span>${inputBlock}${outputBlock}${noOutputHint}`;
  }
}
