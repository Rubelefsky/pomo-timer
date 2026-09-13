# Pomo Timer

A simple cross-platform Pomodoro timer (Mac/Windows) with built-in session tracking and a local dashboard.

## Quick start

Requires **Python 3** (no extra packages).

- **Mac:** double-click `start-mac.command`  
  or run `python3 pomodoro.py`
- **Windows:** double-click `start-windows.bat`  
  or run `python pomodoro.py`

The app opens in your browser at **http://localhost:8765**.

## What it does

- Start focus sessions with a task name and category (Work / Study / Personal / custom)
- Run focus, short-break, and long-break timers with configurable durations
- Show popup, sound, and desktop notifications when a timer ends
- Track stats in a dashboard:
  - today’s pomodoros
  - this week’s focus time
  - per-category totals
  - per-task totals
  - full session history
- Delete individual sessions
- Export all sessions to CSV

## Data, backups, and export

- Sessions are stored in `sessions.json` next to `pomodoro.py` (including sessions stopped early).
- A backup snapshot is created in `backups/` once per day (for example, `backups/sessions-2026-09-12.json`) at startup and before the first write of the day.
- The 14 most recent daily backups are kept.
- **Export CSV** downloads `pomodoro-sessions.csv` for analysis in Sheets/Excel.

To restore from backup: stop the app, then copy a backup file over `sessions.json`.

## Keep your local session history out of git

This repo includes an empty `sessions.json` and `backups/` folder, but your real history should stay local.

After cloning, run:

```bash
git update-index --skip-worktree sessions.json
```

This tells git to keep ignoring your local `sessions.json` changes.
