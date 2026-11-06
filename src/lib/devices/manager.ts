// Camera and audio device enumeration, plus the camera test preview.
//
// One manager serves both camera roles (Photo Booth and Video Guestbook):
// the same getUserMedia probe to unlock labels, the same enumerateDevices,
// the same USB/external auto-prefer heuristic.
//
// Phase 4e: the manager no longer touches the DOM. It publishes what it found
// as state (getState / subscribe) and the admin panels render it. The chosen
// device ids still live in appConfig, through the deps.

export type CameraRole = 'pb' | 'vg';

export interface DeviceManagerDeps {
  getCameraId(role: CameraRole): string;
  setCameraId(role: CameraRole, id: string): void;
  getMicId(): string;
  setMicId(id: string): void;
  getSpeakerId(): string;
  setSpeakerId(id: string): void;
}

export interface DeviceOption {
  id: string;
  /** Label to show; a numbered fallback when the browser hides the name. */
  label: string;
  /** False when the browser gave no label (permission not granted yet). */
  hasLabel: boolean;
}

/** What the last scan found, or why it found nothing. */
export type ScanStatus =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'denied'; name: string }
  | { kind: 'error'; name: string; message: string }
  | { kind: 'done' };

export interface CameraListState {
  status: ScanStatus;
  devices: readonly DeviceOption[];
}

export interface AudioListState {
  status: ScanStatus;
  mics: readonly DeviceOption[];
  speakers: readonly DeviceOption[];
  /** Chrome hides Bluetooth output names until selectAudioOutput() is called. */
  canGrantOutput: boolean;
  /** Last error from Grant Bluetooth Access, if any. */
  grantError: string | null;
}

export type CameraTestState =
  | { kind: 'off'; error: string | null }
  | { kind: 'opening' }
  | { kind: 'on'; stream: MediaStream; info: string };

export interface DeviceState {
  cameras: Readonly<Record<CameraRole, CameraListState>>;
  audio: AudioListState;
  tests: Readonly<Record<CameraRole, CameraTestState>>;
}

const PREFERRED_LABEL_TOKENS = ['usb', 'external', 'dji', 'action', 'gopro'];

type SelectAudioOutput = (opts?: { deviceId?: string }) => Promise<MediaDeviceInfo>;

function selectAudioOutputFn(): SelectAudioOutput | null {
  const md = navigator.mediaDevices as MediaDevices & { selectAudioOutput?: SelectAudioOutput };
  return typeof md.selectAudioOutput === 'function' ? md.selectAudioOutput.bind(md) : null;
}

function toOptions(devices: MediaDeviceInfo[], fallbackPrefix: string): DeviceOption[] {
  return devices.map((d, i) => ({
    id: d.deviceId,
    label: d.label || `${fallbackPrefix} ${i + 1}`,
    hasLabel: !!d.label,
  }));
}

/** Keep the saved choice if it's still plugged in; otherwise the default (''). */
function keepIfPresent(previous: string, options: readonly DeviceOption[]): string {
  return previous && options.some((o) => o.id === previous) ? previous : '';
}

export class DeviceManager {
  private state: DeviceState = {
    cameras: {
      pb: { status: { kind: 'idle' }, devices: [] },
      vg: { status: { kind: 'idle' }, devices: [] },
    },
    audio: {
      status: { kind: 'idle' },
      mics: [],
      speakers: [],
      canGrantOutput: false,
      grantError: null,
    },
    tests: { pb: { kind: 'off', error: null }, vg: { kind: 'off', error: null } },
  };
  private listeners = new Set<() => void>();

  constructor(private deps: DeviceManagerDeps) {}

  // ─── State ───────────────────────────────────────────────────────────────

  getState = (): DeviceState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setCameras(role: CameraRole, next: CameraListState): void {
    this.state = { ...this.state, cameras: { ...this.state.cameras, [role]: next } };
    this.emit();
  }

  private setAudio(patch: Partial<AudioListState>): void {
    this.state = { ...this.state, audio: { ...this.state.audio, ...patch } };
    this.emit();
  }

  private setTest(role: CameraRole, next: CameraTestState): void {
    this.state = { ...this.state, tests: { ...this.state.tests, [role]: next } };
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  // ─── Camera enumeration ──────────────────────────────────────────────────

  /**
   * Scan for cameras for the given role. Probes `getUserMedia({video:true})`
   * first so the browser reveals device labels. Auto-selects the first
   * USB/external/action camera when no choice is saved. Returns the count.
   */
  async populateCameraList(role: CameraRole): Promise<number> {
    const prev = this.state.cameras[role].devices;
    this.setCameras(role, { status: { kind: 'scanning' }, devices: prev });

    try {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true });
        for (const t of probe.getTracks()) t.stop();
      } catch (permErr) {
        const name = (permErr as DOMException).name;
        this.setCameras(role, { status: { kind: 'denied', name }, devices: [] });
        return 0;
      }

      const all = await navigator.mediaDevices.enumerateDevices();
      const devices = toOptions(
        all.filter((d) => d.kind === 'videoinput'),
        'Camera',
      );

      let chosen = keepIfPresent(this.deps.getCameraId(role), devices);
      if (!chosen && !this.deps.getCameraId(role)) {
        const preferred = devices.find((d) =>
          PREFERRED_LABEL_TOKENS.some((t) => d.label.toLowerCase().includes(t)),
        );
        chosen = preferred?.id ?? '';
      }
      // A <select> with no '' option shows its first entry, so match that.
      if (!chosen) chosen = devices[0]?.id ?? '';
      this.deps.setCameraId(role, chosen);

      this.setCameras(role, { status: { kind: 'done' }, devices });
      return devices.length;
    } catch (e) {
      const err = e as DOMException;
      console.warn(`[Devices] populateCameraList(${role})`, e);
      this.setCameras(role, {
        status: { kind: 'error', name: err.name, message: err.message },
        devices: [],
      });
      return 0;
    }
  }

  // ─── Audio device enumeration ────────────────────────────────────────────

  /**
   * Scan for microphones and speakers. Probes `getUserMedia({audio:true})`
   * first so labels are exposed. Returns the input/output counts.
   */
  async populateAudioDeviceList(): Promise<{ inputs: number; outputs: number }> {
    this.setAudio({ status: { kind: 'scanning' } });

    let probe: MediaStream | null = null;
    try {
      try {
        probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        this.setAudio({ status: { kind: 'denied', name: (e as DOMException).name } });
        return { inputs: 0, outputs: 0 };
      } finally {
        if (probe) for (const t of probe.getTracks()) t.stop();
      }

      const all = await navigator.mediaDevices.enumerateDevices();
      const mics = toOptions(
        all.filter((d) => d.kind === 'audioinput'),
        'Microphone',
      );
      const speakers = toOptions(
        all.filter((d) => d.kind === 'audiooutput'),
        'Speaker',
      );

      this.deps.setMicId(keepIfPresent(this.deps.getMicId(), mics));
      this.deps.setSpeakerId(keepIfPresent(this.deps.getSpeakerId(), speakers));

      this.setAudio({
        status: { kind: 'done' },
        mics,
        speakers,
        canGrantOutput: speakers.some((d) => !d.hasLabel) && selectAudioOutputFn() !== null,
      });
      return { inputs: mics.length, outputs: speakers.length };
    } catch (e) {
      const err = e as DOMException;
      console.warn('[Devices] populateAudioDeviceList', e);
      this.setAudio({ status: { kind: 'error', name: err.name, message: err.message } });
      return { inputs: 0, outputs: 0 };
    }
  }

  /**
   * Chrome's picker for audio outputs, which also reveals Bluetooth speaker
   * names. Selects the chosen speaker.
   */
  async grantAudioOutput(): Promise<void> {
    const select = selectAudioOutputFn();
    if (!select) {
      this.setAudio({ canGrantOutput: false });
      return;
    }
    this.setAudio({ grantError: null });
    try {
      const device = await select();
      this.deps.setSpeakerId(device.deviceId);
      await this.populateAudioDeviceList();
      if (this.state.audio.speakers.some((s) => s.id === device.deviceId)) {
        this.deps.setSpeakerId(device.deviceId);
      }
    } catch (e) {
      const err = e as DOMException;
      if (err.name !== 'AbortError') this.setAudio({ grantError: err.message });
    }
  }

  // ─── Test camera preview ─────────────────────────────────────────────────

  /** Toggle the test preview for a role: open if closed, close if open. */
  async toggleCameraTest(role: CameraRole): Promise<void> {
    const test = this.state.tests[role];
    if (test.kind === 'on') {
      this.stopCameraTest(role);
      return;
    }
    if (test.kind === 'opening') return;
    await this.startCameraTest(role);
  }

  private async startCameraTest(role: CameraRole): Promise<void> {
    this.setTest(role, { kind: 'opening' });
    try {
      const deviceId = this.deps.getCameraId(role);
      const constraints: MediaStreamConstraints = deviceId
        ? { video: { deviceId: { exact: deviceId } } }
        : { video: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Stopped while opening (e.g. the kiosk launched): don't keep the camera.
      if (this.state.tests[role].kind !== 'opening') {
        for (const t of stream.getTracks()) t.stop();
        return;
      }
      const track = stream.getVideoTracks()[0];
      const s = track?.getSettings();
      const info = track ? `${track.label}  ·  ${s?.width || '?'} × ${s?.height || '?'}` : '';
      this.setTest(role, { kind: 'on', stream, info });
    } catch (e) {
      const err = e as DOMException;
      this.setTest(role, {
        kind: 'off',
        error: `Could not open camera: ${err.name} — ${err.message}`,
      });
    }
  }

  /** Force-stop the test preview for a role. Safe to call repeatedly. */
  stopCameraTest(role: CameraRole): void {
    const test = this.state.tests[role];
    if (test.kind === 'on') for (const t of test.stream.getTracks()) t.stop();
    if (test.kind !== 'off') this.setTest(role, { kind: 'off', error: null });
  }

  /** Stop every active test preview. Called before kiosk launch. */
  stopAllCameraTests(): void {
    this.stopCameraTest('pb');
    this.stopCameraTest('vg');
  }
}
