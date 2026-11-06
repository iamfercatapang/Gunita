// Capture settings: the camera and audio device cards. Device lists and the
// test preview come from window.PB.devices (src/lib/devices); the chosen ids
// are settings.

import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { DeviceOption, DeviceState, ScanStatus } from '../../../lib/devices';
import { updateSettings } from '../../../state/settings';
import { useSetting } from '../../../ui/useSettings';
import { FormCard } from '../controls';

function useDevices(): DeviceState {
  const devices = window.PB.devices;
  return useSyncExternalStore(devices.subscribe, devices.getState);
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <span className="device-diag-warn">
      <i className="fa-solid fa-triangle-exclamation" /> {children}
    </span>
  );
}

function StatusLine({
  status,
  what,
  deniedHint,
}: { status: ScanStatus; what: string; deniedHint: string }) {
  switch (status.kind) {
    case 'scanning':
      return <span className="device-diag-muted">Scanning for {what}…</span>;
    case 'denied':
      return (
        <Warn>
          {deniedHint} ({status.name}). Grant access in browser settings, then tap ↺ Refresh.
        </Warn>
      );
    case 'error':
      return (
        <Warn>
          Error: {status.name} — {status.message}
        </Warn>
      );
    default:
      return null;
  }
}

function DeviceLines({ devices }: { devices: readonly DeviceOption[] }) {
  return (
    <span className="device-diag-list">
      {devices.map((d, i) => (
        <span key={d.id || i} className="device-diag-line">
          [{i + 1}] {d.hasLabel ? d.label : <em className="device-diag-nolabel">no label</em>}
        </span>
      ))}
    </span>
  );
}

// ─── Camera ──────────────────────────────────────────────────────────────────

function TestPreview({ stream, info }: { stream: MediaStream; info: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <div id="vg-camera-test-card" className="admin-form-test-preview">
      <div className="admin-form-test-header">
        <span>
          <i className="fa-solid fa-camera" /> Camera Preview
        </span>
        <button
          type="button"
          id="btn-stop-vg-camera-test"
          className="btn-outline btn-small"
          onClick={() => window.PB.devices.stopCameraTest('vg')}
        >
          <i className="fa-solid fa-stop" /> Stop
        </button>
      </div>
      <video id="vg-camera-test-preview" ref={ref} autoPlay playsInline muted />
      <p id="vg-camera-test-info" className="admin-form-meta">
        {info}
      </p>
    </div>
  );
}

export function CameraCard() {
  const { cameras, tests } = useDevices();
  const list = cameras.vg;
  const test = tests.vg;
  const selected = useSetting('vgSelectedCameraId');
  const scanning = list.status.kind === 'scanning';

  let placeholder: string | null = null;
  if (list.status.kind === 'denied') placeholder = '— permission denied —';
  else if (list.devices.length === 0)
    placeholder = list.status.kind === 'done' ? 'No cameras found' : '— detecting cameras… —';

  return (
    <FormCard
      id="vg-camera-specific-card"
      icon={<i className="fa-solid fa-camera" />}
      title="Camera"
      subtitle="Select your USB or HDMI capture camera. Plug it in, then tap Refresh."
    >
      <div className="admin-form-field">
        <label htmlFor="vg-camera-select">Device</label>
        <div className="admin-form-row">
          <select
            id="vg-camera-select"
            className="text-input admin-form-input-wide"
            value={placeholder ? '' : selected}
            onChange={(e) => updateSettings({ vgSelectedCameraId: e.target.value })}
          >
            {placeholder ? (
              <option value="">{placeholder}</option>
            ) : (
              list.devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            id="btn-refresh-vg-cameras"
            className="btn-outline"
            disabled={scanning}
            onClick={() => void window.PB.devices.populateCameraList('vg')}
          >
            {scanning ? 'Refreshing…' : '↺ Refresh'}
          </button>
          <button
            type="button"
            id="btn-test-vg-camera"
            className="btn-outline"
            disabled={test.kind === 'opening'}
            onClick={() => void window.PB.devices.toggleCameraTest('vg')}
          >
            {test.kind === 'opening' ? (
              'Opening…'
            ) : test.kind === 'on' ? (
              <>
                <i className="fa-solid fa-stop" /> Stop Test
              </>
            ) : (
              <>
                <i className="fa-solid fa-play" /> Test
              </>
            )}
          </button>
        </div>
        <div id="vg-camera-diag" className="device-diag">
          {test.kind === 'off' && test.error ? (
            <Warn>{test.error}</Warn>
          ) : list.status.kind === 'done' ? (
            list.devices.length === 0 ? (
              <Warn>No cameras detected. Plug in your camera, then tap Refresh.</Warn>
            ) : (
              <>
                <span className="device-diag-title">{list.devices.length} camera(s) detected:</span>
                <DeviceLines devices={list.devices} />
                {list.devices.some((d) => !d.hasLabel) && (
                  <Warn>Some cameras have no label — grant camera permission and tap Refresh.</Warn>
                )}
              </>
            )
          ) : (
            <StatusLine status={list.status} what="cameras" deniedHint="Camera permission denied" />
          )}
        </div>
      </div>

      {test.kind === 'on' && <TestPreview stream={test.stream} info={test.info} />}
    </FormCard>
  );
}

// ─── Audio ───────────────────────────────────────────────────────────────────

export function AudioCard() {
  const { audio } = useDevices();
  const mic = useSetting('vgSelectedMicId');
  const speaker = useSetting('vgSelectedSpeakerId');
  const scanning = audio.status.kind === 'scanning';

  return (
    <FormCard
      icon={<i className="fa-solid fa-microphone" />}
      title="Audio Devices"
      subtitle="Microphone for recording and speaker for playback. Pair Bluetooth devices first."
    >
      <div className="admin-form-field">
        <label htmlFor="vg-mic-select">
          <i className="fa-solid fa-microphone" /> Microphone
        </label>
        <select
          id="vg-mic-select"
          className="text-input admin-form-input-wide"
          value={mic}
          onChange={(e) => updateSettings({ vgSelectedMicId: e.target.value })}
        >
          <option value="">— Default microphone —</option>
          {audio.mics.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <p className="admin-form-meta">
          Select your Bluetooth or USB mic (e.g. DJI Mic Mini), then tap Refresh.
        </p>
      </div>

      <div className="admin-form-field">
        <label htmlFor="vg-speaker-select">
          <i className="fa-solid fa-volume-high" /> Speaker / Output
        </label>
        <div className="admin-form-row">
          <select
            id="vg-speaker-select"
            className="text-input"
            value={speaker}
            onChange={(e) => updateSettings({ vgSelectedSpeakerId: e.target.value })}
          >
            <option value="">— Default speaker —</option>
            {audio.status.kind === 'done' && audio.speakers.length === 0 ? (
              <option value="" disabled>
                No output devices found
              </option>
            ) : (
              audio.speakers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))
            )}
          </select>
          <button
            type="button"
            id="btn-test-speaker"
            className="btn-outline btn-small"
            onClick={() => window.PB.audio.testSpeakerOutput(speaker)}
          >
            <i className="fa-solid fa-play" /> Test
          </button>
        </div>
        {audio.canGrantOutput && <GrantButton />}
        <p className="admin-form-meta">
          If your speaker shows no name, tap Grant Bluetooth Access.
        </p>
      </div>

      <div id="vg-audio-diag" className="device-diag">
        {audio.status.kind === 'done' ? (
          <>
            <span className="device-diag-title">
              {audio.mics.length} mic(s) · {audio.speakers.length} output(s) detected:
            </span>
            {audio.mics.length > 0 && <DeviceLines devices={audio.mics} />}
            {audio.speakers.length > 0 && <DeviceLines devices={audio.speakers} />}
            {audio.speakers.length === 0 && (
              <Warn>
                No audio output devices found — speaker selection not available on this
                browser/device.
              </Warn>
            )}
          </>
        ) : (
          <StatusLine
            status={audio.status}
            what="audio devices"
            deniedHint="Microphone permission denied"
          />
        )}
        {audio.grantError && <Warn>{audio.grantError}</Warn>}
      </div>

      <div className="admin-form-actions">
        <button
          type="button"
          id="btn-refresh-vg-audio"
          className="btn-outline"
          disabled={scanning}
          onClick={() => void window.PB.devices.populateAudioDeviceList()}
        >
          {scanning ? 'Refreshing…' : '↺ Refresh'}
        </button>
      </div>
    </FormCard>
  );
}

function GrantButton() {
  const [busy, setBusy] = useState(false);
  const grant = (): void => {
    setBusy(true);
    void window.PB.devices.grantAudioOutput().finally(() => setBusy(false));
  };
  return (
    <button
      type="button"
      id="btn-grant-audio-output"
      className="btn-outline btn-small admin-grant-btn"
      disabled={busy}
      onClick={grant}
    >
      {busy ? (
        'Opening picker…'
      ) : (
        <>
          <i className="fa-solid fa-key" /> Grant Bluetooth Access
        </>
      )}
    </button>
  );
}
