// With Capacitor Keyboard `resize: 'none'` the WebView doesn't shrink when
// the keyboard opens, and iOS WKWebView won't auto-scroll the focused field
// into view. Every scrollable form (onboarding, tax profile, manual setup,
// add-subscription…) would leave the field you're typing in hidden behind
// the keyboard. This nudges the focused field back into the visible band.
//
// Screens that place their own input above the keyboard (the AI chat) opt
// out with `data-no-scroll-assist` on an ancestor.

let keyboardHeight = 0;

function nudgeFocusedIntoView(): void {
  if (keyboardHeight <= 0) return;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return;
  const tag = el.tagName;
  const editable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  if (!editable) return;
  if (el.closest('[data-no-scroll-assist]')) return;

  const rect = el.getBoundingClientRect();
  const safeBottom = window.innerHeight - keyboardHeight - 16;
  if (rect.bottom <= safeBottom && rect.top >= 8) return; // already fully visible

  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export function initKeyboardScrollAssist(): void {
  import('@capacitor/keyboard')
    .then(({ Keyboard }) => {
      Keyboard.addListener('keyboardWillShow', (info) => {
        keyboardHeight = info.keyboardHeight || 0;
        setTimeout(nudgeFocusedIntoView, 50);
      });
      Keyboard.addListener('keyboardDidShow', () => setTimeout(nudgeFocusedIntoView, 0));
      Keyboard.addListener('keyboardWillHide', () => { keyboardHeight = 0; });
    })
    .catch(() => { /* plugin absent (web/dev) — visualViewport fallback below */ });

  // Moving between fields while the keyboard is already up.
  document.addEventListener('focusin', () => {
    if (keyboardHeight > 0) setTimeout(nudgeFocusedIntoView, 50);
  });

  // Web / dev fallback: visualViewport reflects the keyboard on iOS Safari.
  const vv = window.visualViewport;
  if (vv) {
    const onResize = () => {
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      keyboardHeight = gap > 80 ? gap : 0;
      nudgeFocusedIntoView();
    };
    vv.addEventListener('resize', onResize);
  }
}
