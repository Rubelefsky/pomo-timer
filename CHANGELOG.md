# Changelog

Everything that has happened to Pomo Timer, newest first. Dates are when the work landed on
`main`. See `docs/` for how the app is put together and why it was built this way.

## Project status (as of 2026-09-14)

Set up and working:

- Supabase project `hijjtizbbofugpoyjono` with the `sessions` table and row-level security from
  `supabase/schema.sql`. Email sign-in with "Confirm email" turned off.
- `.env` holds the project URL and anon key (gitignored). Every build since then has the keys
  baked in and opens on the sign-in screen.
- Mac (Apple Silicon and Intel) and Windows installers built locally in `release/`.
- iOS and Android native projects generated and committed; not yet run on a device.

Still to do:

- Import the pre-Supabase history: the real `sessions.json` lives in the sibling folder
  `../Pomo Timer - Prod/` and has not been imported (Dashboard → Import JSON). Prod can be retired
  after that.
- Run the iOS app from Xcode and the Android app from Android Studio for the first time.
- Optional: code signing / notarization, a tray icon on Windows, GitHub Releases with installers,
  moving the checkout out of Google Drive (see `docs/TROUBLESHOOTING.md`).

## [2.0.0] – 2026-09-14

### Desktop apps (PR #3, merged 2026-09-14)

- Standalone **Mac** and **Windows** apps: the same Vite build wrapped in Electron 44 and packaged
  with electron-builder 26 (`electron/`, `electron-builder.yml`).
- Window shell: native menu on Mac, hide-on-close so a running timer stays alive in the Dock,
  quit-on-close on Windows, single-instance lock, external links open in the default browser,
  background throttling off so the clock ticks at full rate while hidden.
- Timer-end alerts: system notification plus Dock bounce (Mac) or taskbar flash (Windows) via a
  small preload bridge (`window.desktop`); clicking the notification focuses the window.
- New app icon (`electron/icon.svg` → `icon.png`).
- npm scripts `desktop`, `desktop:dev`, `desktop:mac`, `desktop:win`, `desktop:all`.
- Windows installer builds on Apple Silicon Macs without Rosetta or Wine (NSIS toolset 1.2.1).
- README: "Mac and Windows Apps" install/build/develop guide and a desktop timer-behaviour
  section. Node requirement raised to 22.12+ (Electron 44).

### Mobile apps and cloud sync (commit `28a4faf`, 2026-09-14)

- Replaced the Python session server with **Supabase** as the single source of truth:
  `sessions` table, row-level security so each user only sees their own rows, email/password
  sign-in.
- Wrapped the page in **Vite** and **Capacitor 8**; generated the **iOS** (Swift Package
  Manager) and **Android** native projects and committed them.
- New module layout: `src/main.js` (UI + timer), `src/store.js` (Supabase + local cache +
  offline write queue), `src/native.js` (notifications, share sheet, resume hooks),
  `src/supabase.js` (client), `src/style.css`.
- Timer persists its end time so it survives backgrounding, locking, reloads, or the OS killing
  the app; on return it resyncs and logs a session that ended while away.
- Exact-time local notification with a bundled alarm sound on phones (`public/alarm.wav`;
  Android channel with `USE_EXACT_ALARM`), browser notification plus beep elsewhere.
- Offline support: sessions queue locally and sync when back online; the dashboard shows how
  many changes are waiting.
- CSV/JSON export through the share sheet on phones (download in browsers); JSON import that
  skips rows already present, so the old `sessions.json` can be imported safely.
- Phone layout: safe areas, fluid timer ring, scrollable tables, long-press to remove a category.
- `pomodoro.py` reduced to a static launcher for `dist/`; `sessions.json` and `backups/`
  untracked and gitignored.

## [1.0.0] – 2026-09-12

- First version: a single `index.html` timer + dashboard served by `pomodoro.py`, a
  dependency-free Python HTTP server on port 8765 with a small JSON API.
- Sessions logged to `sessions.json` next to the script (synced between machines by Google
  Drive), daily backups to `backups/`, CSV export endpoint.
- `start-mac.command` / `start-windows.bat` launchers.
- README polished by two Copilot pull requests (#1 wording and structure, #2 badges).
