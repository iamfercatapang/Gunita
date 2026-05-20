// ─── App configuration shape ─────────────────────────────────────────────────
export interface AppConfig {
  layout: string;
  saveLocal: boolean;
  saveDrive: boolean;
  countdownFirst: number;
  countdownOthers: number;
  reviewTime: number;
  welcomeBg: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeMedia: { type: 'image' | 'video'; objectUrl: string } | null;
  photoMode: boolean;
  captureMode: 'videoguestbook' | 'photobooth';

  // Video Guestbook
  vgPanelTitle: string;
  vgCoupleName: string;
  vgMaxDuration: number;
  vgPromptText: string;
  vgCountdown: number;
  vgSelectedCameraId: string;
  vgSelectedMicId: string;
  vgSelectedSpeakerId: string;
  vgSaveLocal: boolean;
  vgSaveDrive: boolean;
  vgOverlay: { objectUrl: string; img: HTMLImageElement } | null;

  // Templates / framing
  templateBg: { objectUrl: string; img: HTMLImageElement } | null;
  vgFrameBg: { objectUrl: string; img: HTMLImageElement } | null;

  // Filename / camera
  eventName: string;
  selectedCameraId: string;

  // Disclaimer
  disclaimerEnabled: boolean;
  disclaimerHeader: string;
  disclaimerOrg: string;
  disclaimerText: string;

  // Drive — Photo Booth
  driveFolderName: string;
  _driveAccessToken: string | null;
  _driveFolderId: string | null;
  _driveEventFolderId: string | null;

  // Drive — Video Guestbook
  vgDriveFolderName: string;
  vgDriveClientId: string;
  _vgDriveAccessToken: string | null;
  _vgDriveFolderId: string | null;
  _vgDriveEventFolderId: string | null;

  // Prompts — VG
  vgPromptsEnabled: boolean;
  vgPromptCategory: 'wedding' | 'birthday' | 'teambuilding';
  vgCustomPrompts: { text: string; enabled: boolean }[];
  vgDisabledTemplatePrompts: string[];
  vgSplashDuration: number;

  // PB splash
  pbSplashEnabled: boolean;
  pbSplashDuration: number;

  // Thank You — VG
  vgThankYouEnabled: boolean;
  vgThankYouImage: { objectUrl: string } | null;
  vgThankYouDuration: number;

  // Capture review — VG
  vgCaptureReviewEnabled: boolean;

  // Cross-mode offer
  vgOfferPb: boolean;

  // Kiosk PIN
  kioskPin: string;
  kioskPinLen: number;

  // Live Viewer
  lvNetworkAddr: string;
}

// ─── Default config ──────────────────────────────────────────────────────────
const defaultAppConfig: AppConfig = {
  layout: '4x6-1',
  saveLocal: true,
  saveDrive: false,
  countdownFirst: 5,
  countdownOthers: 5,
  reviewTime: 4,
  welcomeBg: '#E0F2FE',
  welcomeTitle: '',
  welcomeSubtitle: '',
  welcomeMedia: null,
  photoMode: false,
  captureMode: 'videoguestbook',
  vgPanelTitle: 'Raise a Toast!',
  vgCoupleName: '',
  vgMaxDuration: 60,
  vgPromptText: '',
  vgCountdown: 3,
  vgSelectedCameraId: '',
  vgSelectedMicId: '',
  vgSelectedSpeakerId: '',
  vgSaveLocal: true,
  vgSaveDrive: false,
  vgOverlay: null,
  templateBg: null,
  vgFrameBg: null,
  eventName: '',
  selectedCameraId: '',
  disclaimerEnabled: false,
  disclaimerHeader: 'Media Release Agreement',
  disclaimerOrg: 'Name of Organization',
  disclaimerText:
    'By proceeding, I grant {Name of Organization} the right to use my photos or videos from this event for promotional and publication purposes without compensation. I understand these files become the property of the organization, and I waive the right to review the final media or claim royalties. I also release {Name of Organization} from any legal claims or liability related to the use of my likeness.',
  driveFolderName: 'Photo Booth Captures',
  _driveAccessToken: null,
  _driveFolderId: null,
  _driveEventFolderId: null,
  vgDriveFolderName: 'Video Guestbook Captures',
  vgDriveClientId: '',
  _vgDriveAccessToken: null,
  _vgDriveFolderId: null,
  _vgDriveEventFolderId: null,
  vgPromptsEnabled: false,
  vgPromptCategory: 'wedding',
  vgCustomPrompts: [],
  vgDisabledTemplatePrompts: [],
  vgSplashDuration: 3,
  pbSplashEnabled: false,
  pbSplashDuration: 3,
  vgThankYouEnabled: false,
  vgThankYouImage: null,
  vgThankYouDuration: 5,
  vgCaptureReviewEnabled: true,
  vgOfferPb: false,
  kioskPin: '',
  kioskPinLen: 0,
  lvNetworkAddr: '',
};

// ─── Persisted keys ──────────────────────────────────────────────────────────
// Media blobs and Drive tokens are intentionally excluded — they cannot be
// JSON-serialised or should not be stored across sessions.
const PERSISTED_KEYS: (keyof AppConfig)[] = [
  'layout',
  'saveLocal',
  'saveDrive',
  'countdownFirst',
  'countdownOthers',
  'reviewTime',
  'welcomeBg',
  'welcomeTitle',
  'welcomeSubtitle',
  'photoMode',
  'captureMode',
  'vgMaxDuration',
  'vgPromptText',
  'vgCountdown',
  'vgSelectedCameraId',
  'vgSelectedMicId',
  'vgSelectedSpeakerId',
  'vgSaveLocal',
  'vgSaveDrive',
  'eventName',
  'selectedCameraId',
  'disclaimerEnabled',
  'disclaimerHeader',
  'disclaimerOrg',
  'disclaimerText',
  'driveFolderName',
  'vgDriveFolderName',
  'vgDriveClientId',
  'vgPromptsEnabled',
  'vgPromptCategory',
  'vgCustomPrompts',
  'vgDisabledTemplatePrompts',
  'vgSplashDuration',
  'pbSplashEnabled',
  'pbSplashDuration',
  'vgThankYouEnabled',
  'vgThankYouDuration',
  'vgCaptureReviewEnabled',
  'vgOfferPb',
  'kioskPin',
  'kioskPinLen',
  'lvNetworkAddr',
];

// ─── Build the live appConfig and restore from localStorage ──────────────────
const appConfig: AppConfig = { ...defaultAppConfig };

(function restorePersistedConfig() {
  try {
    const saved = localStorage.getItem('photobooth_config');
    if (!saved) return;
    const parsed = JSON.parse(saved) as Partial<AppConfig>;
    for (const k of PERSISTED_KEYS) {
      if (parsed[k] !== undefined) {
        // The persisted keys are a subset of AppConfig and we just verified
        // the value is defined; the runtime assignment is safe.
        (appConfig as unknown as Record<string, unknown>)[k] = parsed[k];
      }
    }
    // Capture Settings is VG-only now; normalize legacy saved values.
    appConfig.captureMode = 'videoguestbook';
    // Migrate legacy custom prompts (string[]) to object format.
    appConfig.vgCustomPrompts = appConfig.vgCustomPrompts.map((p) =>
      typeof p === 'string' ? { text: p, enabled: true } : p,
    );
  } catch (e) {
    console.warn('[Config] Could not restore saved settings:', e);
  }
})();

export function saveConfig(): void {
  try {
    const data: Partial<AppConfig> = {};
    for (const k of PERSISTED_KEYS) {
      (data as unknown as Record<string, unknown>)[k] = appConfig[k];
    }
    localStorage.setItem('photobooth_config', JSON.stringify(data));
  } catch (e) {
    console.warn('[Config] Could not save settings:', e);
  }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
export function _scheduleSave(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveConfig, 800);
}

// ─── Session ID management ───────────────────────────────────────────────────
export function generateSessionId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `${dateStr}_${timeStr}_${random}`;
}

export function startNewSession(): string {
  window.currentSessionId = generateSessionId();
  window.currentSessionFolderId = null;
  window.currentSessionFolderLink = null;
  console.log('[Session] Started new session:', window.currentSessionId);
  return window.currentSessionId;
}

// ─── Side effects: expose runtime state on window for legacy app.js ──────────
// The legacy code reads/writes these as bare globals; without these
// assignments, `app.js` cannot see the bindings (it is loaded as a
// non-module script). When app.js is converted to modules in Phase 2,
// these window assignments can be removed.
window.appConfig = appConfig;
window.saveConfig = saveConfig;
window.generateSessionId = generateSessionId;
window.startNewSession = startNewSession;

window.currentStream = null;
window.directoryHandle = null;
window.capturedPhotos = [];
window.capturedPhotoDriveLinks = [];
window.capturedVideos = [];
window.capturedVideoDriveLinks = [];
window.currentSessionId = null;
window.currentSessionFolderId = null;
window.currentSessionFolderLink = null;
