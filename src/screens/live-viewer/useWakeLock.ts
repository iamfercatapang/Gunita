import { useEffect } from 'react';

/** Keep the screen on while mounted. Re-acquired when the tab comes back. */
export function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async (): Promise<void> => {
      if (lock || disposed) return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (disposed) {
          void next.release();
          return;
        }
        lock = next;
        next.addEventListener('release', () => {
          if (lock === next) lock = null;
        });
      } catch (e) {
        console.warn('[Viewer] Wake Lock:', (e as Error).message);
      }
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, []);
}
