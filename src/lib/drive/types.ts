// Public Drive client types.

/**
 * A capture has one of two folder roles. The session folder under which it
 * lands is shared between roles (a guest's photos and videos go in the same
 * folder), but the *root* and *event* folders are distinct per role.
 */
export type DriveFolderRole = 'photo-booth' | 'video-guestbook';

export interface DriveFile {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveSessionFolder {
  id: string;
  webViewLink: string;
}

export interface DriveUploadResult extends DriveFile {
  /** True if this upload was served from the offline queue rather than a fresh network call. */
  fromQueue?: boolean;
}

/**
 * Bag of getters the DriveClient needs to read mutable app state. We pass
 * getters rather than values so the client always reads the *current* config
 * (the admin can change folder names or event names at runtime).
 */
export interface DriveClientDeps {
  /** OAuth client ID (UI input → appConfig.vgDriveClientId → env fallback). */
  getClientId(): string;
  /** Root folder name for the photo-booth role. */
  getPbFolderName(): string;
  /** Root folder name for the video-guestbook role. */
  getVgFolderName(): string;
  /** Sub-folder name for the current event (e.g. "Smiths_Wedding"). */
  getEventName(): string;
  /** Current guest session ID; the client will call ensureSessionId() if null. */
  getSessionId(): string | null;
  /** Mint a new session ID and update shared state. */
  ensureSessionId(): string;
  /** Update the cached session-folder webViewLink (consumed by the QR prompt). */
  setSessionFolderLink(id: string, link: string): void;
  /**
   * Write to a status banner for the given role. The DriveClient does *not*
   * own the DOM; the host wires this to whichever element it wants to update.
   */
  setStatus?(role: DriveFolderRole, msg: string, isError: boolean): void;
}

/** Anything that looks like a Window with the GIS oauth2 namespace loaded. */
export interface GoogleOauthClient {
  initTokenClient(args: {
    client_id: string;
    scope: string;
    callback: (resp: { access_token?: string; error?: string }) => void;
  }): { requestAccessToken(args?: { prompt?: string }): void };
  revoke(token: string, done: () => void): void;
}
