import type { CapacitorConfig } from '@capacitor/cli';

// Live-reload on a real device over WiFi (no cable, no per-change rebuild):
// set CAP_SERVER_URL to the Vite dev server URL before `npx cap sync ios`,
// e.g.
//   CAP_SERVER_URL=http://MacBook-Air-2.local:5173 npx cap sync ios
// The native shell then loads the web app from the dev server on the Mac,
// so every JS/CSS/TSX edit hot-reloads on the phone instantly. Only native
// or plugin changes need a rebuild + reinstall after that.
//
// Leave CAP_SERVER_URL unset for a normal self-contained build (loads the
// bundled files from webDir/dist — works with no Mac and no network).
const serverUrl = process.env.CAP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.andrechan.cukai',
  appName: 'Cukai',
  webDir: 'dist',
  ...(serverUrl
    ? {
        // `cleartext` allows plain http:// to the LAN dev server. Paired
        // with Info.plist's NSAllowsLocalNetworking (covers *.local and
        // 192.168.x.x), no other ATS change is needed.
        server: { url: serverUrl, cleartext: true },
      }
    : {}),
};

export default config;
