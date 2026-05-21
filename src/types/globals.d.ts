// Ambient type declarations for the legacy `app.js` runtime.
// Phase 1 keeps `app.js` as a non-module script that reads/writes
// shared state through `window`. These declarations make those
// globals visible to TypeScript without forcing a rewrite of app.js.

import type { LayoutDef, PaperSize, PromptTemplates } from '../constants';
import type { AudioController } from '../lib/audio';
import type { ComputedLayout, LocalSaveDeps, VgCameraManager } from '../lib/capture';
import type { DeviceManager } from '../lib/devices';
import type { DriveClient } from '../lib/drive';
import type { LiveViewerHost } from '../lib/live-viewer';
import type { KioskSecurity } from '../lib/security';
import type { AppConfig } from '../state/app-state';

declare global {
  interface Window {
    // Runtime media state (mutated by app.js)
    currentStream: MediaStream | null;
    directoryHandle: FileSystemDirectoryHandle | null;
    capturedPhotos: string[];
    capturedPhotoDriveLinks: (string | null)[];
    capturedVideos: string[];
    capturedVideoDriveLinks: (string | null)[];
    currentSessionId: string | null;
    currentSessionFolderId: string | null;
    currentSessionFolderLink: string | null;

    // Application config (mutated by admin UI)
    appConfig: AppConfig;
    saveConfig: () => void;

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
        saveBlobLocally: (blob: Blob, filename: string, deps: LocalSaveDeps) => Promise<void>;
        downloadBlob: (blob: Blob, filename: string) => void;
      };
    };
  }
}
