# Troubleshooting

Problems that have actually come up, with the fix that worked.

## Setup and sync

**The app opens on "Connect to Supabase".**
The build has no credentials. Copy `.env.example` to `.env`, fill in the project URL (without
`/rest/v1/`) and the anon key, then rebuild (`npm run build`, plus `npx cap sync` for phones or
`npm run desktop:all` for installers). Credentials are baked in at build time.

**Sign-in works but saving a pomodoro fails, or the console shows `PGRST205`
"Could not find the table 'public.sessions'".**
The schema has not been run. Supabase dashboard → SQL Editor → New query → paste
`supabase/schema.sql` → Run. No rebuild needed.

**"Create account" says to check your email.**
Supabase's "Confirm email" is on. Either click the link once, or turn it off under
Authentication → Providers → Email for a personal app.

**Dashboard shows "N changes waiting to sync".**
You are offline, signed out, or the token expired. The queue flushes automatically on the next
foreground, `online` event, or dashboard visit. Signing out with items queued discards them
(the app warns first).

**Wrong key pasted.**
The anon key's JWT payload has `"role":"anon"`. If you see `"role":"service_role"`, that is the
secret key: do not ship it, rotate it in the dashboard.

## Google Drive

**Electron will not start: `Library not loaded: @rpath/Electron Framework.framework`,
`errno=20` (Not a directory).**
Google Drive replaced a directory inside `node_modules/electron/dist/Electron.app` with an empty
file (dated 1979). Repair:

```bash
rm -rf node_modules/electron/dist && node node_modules/electron/install.js
```

It can recur. The finished `.dmg` and `.exe` files are single files and are safe; the unpacked
app folders under `release/` and anything with symlinks in `node_modules/` are not. The durable
fix is to clone the repo outside Drive (for example `~/Projects/pomo-timer`); it is on GitHub, so
nothing is lost.

**Builds are slow or Drive is constantly syncing.**
`node_modules/` (hundreds of MB) and `release/` (about 750 MB) live inside Drive. Same fix as above,
or pause Drive sync while building.

## Desktop builds

**Windows build fails on a Mac: `Cannot spawn .../nsis-3.0.4.1/mac/makensis: spawn Unknown
system error -86`.**
Errno 86 is "bad CPU type": the legacy NSIS binary is Intel-only and the Mac has no Rosetta.
`electron-builder.yml` already sets `toolsets.nsis: "1.2.1"`, which ships native Apple Silicon
binaries. If you see this, the config was removed or an older electron-builder is installed.
Alternative: `softwareupdate --install-rosetta --agree-to-license`.

**"skipped macOS application code signing" in the build log.**
Expected. No Developer ID certificate is installed; the app is ad-hoc signed and runs locally. On
another Mac, right-click → Open once or `xattr -cr /Applications/PomoTimer.app`.

**Windows: "Windows protected your PC".**
Unsigned installer. More info → Run anyway.

**A `PomoTimer 2.0.0-arm64` volume is left mounted after a build.**
electron-builder occasionally leaves the DMG attached. `hdiutil detach "/Volumes/PomoTimer 2.0.0-arm64"`.

**Electron package refuses to install.**
Electron 44 needs Node 22.12 or newer. `node --version`, then upgrade.

**Windows dev mode shows no toast notifications.**
Windows ties toasts to a Start Menu shortcut with the app's AppUserModelID, which only the
installer creates. Install once from `release/PomoTimer-*-win-x64.exe`; after that, notifications
from `npm run desktop:dev` should appear too (not yet verified on a Windows machine).

**Timer paused while the window was hidden.**
It should not: `backgroundThrottling` is off and time is derived from the saved end time. If the
clock looks stale, click the window; it resyncs on `visibilitychange`.

## Phones

**`xcodebuild` errors or `npm run ios` opens nothing.**
Xcode from the App Store is required (Command Line Tools alone are not enough), then
`sudo xcode-select -s /Applications/Xcode.app`.

**"Unable to locate a Java Runtime" when running `npm run android`.**
Harmless: Android Studio bundles its own JDK and the CLI message comes from the Capacitor
open step. Let Gradle sync inside Android Studio.

**No sound with the phone notification.**
Android: the `timer` notification channel is created on first launch with `alarm.wav`; if you
changed the channel's sound in system settings, that wins. iOS: check the app's notification
permission and the ring/silent switch.

## Browser mode

**`start-mac.command` / `start-windows.bat` says "No build found in dist/".**
Run `npm install && npm run build` first; the launcher only serves the built files.

**"Port 8765 is in use by another program."**
Another instance is probably running; the launcher opens the existing one if it responds,
otherwise stop whatever holds the port.
