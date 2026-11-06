import { type RefObject, useEffect } from 'react';

/** Move focus into a dialog when it opens and back to the opener when it closes. */
export function useDialogFocus(target: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    target.current?.focus();
    return () => opener?.focus?.();
  }, [target]);
}
