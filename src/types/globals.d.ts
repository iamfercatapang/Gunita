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
import type { DoneScreenOptions } from '../screens/guest-flow';
import type { AppConfig } from '../state/app-state';
import type { CaptureType } from '../state/captures';

/** What app.js does for the React screens; see window.PB.kiosk. */
interface KioskActions {
  /**
   * Enter kiosk mode. Rejects with the camera error if the camera can't be
   * opened (Photo Booth mode only; Video Guestbook opens it per session).
   */
  launch: () => Promise<void>;
  /** A guest tapped to start: disclaimer (if on), then the session. */
  startSession: () => void;
  /** The hidden Exit Kiosk button: asks for the PIN if one is set. */
  requestExit: () => void;
  /** Leave the kiosk now, without the PIN (the camera-lost screen's exit). */
  exit: () => void;
}

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
      /** The questions this guest will be asked (src/state/prompts.ts). */
      prompts: {
        enabled: () => string[];
      };
      /**
       * Kiosk actions that still live in app.js, set by app.js once the page
       * is ready. The React admin dashboard and welcome screen call them.
       */
      kiosk?: KioskActions;
      /** React kiosk screens (src/screens), loaded on first use. */
      ui: {
        /** Start loading the dialogs chunk so the first one opens instantly. */
        preload: () => void;
        /** Resolves true once the right PIN is entered, false if cancelled. */
        askPin: (opts: AskPinOptions) => Promise<boolean>;
        /** Resolves true if the guest accepts, false if they reject. */
        askDisclaimer: (opts: AskDisclaimerOptions) => Promise<boolean>;
        /** Show the kiosk welcome screen (fades in). */
        showWelcome: () => void;
        /** Hide it as a session starts. */
        hideWelcome: () => void;
        /** Run a photo booth session (src/screens/capture). */
        startPhotoSession: () => void;
        /** Run a video guestbook session. */
        startVideoSession: () => void;
        /** Close the capture screens and show the welcome screen. */
        resetToWelcome: () => void;
        /** Open the kiosk's Recent Captures window. */
        showRecentCaptures: () => void;
        /** Freeze the guest's current video frame for the photo booth offer. */
        freezeOfferBackdrop: (video: HTMLElement | null) => void;
        /** "Take a photo too?" Resolves true if the guest says yes. */
        offerPhotoBooth: () => Promise<boolean>;
        /** The done screen; resolves when the guest is done. */
        showDone: (opts: DoneScreenOptions) => Promise<void>;
        /** "What questions will be asked?" */
        showPromptsPreview: (prompts: string[]) => void;
        /** Close every kiosk overlay and stop any recording; pending questions resolve as no. */
        closeAll: () => void;
      };
    };
  }
}
