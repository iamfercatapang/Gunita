// Ambient type declarations for the legacy `app.js` runtime.
// Phase 1 keeps `app.js` as a non-module script that reads/writes
// shared state through `window`. These declarations make those
// globals visible to TypeScript without forcing a rewrite of app.js.

import type { LayoutDef, PaperSize, PromptTemplates } from '../constants';
import type { AudioController } from '../lib/audio';
import type {
  ComputedLayout,
  LocalSaveDeps,
  LocalSaveTarget,
  VgCameraManager,
  deviceStore,
} from '../lib/capture';
import type { DeviceManager } from '../lib/devices';
import type { DriveClient } from '../lib/drive';
import type { LiveViewerHost } from '../lib/live-viewer';
import type { KioskSecurity } from '../lib/security';
import type { AskDisclaimerOptions, AskPinOptions } from '../screens/dialogs';
import type { AppConfig } from '../state/app-state';
import type { CaptureType } from '../state/captures';

declare global {
  interface Window {
    // Runtime media state (mutated by app.js)
    currentStream: MediaStream | null;
    directoryHandle: FileSystemDirectoryHandle | null;
    currentSessionId: string | null;
    currentSessionFolderId: string | null;
    currentSessionFolderLink: string | null;

    // Application config (mutated by admin UI)
    appConfig: AppConfig;
    saveConfig: () => void;
    _scheduleSave: () => void;

    // Session helpers
    generateSessionId: () => string;
    startNewSession: () => string;

    // Constants
    GOOGLE_DRIVE_CLIENT_ID: string;
    PROMPT_TEMPLATES: PromptTemplates;
    PAPER_SIZES: Record<string, PaperSize>;
    LAYOUT_DEFS: Record<string, LayoutDef>;

    // Bundled vendor globals (set by main.ts)
    $: typeof import('jquery');
    jQuery: typeof import('jquery');
    Peer: typeof import('peerjs').Peer;
    QRCode: unknown; // qrcodejs is vendored as a non-module script

    // Typed library namespace (populated by main.ts).
    PB: {
      drive: DriveClient;
      audio: AudioController;
      devices: DeviceManager;
      security: KioskSecurity;
      liveViewer: {
        host: LiveViewerHost;
      };
      capture: {
        camera: VgCameraManager;
        photoConstraintsForSlot: (slotW: number, slotH: number) => MediaTrackConstraints;
        logTrackSize: (label: string, stream: MediaStream) => void;
        computeLayout: (def: LayoutDef) => ComputedLayout;
        drawPhoto: (
          ctx: CanvasRenderingContext2D,
          stream: MediaStream | null,
          fallback: HTMLVideoElement | HTMLImageElement,
          x: number,
          y: number,
          slotW: number,
          slotH: number,
        ) => Promise<void>;
        drawCoverFrame: (
          ctx: CanvasRenderingContext2D,
          source: CanvasImageSource,
          sourceW: number,
          sourceH: number,
          dx: number,
          dy: number,
          dw: number,
          dh: number,
          opts?: { mirror?: boolean },
        ) => void;
        makeFilename: (eventName: string, ext?: string) => string;
        saveBlobLocally: (
          blob: Blob,
          filename: string,
          deps: LocalSaveDeps,
        ) => Promise<LocalSaveTarget>;
        downloadBlob: (blob: Blob, filename: string) => void;
        deviceStore: typeof deviceStore;
      };
      /** This session's captures, newest first (src/state/captures.ts). */
      captures: {
        /** Add a capture; returns its id. Old ones drop off past the cap. */
        add: (type: CaptureType, src: string) => number;
        /** Record the Drive link once the capture's upload has finished. */
        setDriveUrl: (id: number, driveUrl: string) => void;
        count: () => number;
      };
      /** React kiosk screens (src/screens), loaded on first use. */
      ui: {
        /** Start loading the dialogs chunk so the first one opens instantly. */
        preload: () => void;
        /** Resolves true once the right PIN is entered, false if cancelled. */
        askPin: (opts: AskPinOptions) => Promise<boolean>;
        /** Resolves true if the guest accepts, false if they reject. */
        askDisclaimer: (opts: AskDisclaimerOptions) => Promise<boolean>;
        /** Open the kiosk's Recent Captures window. */
        showRecentCaptures: () => void;
        /** Close any open dialog as cancelled, and Recent Captures. */
        closeAll: () => void;
      };
    };
  }
}
