import { useEffect, useState } from 'react';

/**
 * Height (px) the on-screen keyboard currently covers, or 0 when it's
 * hidden. With Capacitor's Keyboard `resize: 'none'` the WebView doesn't
 * shrink when the keyboard opens, so a screen that needs to keep an input
 * above the keyboard has to do it from this number.
 *
 * Native: uses @capacitor/keyboard's willShow/willHide events (loaded
 * lazily so a plain web/dev build doesn't need the plugin). Web fallback:
 * visualViewport, which on iOS Safari does reflect the keyboard.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    let disposed = false;
    const cleanups: Array<() => void> = [];

    // --- Native (Capacitor) ---
    import('@capacitor/keyboard')
      .then(({ Keyboard }) => {
        if (disposed) return;
        Keyboard.addListener('keyboardWillShow', (info) => setInset(info.keyboardHeight || 0))
          .then((h) => cleanups.push(() => h.remove()));
        Keyboard.addListener('keyboardWillHide', () => setInset(0))
          .then((h) => cleanups.push(() => h.remove()));
      })
      .catch(() => { /* plugin not available (web/dev) — fall back below */ });

    // --- Web fallback: visualViewport ---
    const vv = window.visualViewport;
    if (vv) {
      const onResize = () => {
        // Gap between the layout viewport bottom and the visual viewport
        // bottom = the keyboard (plus any browser chrome, close enough).
        const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setInset(gap > 80 ? gap : 0); // ignore small chrome-only deltas
      };
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
      cleanups.push(() => {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      });
    }

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return inset;
}
