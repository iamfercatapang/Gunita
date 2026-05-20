// Wire format for the live-viewer DataChannel.
//
// The host serialises one of these as JSON and sends to every connected
// viewer. Each message carries a unique `_id` so the viewer can deduplicate
// — DataChannels occasionally re-deliver under load, and the host may
// re-broadcast across a reconnect.

export interface HelloMsg {
  type: 'hello';
  eventName: string;
  _id?: string;
}

export interface PhotoMsg {
  type: 'photo';
  /** dataURL of the photo */
  data: string;
  filename: string;
  /** ms epoch */
  ts: number;
  /** Drive folder URL — null until the Drive upload finishes. */
  driveUrl?: string | null;
  _id?: string;
}

export interface VideoMsg {
  type: 'video';
  /** dataURL of the first-frame thumbnail, or null if thumb generation failed */
  data: string | null;
  filename: string;
  ts: number;
  /** seconds */
  duration: number;
  driveUrl?: string | null;
  _id?: string;
}

export interface DriveUpdateMsg {
  type: 'drive-update';
  filename: string;
  driveUrl: string;
  _id?: string;
}

export type LiveViewerMsg = HelloMsg | PhotoMsg | VideoMsg | DriveUpdateMsg;

export function newMessageId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
