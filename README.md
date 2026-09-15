# 🍅 Pomo Timer

<p>
  <img src="https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Mac%20%7C%20Windows-1f6feb" alt="Platform">
  <img src="https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white" alt="Electron 44">
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" alt="Capacitor 8">
  <img src="https://img.shields.io/badge/Supabase-Sync-3ECF8E?logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite">
</p>

A clean Pomodoro timer with a built-in dashboard, history, and export. One codebase runs as an
**iPhone / iPad app**, an **Android app**, a **Mac app**, a **Windows app**, and in your
**desktop browser**, with sessions synced through **Supabase** so every device shows the same history.

---

## ✨ Features

- Start focus sessions with a task name and category (Work / Study / Personal / custom)
- Focus, short-break, and long-break cycles with configurable durations
- Exact-time phone notifications with sound, even with the app closed; popup, sound, and desktop notifications on Mac, Windows, and in the browser
- On Mac and Windows the app bounces the Dock icon / flashes the taskbar when a timer ends, even if the window is hidden
- A running timer survives backgrounding, locking the phone, or the app being killed
- Dashboard metrics for:
  - today’s pomodoros
  - this week’s focus time
  - category totals
  - task totals
  - full session history
- Delete individual sessions
- Export CSV / JSON, Import JSON
- Works offline: sessions queue locally and sync when you are back online

---

## 🛠 One-Time Setup

### 1. Supabase project

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor → New query**, paste `supabase/schema.sql`, and run it.
   This creates the `sessions` table with row-level security (each user only sees their own rows).
3. Under **Authentication → Providers → Email**, keep Email enabled. For a personal app you can turn
   off **Confirm email** so "Create account" signs you straight in; otherwise click the link in the
   confirmation email once, then sign in.
4. Copy the **Project URL** and **anon public** key from **Project Settings → API**.

### 2. Local build

Requires **Node 22.12+** (Node 22.16 tested); the Electron package refuses older versions.

```bash
cp .env.example .env        # paste your Supabase URL + anon key into .env
npm install
npm run build               # writes dist/
```

`.env` is gitignored. The anon key is safe to ship in the app: row-level security protects your
data, not the key.

### 3. Bring in existing history

Open the app, sign in, go to **Dashboard → Import JSON**, and pick an old `sessions.json` or a
backup file. Rows whose `started_at` already exists are skipped, so importing twice is harmless.

---

## 🖥 Mac and Windows Apps

The desktop apps are the same web build wrapped in [Electron](https://www.electronjs.org)
(`electron/`), packaged with [electron-builder](https://www.electron.build). Installers are not
committed to the repo; build them yourself (below) or grab them from a GitHub Release if one is
attached.

### Install

| Your machine | File |
|---|---|
| Mac with Apple Silicon (M-series) | `PomoTimer-<version>-mac-arm64.dmg` |
| Mac with an Intel chip | `PomoTimer-<version>-mac-x64.dmg` |
| Windows 10 / 11, 64-bit | `PomoTimer-<version>-win-x64.exe` |

Not sure which Mac you have? **Apple menu → About This Mac** shows "Chip: Apple M…" or "Intel".

**Mac**

1. Open the DMG and drag **PomoTimer** to **Applications**.
2. The app is not notarized. If macOS says it "can't be opened", right-click the app → **Open**
   once, or run `xattr -cr /Applications/PomoTimer.app`. Not needed on the Mac that built it.
3. Allow notifications when prompted. If you dismissed the prompt: **System Settings →
   Notifications → PomoTimer**.

**Windows**

1. Run the installer. SmartScreen may show "Windows protected your PC" because the app is not
   code-signed: click **More info → Run anyway**.
2. Pick an install folder (defaults to your user profile, no admin rights needed). The installer
   adds Start Menu and desktop shortcuts.

**Updating:** install the new version the same way; it replaces the old one and keeps your
sign-in and settings. **Uninstalling:** drag the app to the Trash on Mac, or use
**Settings → Apps** on Windows. Your data stays in Supabase either way.

### Build the installers

Needs Node 22.12+ and a `.env` with your Supabase keys (they are baked in at build time; a build
without them opens on a "Connect to Supabase" screen).

```bash
npm run desktop         # build and launch the app locally, no installer
npm run desktop:mac     # release/PomoTimer-<version>-mac-arm64.dmg and -mac-x64.dmg
npm run desktop:win     # release/PomoTimer-<version>-win-x64.exe
npm run desktop:all     # everything above
```

- Both installers build on a Mac. The Windows installer also builds on Windows; the Mac DMGs
  need a Mac.
- Building the Windows installer on a Mac needs no Wine or Rosetta: `electron-builder.yml` pins
  electron-builder's newer NSIS toolset, which ships native Apple Silicon binaries.
- The first build downloads Electron for each target (about 100 MB each) into electron-builder's
  cache. Output lands in `release/`, which is gitignored.
- Only `dist/`, `electron/main.cjs`, and `electron/preload.cjs` ship inside the app; no
  `node_modules`. The renderer is fully bundled by Vite.
- Builds are unsigned. To sign, give electron-builder a certificate through its
  `CSC_LINK` / `CSC_KEY_PASSWORD` environment variables (and `APPLE_ID` /
  `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` to notarize on Mac); see
  <https://www.electron.build/code-signing>.
- Bump `version` in `package.json` before a release; it appears in the installer file names
  and in the Mac app's **About PomoTimer** box.

### Develop

Run `npm run dev` in one terminal and `npm run desktop:dev` in another. The window loads the
Vite dev server with hot reload and opens DevTools. On Windows, toast notifications may not show
in this mode until the app has been installed once from the installer (Windows ties them to the
Start Menu shortcut).

Sign-in state and settings live in the app's own profile (`~/Library/Application Support/PomoTimer`
on Mac, `%APPDATA%\PomoTimer` on Windows), separate from any browser, and shared between
`npm run desktop:dev` and the installed app.

**Browser instead:** `start-mac.command` / `start-windows.bat` (or `python3 pomodoro.py`) still
serve `dist/` at **http://localhost:8765** and open it in your default browser.

---

## 📱 Build the Phone Apps

Native projects live in `ios/` and `android/` (generated by Capacitor, committed to git).
After any web change:

```bash
npm run build && npx cap sync
```

### iOS

Needs Xcode from the App Store (Command Line Tools alone are not enough). Once:

```bash
sudo xcode-select -s /Applications/Xcode.app
```

Then `npm run ios` opens the project in Xcode. Pick your team under **Signing & Capabilities**,
choose your iPhone, and press Run. A free Apple ID installs to your own device (re-sign weekly);
TestFlight or the App Store needs the Apple Developer Program. Dependencies use Swift Package
Manager, so CocoaPods is not required.

### Android

`npm run android` opens the project in Android Studio (which bundles its own JDK; the
"Unable to locate a Java Runtime" message from the CLI is harmless). Let Gradle sync, plug in a
phone with USB debugging on, and press Run. **Build → Generate Signed Bundle / APK** produces an
installable APK for sideloading.

The manifest declares `USE_EXACT_ALARM` so timer alerts fire on the second. Google Play permits
this permission for timer apps.

---

## ⏱ How the Timer Behaves on a Phone

- The end time is saved when you press Start. Backgrounding, locking the phone, or the OS
  killing the app does not lose the session; on return the clock resyncs and, if the timer
  already ended, the session is logged with the correct end time.
- A local notification with sound (`public/alarm.wav`) is scheduled for the exact end time.
  Pausing or resetting cancels it.
- Categories, durations, and the current task are per-device settings; sessions sync.
- Long-press (or double-click) a category chip to remove it.

---

## ⏱ How the Timer Behaves on Mac and Windows

- The clock keeps ticking at full rate while the window is hidden, minimised, or behind other
  windows (Electron's background throttling is turned off for this window).
- When a timer ends the app plays the alert sound, shows a system notification, and bounces the
  Dock icon (Mac) or flashes the taskbar button (Windows) without stealing focus. Clicking the
  notification brings the window forward.
- **Mac:** closing the window hides it; the app and any running timer stay alive in the Dock.
  Click the Dock icon to bring it back, ⌘Q to quit.
- **Windows:** closing the window quits the app. A running timer is not lost: its end time is
  saved, so the next launch resyncs the clock and, if the timer already ended, logs the session
  with the correct end time. No alert fires while the app is closed, though.
- Launching the app a second time just focuses the existing window.
- Export CSV / JSON opens a normal save dialog; Import JSON opens a file picker.
- Links that would leave the app (for example in a Supabase confirmation email) open in your
  default browser.

---

## 📚 Documentation

- [`CHANGELOG.md`](CHANGELOG.md) — what has been done so far, current project status, and what is next
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the app, sync, timer, and the five shells fit together
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — why each technology and behaviour was chosen
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — problems that have come up and their fixes

---

## 🗂 Project Layout

```
index.html           page markup (Vite entry)
src/main.js          timer, dashboard, auth UI
src/store.js         Supabase sessions + local cache + offline write queue
src/native.js        notifications, share sheet, resume hooks (browser fallbacks included)
src/supabase.js      client setup (reads VITE_SUPABASE_* from .env)
src/style.css        styles
public/alarm.wav     notification sound (also copied to android/app/src/main/res/raw)
supabase/schema.sql  database table + row-level security policies
docs/, CHANGELOG.md  architecture, decisions, troubleshooting, history
electron/main.cjs    Mac/Windows window, menu, Dock/taskbar alerts
electron/preload.cjs bridge that exposes window.desktop to the page
electron/icon.svg    app icon source (icon.png is the rendered 1024px version)
electron-builder.yml DMG / Windows installer packaging config (output in release/)
pomodoro.py          browser-mode static server / launcher
capacitor.config.json, ios/, android/   native app shells
```
