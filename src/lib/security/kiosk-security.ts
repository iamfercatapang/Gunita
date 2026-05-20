// Kiosk security primitives.
//
// PIN HASHING
// -----------
// The legacy code used a bare SHA-256 hex digest, which is unsafe for short
// numeric PINs: a 4-digit PIN has only 10 000 possibilities and SHA-256 is
// fast (~µs per hash), so a stolen `appConfig` snapshot could be brute-forced
// in milliseconds. This class upgrades hashing to PBKDF2-SHA-256 with a
// per-PIN salt and 200 000 iterations (~100 ms per guess on modest hardware,
// ~17 min to exhaust a 4-digit PIN — short of strong, but a meaningful
// hurdle for an opportunistic attacker with a backup of localStorage).
//
// Stored format: `pbkdf2$<iterations>$<base64Salt>$<base64Hash>`
//
// MIGRATION
// ---------
// Existing kiosks have bare-hex SHA-256 hashes saved. `verifyPin()` detects
// the legacy format and verifies against it; on a successful match it also
// returns a freshly-computed PBKDF2 hash so the host can persist it
// transparently — the user keeps the same PIN, the storage upgrades on
// first successful unlock.
//
// FULLSCREEN
// ----------
// Cross-browser wrappers for the Fullscreen API. Catches and swallows the
// "user gesture required" rejections — those are normal when called outside
// a click handler.

const PBKDF2_PREFIX = 'pbkdf2$';
const PBKDF2_ITERATIONS = 200_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

export interface VerifyResult {
  ok: boolean;
  /**
   * Set when a legacy SHA-256 hash matched. Callers should persist this to
   * complete the silent migration to PBKDF2.
   */
  upgradedHash?: string;
}

export class KioskSecurity {
  // ─── PIN hashing ─────────────────────────────────────────────────────────

  /**
   * Hash a new PIN. Returns the empty string for empty input so the caller
   * can store '' to mean "no PIN set" (matches legacy semantics).
   */
  async hashPin(raw: string): Promise<string> {
    if (!raw) return '';
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const hash = await this.pbkdf2(raw, salt, PBKDF2_ITERATIONS);
    return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${b64encode(salt)}$${b64encode(hash)}`;
  }

  /**
   * Verify a typed PIN against a stored hash. Accepts both the new PBKDF2
   * format and the legacy bare-hex SHA-256 format. On a legacy match,
   * returns an `upgradedHash` the caller should persist.
   */
  async verifyPin(raw: string, stored: string): Promise<VerifyResult> {
    if (!stored) return { ok: false };

    if (stored.startsWith(PBKDF2_PREFIX)) {
      const parts = stored.slice(PBKDF2_PREFIX.length).split('$');
      if (parts.length !== 3) return { ok: false };
      const iter = Number(parts[0]);
      const salt = b64decode(parts[1] as string);
      const expected = b64decode(parts[2] as string);
      if (!Number.isFinite(iter) || iter <= 0) return { ok: false };
      const actual = await this.pbkdf2(raw, salt, iter);
      return { ok: constantTimeEqual(actual, expected) };
    }

    // Legacy SHA-256 hex format: 64 lowercase hex chars.
    if (/^[0-9a-f]{64}$/.test(stored)) {
      const actual = await sha256Hex(raw);
      if (constantTimeEqualStr(actual, stored)) {
        const upgradedHash = await this.hashPin(raw);
        return { ok: true, upgradedHash };
      }
      return { ok: false };
    }

    // Unknown format — reject closed.
    return { ok: false };
  }

  // ─── Fullscreen ──────────────────────────────────────────────────────────

  requestFullscreen(): void {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;
    if (fn) fn.call(el)?.catch(() => {});
  }

  exitFullscreen(): void {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      mozCancelFullScreen?: () => Promise<void>;
      msExitFullscreen?: () => Promise<void>;
    };
    const fn =
      doc.exitFullscreen ||
      doc.webkitExitFullscreen ||
      doc.mozCancelFullScreen ||
      doc.msExitFullscreen;
    if (fn) fn.call(doc)?.catch(() => {});
  }

  isFullscreen(): boolean {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      mozFullScreenElement?: Element | null;
      msFullscreenElement?: Element | null;
    };
    return Boolean(
      doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement,
    );
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private async pbkdf2(raw: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(raw),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    // Cast quiets TS 5.6's BufferSource = ArrayBufferView<ArrayBuffer> narrowing.
    // The salt is always backed by a real ArrayBuffer at runtime (allocated by
    // crypto.getRandomValues or b64decode), so the cast is sound.
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
      keyMaterial,
      HASH_BYTES * 8,
    );
    return new Uint8Array(bits);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const raw = atob(s);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function constantTimeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
