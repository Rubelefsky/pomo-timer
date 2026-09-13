# 🍅 Pomo Timer

<p>
  <img src="https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white" alt="Python 3">
  <img src="https://img.shields.io/badge/Platform-Mac%20%7C%20Windows-1f6feb" alt="Platform">
  <img src="https://img.shields.io/badge/Dependencies-None-2ea043" alt="No dependencies">
  <img src="https://img.shields.io/badge/Storage-Local%20JSON-f0883e" alt="Local storage">
</p>

A clean, local-first Pomodoro timer with a built-in dashboard, history, and CSV export.

---

## ✨ Features

- Start focus sessions with a task name and category (Work / Study / Personal / custom)
- Focus, short-break, and long-break cycles with configurable durations
- Browser popup, sound, and desktop notifications when time is up
- Dashboard metrics for:
  - today’s pomodoros
  - this week’s focus time
  - category totals
  - task totals
  - full session history
- Delete individual sessions
- Export all sessions to CSV

---

## 🚀 Quick Start

Requires **Python 3** (no extra packages).

- **Mac:** double-click `start-mac.command`  
  or run `python3 pomodoro.py`
- **Windows:** double-click `start-windows.bat`  
  or run `python pomodoro.py`

Open: **http://localhost:8765**

---

## 🗂 Data, Backups, and Export

- Sessions are stored in `sessions.json` next to `pomodoro.py` (including sessions stopped early).
- A backup snapshot is created in `backups/` once per day (for example, `backups/sessions-2026-09-12.json`) at startup and before the first write of the day.
- The 14 most recent daily backups are kept.
- **Export CSV** downloads `pomodoro-sessions.csv` for analysis in Sheets/Excel.

To restore from backup: stop the app, then copy a backup file over `sessions.json`.

---

## 🧹 Keep Local Session History Out of Git

This repo includes an empty `sessions.json` and `backups/` folder, but your real history should stay local.

After cloning, run:

```bash
git update-index --skip-worktree sessions.json
```

This tells git to keep ignoring your local `sessions.json` changes.
