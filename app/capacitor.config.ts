import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.andrechan.cukai',
  appName: 'Cukai',
  webDir: 'dist',
  plugins: {
    // Don't resize the WebView when the keyboard opens — it just overlays.
    // The app keeps its full height (nothing shifts up, no black gap below
    // the tab bar); the one screen that cares (AI chat) lifts its own
    // input above the keyboard from the reported height. See
    // app/src/lib/useKeyboardInset.ts.
    Keyboard: { resize: 'none' },
  },
};

export default config;
