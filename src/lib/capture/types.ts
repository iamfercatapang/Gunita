// Shared types for the capture engine.

export interface PhotoSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ComputedLayout {
  /** Composition canvas width, in pixels. */
  cWidth: number;
  /** Composition canvas height, in pixels. */
  cHeight: number;
  /** One rectangle per photo slot in row-major order. */
  photoSlots: PhotoSlot[];
}

export interface VgStreamConstraints {
  /** Specific video deviceId, or '' to use the default camera. */
  cameraId: string;
  /** Specific audio deviceId, or '' to use the default mic. */
  micId: string;
}
