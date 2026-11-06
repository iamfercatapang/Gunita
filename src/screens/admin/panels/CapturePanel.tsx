// Capture settings: camera, audio, recording limits, where captures are
// saved, and the capture review toggle.

import { useCallback, useEffect, useState } from 'react';

import type { DeviceStoreSummary } from '../../../lib/capture/device-store';
import { useSetting } from '../../../ui/useSettings';
import {
  FaIcon,
  FeatureToggle,
  FormCard,
  PanelHeader,
  SaveDestCard,
  Slider,
  useDraftSetting,
} from '../controls';
import { AudioCard, CameraCard } from './DeviceCards';

export function CapturePanel({ active }: { active: boolean }) {
  return (
    <>
      <PanelHeader
        icon={<i className="fa-solid fa-camera" />}
        title="Capture Settings"
        sub="Camera, audio, recording, and save-destination settings for the Video Guestbook."
      />

      <div id="cap-tab-videoguestbook" className="cap-tab-content">
        <div className="settings-section">
          <CameraCard />
        </div>
        <div className="settings-section">
          <AudioCard />
        </div>

        <div className="settings-section">
          <FormCard
            icon={<i className="fa-solid fa-clock" />}
            title="Recording"
            subtitle="Duration limits and countdown."
          >
            <Slider
              id="setting-vg-duration"
              setting="vgMaxDuration"
              label="Maximum recording length"
              min={10}
              max={180}
              step={5}
            />
            <Slider
              id="setting-vg-countdown"
              setting="vgCountdown"
              label="Countdown before recording"
              min={1}
              max={10}
              className="slider-group admin-form-divider-top"
            />
          </FormCard>
        </div>

        <div className="settings-section">
          <StorageCard active={active} />
        </div>

        <div className="settings-section">
          <FeatureToggle
            id="toggle-vg-capture-review"
            setting="vgCaptureReviewEnabled"
            icon={<FaIcon name="play" />}
            title="Capture Review"
            subtitle="Play back the recording so guests can review it before it's saved"
          />
        </div>
      </div>
    </>
  );
}

// ─── Save destination ────────────────────────────────────────────────────────

function StorageCard({ active }: { active: boolean }) {
  const saveLocal = useSetting('vgSaveLocal');
  const saveDrive = useSetting('vgSaveDrive');
  const onDevice = window.PB.capture.deviceStore.shouldUseDeviceStore();

  return (
    <FormCard
      icon={<i className="fa-solid fa-folder-open" />}
      title="Save Destination"
      subtitle="Enable one or both — recordings save to all enabled locations."
    >
      <div className="save-dest-grid">
        <SaveDestCard
          id="chk-vg-save-local"
          setting="vgSaveLocal"
          icon="floppy-disk"
          title={onDevice ? 'On this device' : 'Local Folder'}
        />
        <SaveDestCard
          id="chk-vg-save-drive"
          setting="vgSaveDrive"
          icon="cloud"
          title="Google Drive"
        />
      </div>

      {saveLocal && (
        <div id="vg-local-folder-config" className="folder-picker-box">
          {onDevice ? <DeviceStoreBox active={active} /> : <FolderPicker />}
        </div>
      )}

      {saveDrive && <DriveConfig />}

      <p className="admin-form-meta admin-form-divider-top">
        Files are named: <code>EventName_YYYYMMDD_HHMMSS.webm</code>
      </p>
    </FormCard>
  );
}

function FolderPicker() {
  const [folder, setFolder] = useState(window.directoryHandle?.name ?? null);

  const pick = async (): Promise<void> => {
    const w = window as Window & {
      showDirectoryPicker?: (o: { mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    };
    if (!w.showDirectoryPicker) {
      alert(
        'Your browser does not support seamless folder saving. Files will be saved via standard downloads.',
      );
      return;
    }
    try {
      window.directoryHandle = await w.showDirectoryPicker({ mode: 'readwrite' });
      setFolder(window.directoryHandle.name);
    } catch (err) {
      console.log('Directory picker cancelled or failed.', err);
    }
  };

  return (
    <div id="local-folder-picker">
      <p className="admin-form-meta">
        Choose where recordings and photos will be saved (shared folder for all captures).
      </p>
      <div className="admin-form-actions">
        <button type="button" id="btn-vg-select-dir" className="btn-outline" onClick={pick}>
          Select Save Folder
        </button>
        <span id="vg-dir-status" className="dir-status-text">
          {folder ? `Saving to: /${folder}` : 'No folder selected (Will prompt download)'}
        </span>
      </div>
    </div>
  );
}

function fmtBytes(n: number | null): string {
  if (n == null) return '–';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.max(1, Math.round(n / 1e3))} KB`;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * iPad / iPhone: Safari has no folder picker, so captures are kept in the
 * app's own storage (src/lib/capture/device-store.ts) and exported from here.
 */
function DeviceStoreBox({ active }: { active: boolean }) {
  const ds = window.PB.capture.deviceStore;
  const [summary, setSummary] = useState<DeviceStoreSummary | null>(null);
  // The next export batch is loaded ahead of time: iOS only opens the share
  // sheet when navigator.share() runs straight from the tap.
  const [batch, setBatch] = useState<{ ids: string[]; files: File[] }>({ ids: [], files: [] });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([ds.summary(), ds.nextExportBatch()]);
      setSummary(s);
      setBatch(b);
    } catch (err) {
      console.warn('[DeviceStore] Could not read saved captures:', err);
    }
  }, [ds]);

  // Captures happen in kiosk mode; refresh whenever the host comes back here.
  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  const exportFiles = (): void => {
    setBusy(true);
    // No await before exportBatch(): it calls navigator.share() first thing.
    ds.exportBatch(batch)
      .then((r) => {
        if (r.status === 'shared' || r.status === 'downloaded') {
          const verb = r.status === 'shared' ? 'Exported' : 'Downloaded';
          setMessage(
            `${verb} ${plural(r.count, 'file')}.${r.remaining ? ` ${r.remaining} still to export: tap Export again.` : ' Everything is exported.'}`,
          );
        } else if (r.status === 'cancelled') {
          setMessage('Export cancelled. Nothing was marked as exported.');
        }
      })
      .catch((err: Error) => {
        console.error('[DeviceStore] Export failed:', err);
        setMessage(
          `Export failed: ${err.message || err.name}. Your files are still saved on this device.`,
        );
      })
      .finally(() => {
        setBusy(false);
        void refresh();
      });
  };

  const clear = async (): Promise<void> => {
    const count = summary?.exported ?? 0;
    if (
      !confirm(
        `Delete ${count} exported file(s) from this device? Make sure they arrived in Files or Photos first. Files you haven't exported are kept.`,
      )
    )
      return;
    try {
      const removed = await ds.clearExported();
      setMessage(`Cleared ${plural(removed, 'exported file')}.`);
    } catch (err) {
      const e = err as Error;
      setMessage(`Could not clear files: ${e.message || e.name}`);
    }
    void refresh();
  };

  const n = batch.files.length;
  const pending = summary?.pending ?? 0;
  const exported = summary?.exported ?? 0;
  const exportLabel =
    n === 0
      ? 'Nothing to export'
      : pending > n
        ? `Export next ${n} of ${pending}`
        : `Export ${plural(n, 'file')}`;

  return (
    <div id="device-store-box">
      <p className="admin-form-meta">
        Recordings and photos are kept inside the app on this device, with no download prompts.
        Export them to Files or Photos when you're ready, then clear what you've exported to free up
        space.
      </p>
      <output className="device-store-stats" aria-live="polite">
        <div className="device-store-stat">
          <strong id="ds-pending">{pending}</strong>
          <span>to export</span>
        </div>
        <div className="device-store-stat">
          <strong id="ds-exported">{exported}</strong>
          <span>exported</span>
        </div>
        <div className="device-store-stat">
          <strong id="ds-used">{summary ? fmtBytes(summary.bytes) : '0 MB'}</strong>
          <span>used</span>
        </div>
        <div className="device-store-stat">
          <strong id="ds-free">{fmtBytes(summary?.freeBytes ?? null)}</strong>
          <span>free</span>
        </div>
      </output>
      {summary?.persisted === false && (
        <p id="ds-persist-note" className="admin-form-meta">
          Add Gunita to the Home Screen (Share → Add to Home Screen) and run it from there, so
          iPadOS keeps these files until you export them.
        </p>
      )}
      <div className="admin-form-actions">
        <button
          type="button"
          id="btn-ds-export"
          className="btn-primary"
          disabled={busy || n === 0}
          onClick={exportFiles}
        >
          {exportLabel}
        </button>
        <button
          type="button"
          id="btn-ds-clear"
          className="btn-outline"
          disabled={exported === 0}
          onClick={clear}
        >
          {exported ? `Clear ${exported} exported` : 'Clear exported'}
        </button>
      </div>
      <output id="ds-message" className="admin-form-meta admin-output-block">
        {message}
      </output>
    </div>
  );
}

// ─── Google Drive ────────────────────────────────────────────────────────────

const DEFAULT_DRIVE_FOLDER = 'Video Guestbook Captures';
const folderOrDefault = (t: string): string => t.trim() || DEFAULT_DRIVE_FOLDER;
const trim = (t: string): string => t.trim();

type DriveStatus = { text: string; error: boolean; connected?: boolean } | null;

function DriveConfig() {
  const drive = window.PB.drive;
  const [signedIn, setSignedIn] = useState(() => drive.isSignedIn());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<DriveStatus>(null);

  const onClientId = useCallback(() => {
    drive.signOut();
    setSignedIn(false);
  }, [drive]);
  const onFolder = useCallback(() => drive.invalidateFolders('video-guestbook'), [drive]);
  const [clientId, setClientId] = useDraftSetting('vgDriveClientId', trim, onClientId);
  const [folder, setFolder] = useDraftSetting('vgDriveFolderName', folderOrDefault, onFolder);

  const signIn = async (): Promise<void> => {
    setBusy(true);
    setStatus(null);
    try {
      await drive.getToken({ forcePrompt: true });
      setSignedIn(true);
      setStatus({
        text: 'Connected — captures will upload automatically',
        error: false,
        connected: true,
      });
      // Best-effort: flush any uploads that queued offline last session.
      drive.flushQueue().catch(() => {});
    } catch (e) {
      setStatus({ text: `Sign-in failed: ${(e as Error).message}`, error: true });
    } finally {
      setBusy(false);
    }
  };

  const signOut = (): void => {
    drive.signOut();
    setSignedIn(false);
    setStatus({ text: 'Signed out', error: false });
  };

  return (
    <div id="vg-drive-config" className="admin-form-subgroup">
      <p className="admin-form-subgroup-title">Google Drive</p>
      <div className="admin-form-field">
        <label htmlFor="vg-drive-client-id">OAuth Client ID</label>
        <input
          type="text"
          id="vg-drive-client-id"
          className="text-input"
          placeholder="123456789-xxxx.apps.googleusercontent.com"
          autoComplete="off"
          spellCheck={false}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        <p className="admin-form-meta">
          Used for both videos and photos. Leave blank to use the built-in default.
        </p>
      </div>
      <div className="admin-form-field">
        <label htmlFor="vg-drive-folder-name">
          Save captures to folder{' '}
          <span className="admin-form-field-hint">(created automatically)</span>
        </label>
        <input
          type="text"
          id="vg-drive-folder-name"
          className="text-input admin-form-input-narrow"
          placeholder={DEFAULT_DRIVE_FOLDER}
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        />
      </div>
      <div className="admin-form-actions">
        {signedIn ? (
          <button type="button" id="btn-vg-drive-signout" className="btn-outline" onClick={signOut}>
            Sign out
          </button>
        ) : (
          <button
            type="button"
            id="btn-vg-drive-signin"
            className="btn-google-signin"
            disabled={busy}
            onClick={signIn}
          >
            <GoogleIcon />
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </button>
        )}
        <output
          id="vg-drive-auth-status"
          className={status?.error ? 'drive-status-error' : 'drive-status'}
        >
          {status?.connected && <i className="fa-solid fa-check" />} {status?.text}
        </output>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}
