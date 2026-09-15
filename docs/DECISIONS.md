# Decision log

Why the project looks the way it does. Newest first within each section. Each entry states the
decision, the alternatives considered, and what would make us revisit it.

## Product and data

**Supabase as the single source of truth (2026-09-14).** Version 1 logged sessions to a
`sessions.json` file that Google Drive synced between computers. That cannot reach a phone, and
the log was wiped once during development, so the move to phone apps forced a real backend.
Supabase gives a Postgres table, auth, and row-level security on a free tier with no server to
run. Alternatives: Firebase (heavier SDK, NoSQL), a self-hosted API (needs hosting). Revisit if
Supabase's free tier pauses the project for inactivity (the app then shows cached data and queues
writes, so nothing is lost).

**Anon key baked into the build.** The key is designed to be public; row-level security is what
protects data. Baking it at build time keeps the app a static bundle with no runtime config UI.
Revisit only if a second environment (staging) is ever needed.

**Local cache plus write queue instead of Supabase Realtime.** The dashboard reads from a
`localStorage` copy and writes go through a queue that flushes when online. This gives instant
rendering, offline logging, and resilience to expired tokens with very little code. Realtime
subscriptions were not needed: one person, a handful of devices, and a "pull on foreground" model
is enough.

**Sessions sync, settings do not.** Categories, durations, and the current task stay per device.
They are cheap to set and people often want different defaults on a phone versus a desktop.
Revisit if the user asks for category sync.

**Import is idempotent by `started_at`.** Legacy rows have no ids, so the start timestamp is the
natural key. Importing the same file twice is harmless.

**Delete keeps the UI honest.** Deleting a row that has not synced yet just drops the queued
insert; deleting a synced row queues a delete. Both paths update the cache immediately.

## Timer

**Derive time from `endTime`, never count ticks.** Browsers throttle timers in background tabs,
phones freeze JavaScript, Electron can be hidden for hours. Computing `remaining` from an absolute
end time makes all of that irrelevant. The trade-off is that a system clock change mid-session
shifts the end; acceptable.

**Persist the in-progress timer.** Saving state to `localStorage` on every change means a killed
app, reload, or quit-and-relaunch resumes exactly where it was and logs a session that ended in
the meantime with the correct end time.

**Exact-time OS notifications on phones, in-app alerts elsewhere.** On iOS/Android the WebView
may be frozen at the moment the timer ends, so the OS schedules the alert. Desktop and browser
JavaScript keeps running, so the app itself plays the sound and posts a notification.

## Platform shells

**Capacitor for iOS and Android (2026-09-14).** The app was already a single HTML page with a
polished UI; Capacitor wraps it with real native projects and small plugins (notifications,
preferences, share, filesystem) without rewriting anything. Alternatives: React Native or Flutter
(full rewrite), PWA (no exact alarms on iOS). Native projects are committed, per Capacitor
convention, so builds are reproducible. Swift Package Manager is used so CocoaPods is not needed.

**Electron for Mac and Windows (2026-09-14).** Considered:

- *Tauri*: smaller binaries, but needs a Rust toolchain, and cross-building the Windows
  installer from a Mac is impractical.
- *Capacitor's community Electron platform*: thinly maintained.
- *Keep the Python launcher*: works, but it is a browser tab, not an app, and needs Python.

Electron is mature, electron-builder can produce the Windows installer on a Mac, and the renderer
runs unchanged because `Capacitor.isNativePlatform()` is false there. Binary size (about 120 MB
per installer) is the price. Revisit if Tauri's cross-compilation story improves.

**Desktop behaviour: hide on close (Mac), quit on close (Windows), no tray icon.** These follow
each platform's conventions. A tray icon would let the Windows app keep running after close; it
was left out to keep the first version small. Revisit on request.

**Desktop alerts do not steal focus.** A pomodoro ending should be noticeable, not disruptive:
bounce the Dock icon / flash the taskbar and post a notification, but do not yank the window in
front of whatever the user is typing into.

**Only `dist/` and the two shell files ship in the app.** Vite bundles everything the renderer
needs, so packaging `node_modules` would add tens of megabytes of dead weight. The
electron-builder `files` list is explicit about this.

**Two Mac DMGs (arm64 and x64) rather than one universal binary.** Half the download size for
each user and a simpler build; the trade-off is that the user must pick the right file, which the
README explains.

**Unsigned, un-notarized builds.** There is no Developer ID certificate on this machine. The
Electron binaries are ad-hoc signed, which is enough to run locally on Apple Silicon. Other Macs
need right-click → Open once; Windows shows a SmartScreen prompt. Revisit when distributing to
other people: electron-builder supports signing and notarization through environment variables.

**NSIS toolset 1.2.1 in `electron-builder.yml`.** electron-builder's default NSIS bundle is an
Intel-only Mac binary, which fails on Apple Silicon without Rosetta. The newer toolset ships
native binaries. Pinning it in config means anyone cloning the repo gets a working Windows build.

**Python launcher kept as "browser mode".** It costs nothing, has zero dependencies, and is a
useful fallback if Electron misbehaves. It is documented as secondary.

## Repository and workflow

**Vite over a plain `<script>` page.** Needed a bundler once Supabase and Capacitor packages came
in; Vite is the lightest option that also gives hot reload and an easy `base: "./"` build.

**Dev and Prod folders.** `Pomo Timer - Dev` is the git checkout; the sibling `Pomo Timer - Prod`
is the untouched pre-Supabase installation holding the real `sessions.json`. It stays until that
history is imported.

**Branch + pull request for larger changes.** The desktop work went in as PR #3 from a
`desktop-apps` branch so it could be reviewed as a unit, then the branch was deleted.

**Google Drive as the working folder is a known liability.** Drive rewrites symlinks and deep
folder trees inside `node_modules` and unpacked app bundles (see `TROUBLESHOOTING.md`). The repo
is on GitHub, so moving the checkout out of Drive is a safe, recommended follow-up.
