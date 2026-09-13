# Pomo Timer

Cross-platform (Mac/Windows) Pomodoro timer with session logging and a dashboard.

## Run

Requires Python 3 (no extra packages).

- **Mac:** double-click `start-mac.command` (or run `python3 pomodoro.py`)
- **Windows:** double-click `start-windows.bat` (or run `python pomodoro.py`)

Your browser opens automatically at http://localhost:8765.

## Features

- Set the task and category (Work / Study / Personal / custom) before starting a pomodoro
- Focus / short break / long break timers with configurable durations
- Popup, sound, and desktop notification when a timer ends
- Dashboard shows today's pomodoros, focus time this week, per-category and per-task totals, and full history
- Delete individual sessions from the history
- Export all sessions to CSV

## Data & logs

- Every session (including ones stopped early) is appended to `sessions.json` next to `pomodoro.py`. If you keep this folder in a synced drive (Google Drive, Dropbox, OneDrive), your log follows you across machines.
- The server snapshots the log into `backups/` once per day (e.g. `backups/sessions-2026-09-12.json`) at startup and before the first write of the day. The 14 most recent daily backups are kept. To restore, copy a backup over `sessions.json` while the server is stopped.
- **Export CSV** on the dashboard downloads the full log as `pomodoro-sessions.csv` for analysis in Sheets/Excel.
- An empty `sessions.json` and `backups/` folder ship with the repo, but your actual focus history stays local: backup snapshots are gitignored, and after cloning you should run

  ```
  git update-index --skip-worktree sessions.json
  ```

  so git permanently ignores your local session data.
